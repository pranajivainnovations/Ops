/**
 * Read-only Google Drive client.
 *
 * The Cowork research pipelines write their output to the PRANAJIVA_AYURVEDA_KNOWLEDGE_BASE folder.
 * This reads it back so OPS can show it, and does nothing else: no writes, no copies into Postgres,
 * no sync job.
 *
 * ── Why read Drive live rather than mirror it ───────────────────────────────────────────────────
 * A mirror is a second copy that drifts, and the pipelines write to Drive on their own schedule —
 * OPS would always be showing a stale answer with no way to tell from the screen. Drive owns the
 * documents; OPS owns what the team decides about them, which lives in pranajiva.decisions. Same
 * split as the taxonomy registry: reference the external thing, never duplicate it.
 *
 * ── Why plain fetch and not the googleapis package ──────────────────────────────────────────────
 * `googleapis` is a ~50MB dependency that generates a client for every Google service. This needs
 * four endpoints. google-places.ts already talks to Google over bare fetch for the same reason, and
 * `jose` — already a dependency, for session cookies — signs the service-account assertion.
 */

import { SignJWT, importPKCS8 } from "jose"

/** Read-only, deliberately. This app must never be able to modify or delete a research document. */
const SCOPE = "https://www.googleapis.com/auth/drive.readonly"
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
const DRIVE_API = "https://www.googleapis.com/drive/v3"

const FOLDER_MIME = "application/vnd.google-apps.folder"

/**
 * How deep the walk goes before giving up.
 *
 * The knowledge base is four levels at its deepest (`02_KNOWLEDGE_CONTENT/P02_CONTENT_ENGINE/
 * blogs/drafts`). Eight leaves room for the pipelines to grow without a code change, while still
 * bounding a Drive structure that somehow contained a cycle or a runaway generated hierarchy.
 */
const MAX_DEPTH = 8

export class GoogleDriveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GoogleDriveError"
  }
}

export interface DriveFolder {
  id: string
  name: string
  modifiedTime: string | null
}

export interface DriveDocument {
  id: string
  name: string
  mimeType: string
  modifiedTime: string | null
  size: number | null
  webViewLink: string | null
  /** The folder that directly contains this file. */
  folderId: string | null
  folderName: string | null
  /** Folder names from the root down to the containing folder, for a breadcrumb. */
  path: string[]
  /** The top-level folder this file lives under — its pipeline. Null for files loose in the root. */
  pipeline: string | null
}

export interface DriveDocumentContent {
  /** Body with any frontmatter block removed, so the renderer never prints raw YAML. */
  text: string
  /** Parsed frontmatter keys, lowercased. Empty when the document has none — which is fine. */
  meta: Record<string, string>
  /** True when the file is not text and could not be read as text (an image, a PDF, a binary). */
  unreadable: boolean
}

/**
 * Configuration is one folder ID, not a list of pipelines.
 *
 * Every subfolder of the root is a pipeline, discovered at read time. Starting a fifth pipeline in
 * Cowork means creating a folder and sharing it — no env change, no deploy, no code edit. Same rule
 * the catalogue taxonomy follows: show what exists, rather than what someone remembered to hardcode.
 */
export function driveConfig(): {
  clientEmail: string
  privateKey: string
  rootFolderId: string
} | null {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim()
  const rawKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim()

  if (!clientEmail || !rawKey || !rootFolderId) return null

  /**
   * Service-account keys are multi-line PEM. Most secret stores and .env parsers cannot carry a
   * literal newline, so the key is almost always pasted with its newlines escaped — accept both
   * forms rather than making a working key look broken. Surrounding quotes are stripped for the
   * same reason: KEY="-----BEGIN..." is the shape people naturally write.
   */
  const privateKey = rawKey
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")

  return { clientEmail, privateKey, rootFolderId }
}

export function isDriveConfigured(): boolean {
  return driveConfig() !== null
}

/**
 * Access tokens live an hour; minting one costs a round trip and an RSA signature.
 *
 * Cached in module memory with a 60-second safety margin, so a burst of page loads shares one token
 * and a token is never used in the second it expires. Per-container and lost on restart, which is
 * exactly right for a credential derived entirely from configuration.
 */
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  const config = driveConfig()
  if (!config) {
    throw new GoogleDriveError(
      "Google Drive is not configured — set GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY and GOOGLE_DRIVE_ROOT_FOLDER_ID"
    )
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  let key: Awaited<ReturnType<typeof importPKCS8>>
  try {
    key = await importPKCS8(config.privateKey, "RS256")
  } catch {
    // The overwhelmingly common cause is a key whose newlines did not survive the environment.
    throw new GoogleDriveError(
      "GOOGLE_DRIVE_PRIVATE_KEY could not be parsed — it must be the full PEM block from the service account JSON, including the BEGIN and END lines"
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(config.clientEmail)
    .setAudience(TOKEN_ENDPOINT)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new GoogleDriveError(
      `Google refused the service account credentials (${res.status}). ${detail.slice(0, 300)}`
    )
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) {
    throw new GoogleDriveError("Google returned no access token")
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(0, (data.expires_in ?? 3600) - 60) * 1000,
  }
  return cachedToken.token
}

async function driveFetch(path: string, params: Record<string, string>): Promise<Response> {
  const token = await getAccessToken()
  const search = new URLSearchParams({
    // Without these two, files on a Shared Drive are invisible: the request succeeds and returns an
    // empty list, which reads as "the folder is empty" rather than "the query could not see it".
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    ...params,
  })

  const res = await fetch(`${DRIVE_API}${path}?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    if (res.status === 404) {
      throw new GoogleDriveError(
        "Drive returned 404 — either the folder ID is wrong, or the folder has not been shared with the service account."
      )
    }
    throw new GoogleDriveError(`Drive API error ${res.status}. ${detail.slice(0, 300)}`)
  }

  return res
}

/** Drive's query language delimits strings with single quotes, so one inside a value would escape. */
function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
}

interface RawFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  size?: string
  webViewLink?: string
}

const FILE_FIELDS = "files(id,name,mimeType,modifiedTime,size,webViewLink)"

/** Everything directly inside one folder — files and subfolders alike. */
async function listChildren(folderId: string): Promise<RawFile[]> {
  const res = await driveFetch("/files", {
    q: `${quote(folderId)} in parents and trashed = false`,
    fields: FILE_FIELDS,
    orderBy: "folder,name",
    pageSize: "300",
  })
  const data = (await res.json()) as { files?: RawFile[] }
  return data.files ?? []
}

/** Every subfolder of the root — one per research pipeline. */
export async function listPipelines(): Promise<DriveFolder[]> {
  const config = driveConfig()
  if (!config) return []

  const children = await listChildren(config.rootFolderId)
  return children
    .filter((f) => f.mimeType === FOLDER_MIME)
    .map((f) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime ?? null }))
}

export interface DriveTree {
  pipelines: DriveFolder[]
  documents: DriveDocument[]
  /** Every folder found, including empty ones — the knowledge base's shape is itself information. */
  folders: { id: string; name: string; path: string[]; pipeline: string | null }[]
  /** True when the walk stopped at MAX_DEPTH, so the UI can say so instead of quietly truncating. */
  truncated: boolean
}

/**
 * The whole knowledge base, walked recursively.
 *
 * Drive has no "descendant of" operator — `in parents` matches one level only. The first version of
 * this file listed the root's subfolders and then their direct children, which is why four of the
 * six pipelines rendered as "(0)" while holding sixteen files between them: every pipeline organises
 * its output into subfolders (`P01_FORMULA_ENGINE/formulas/…`), so the files were always one level
 * below where the query stopped.
 *
 * Walked breadth-first, one level at a time with the whole level in parallel, rather than depth-first
 * per branch: the tree is wide and shallow (38 folders, 4 levels), so this is four round trips deep
 * instead of thirty-eight sequential ones.
 */
async function walkTree(rootFolderId: string): Promise<DriveTree> {
  const documents: DriveDocument[] = []
  const folders: DriveTree["folders"] = []
  let truncated = false

  let level: { id: string; path: string[]; pipeline: string | null }[] = [
    { id: rootFolderId, path: [], pipeline: null },
  ]

  for (let depth = 0; depth < MAX_DEPTH && level.length > 0; depth++) {
    const results = await Promise.all(level.map((node) => listChildren(node.id)))
    const next: typeof level = []

    results.forEach((children, index) => {
      const parent = level[index]

      for (const child of children) {
        if (child.mimeType === FOLDER_MIME) {
          // A file's pipeline is the top-level folder it sits under, so it is fixed at depth 0 and
          // inherited all the way down — that is what lets a file four levels deep still say which
          // pipeline produced it.
          const pipeline = parent.pipeline ?? child.name
          const path = [...parent.path, child.name]
          folders.push({ id: child.id, name: child.name, path, pipeline })
          next.push({ id: child.id, path, pipeline })
          continue
        }

        documents.push({
          id: child.id,
          name: child.name,
          mimeType: child.mimeType,
          modifiedTime: child.modifiedTime ?? null,
          size: child.size ? Number(child.size) : null,
          webViewLink: child.webViewLink ?? null,
          folderId: parent.id,
          folderName: parent.path.length ? parent.path[parent.path.length - 1] : null,
          path: parent.path,
          pipeline: parent.pipeline,
        })
      }
    })

    level = next
    if (level.length > 0 && depth === MAX_DEPTH - 1) truncated = true
  }

  documents.sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""))

  const pipelines = folders
    .filter((f) => f.path.length === 1)
    .map((f) => ({ id: f.id, name: f.name, modifiedTime: null }))

  return { pipelines, documents, folders, truncated }
}

/**
 * A full walk is ~40 Drive calls, and every screen in this section needs the same tree.
 *
 * Cached in module memory for a minute: long enough that clicking between the overview, a pipeline
 * board and a document does not re-walk Drive each time, short enough that a pipeline run finishing
 * shows up while someone is still looking at the screen. Per-container and lost on restart, which is
 * the right lifetime for a cache of somebody else's data.
 */
const TREE_TTL_MS = 60_000
let cachedTree: { tree: DriveTree; expiresAt: number } | null = null

export async function getDriveTree(force = false): Promise<DriveTree> {
  const config = driveConfig()
  if (!config) return { pipelines: [], documents: [], folders: [], truncated: false }

  if (!force && cachedTree && Date.now() < cachedTree.expiresAt) {
    return cachedTree.tree
  }

  const tree = await walkTree(config.rootFolderId)
  cachedTree = { tree, expiresAt: Date.now() + TREE_TTL_MS }
  return tree
}

/**
 * Find a file by exact name anywhere the service account can see, root folder or not.
 *
 * Two of the pipelines' most valuable files — `master_index.csv` and `MASTER_CONTENT_INDEX.md`,
 * the 432-topic machine state — deliberately live outside the canonical root, in `claude-cowork/
 * Blog/`, because the migration could not move them losslessly. Hardcoding that folder's id here
 * would break the moment the outstanding migration finally happens.
 *
 * Searching by name instead means the file is found wherever it currently is, and keeps working
 * after it moves. It returns nothing (not an error) when the folder has not been shared with the
 * service account, which is the state today and which the UI reports as a setup step rather than
 * a failure.
 */
export async function findFilesByName(name: string): Promise<DriveDocument[]> {
  if (!isDriveConfigured()) return []

  const res = await driveFetch("/files", {
    q: `name = ${quote(name)} and trashed = false`,
    fields: FILE_FIELDS,
    pageSize: "20",
  })

  const data = (await res.json()) as { files?: RawFile[] }
  return (data.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime ?? null,
    size: f.size ? Number(f.size) : null,
    webViewLink: f.webViewLink ?? null,
    folderId: null,
    folderName: null,
    path: [],
    pipeline: null,
  }))
}

/** One file's metadata, for the viewer's header. */
export async function getDocumentMeta(fileId: string): Promise<DriveDocument | null> {
  try {
    const res = await driveFetch(`/files/${encodeURIComponent(fileId)}`, {
      fields: "id,name,mimeType,modifiedTime,size,webViewLink,parents",
    })
    const f = (await res.json()) as RawFile & { parents?: string[] }
    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime ?? null,
      size: f.size ? Number(f.size) : null,
      webViewLink: f.webViewLink ?? null,
      folderId: f.parents?.[0] ?? null,
      folderName: null,
      path: [],
      pipeline: null,
    }
  } catch (error) {
    if (error instanceof GoogleDriveError && error.message.includes("404")) return null
    throw error
  }
}

/**
 * Google-native files (Docs, Sheets, Slides) have no bytes to download — they must be exported to a
 * concrete format first. Everything else is fetched as it is stored.
 */
function exportMimeFor(mimeType: string): string | null {
  if (mimeType === "application/vnd.google-apps.document") return "text/markdown"
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "text/csv"
  if (mimeType === "application/vnd.google-apps.presentation") return "text/plain"
  return null
}

function isTextual(mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "application/x-yaml" ||
    mimeType === "application/yaml"
  )
}

/**
 * Frontmatter, if the pipeline wrote any.
 *
 * Entirely optional by design: a document without it renders the same, just without the filter
 * chips. Requiring it would mean OPS silently hiding the output of a pipeline that had not been
 * updated yet — the opposite of the point.
 */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  if (!match) return { meta: {}, body: raw }

  const meta: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim())
    if (!pair) continue
    const value = pair[2].trim().replace(/^["']|["']$/g, "")
    if (value) meta[pair[1].toLowerCase()] = value
  }

  return { meta, body: raw.slice(match[0].length) }
}

/**
 * Control documents are parsed on nearly every screen in this section, and they are the largest
 * files in the corpus (the formula library alone is 81 KB). Cached on the same one-minute clock as
 * the tree so the overview, the formula index and the topic board share one fetch.
 */
const CONTENT_TTL_MS = 60_000
const contentCache = new Map<string, { value: DriveDocumentContent; expiresAt: number }>()

/** The file's text, ready to render. */
export async function getDocumentContent(
  fileId: string,
  mimeType: string
): Promise<DriveDocumentContent> {
  const cached = contentCache.get(fileId)
  if (cached && Date.now() < cached.expiresAt) return cached.value

  const exportMime = exportMimeFor(mimeType)

  if (!exportMime && !isTextual(mimeType)) {
    return { text: "", meta: {}, unreadable: true }
  }

  const res = exportMime
    ? await driveFetch(`/files/${encodeURIComponent(fileId)}/export`, { mimeType: exportMime })
    : await driveFetch(`/files/${encodeURIComponent(fileId)}`, { alt: "media" })

  const raw = await res.text()
  const { meta, body } = parseFrontmatter(raw)
  const value: DriveDocumentContent = { text: body, meta, unreadable: false }

  contentCache.set(fileId, { value, expiresAt: Date.now() + CONTENT_TTL_MS })
  return value
}
