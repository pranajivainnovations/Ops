import Link from "next/link"

import {
  GoogleDriveError,
  driveConfig,
  getDriveTree,
  isDriveConfigured,
  type DriveTree,
} from "@/lib/google-drive"
import RecordCard, { CardList, TableWrap } from "../_components/record-card"
import { formatSize, mimeLabel, relativeTime } from "../_components/drive-format"
import { DriveErrorPanel, SetupPanel, stageLabel, stageSort } from "./_components"

/**
 * Everything the CrossFriend pipelines have written to Drive.
 *
 * ── Why this is a reading surface and not a link to Drive ──────────────────────────────────────
 * The same reason the Pranajiva section exists: the artefacts are generated faster than anyone
 * opens them, and a folder of Markdown files in Drive is somewhere people go once. Reading them
 * where the rest of the operational picture already lives is the difference between output that
 * gets used and output that gets produced. It also means the team can read them without each
 * needing a Google account on the folder.
 *
 * ── Why the stages are ordered and not alphabetical ────────────────────────────────────────────
 * CROSSFRIEND_MARKETING is numbered — 00_CONTROL through 06_REPORTS — because it is a pipeline, not
 * a filing cabinet. That order is real information about where work sits, so the chips follow it.
 * Pranajiva's equivalent screen sorts by name because its top-level folders are parallel pipelines
 * with no sequence between them; copying that here would throw away something true.
 *
 * Read-only, like the whole Drive integration. This app cannot modify an artefact.
 */
export const dynamic = "force-dynamic"

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; q?: string }>
}) {
  const params = await searchParams
  const stage = (params.stage ?? "").trim()
  const query = (params.q ?? "").trim().toLowerCase()

  const config = driveConfig("crossfriend")

  if (!isDriveConfigured("crossfriend")) {
    return (
      <Shell>
        <SetupPanel />
      </Shell>
    )
  }

  let tree: DriveTree | null = null
  let error: string | null = null

  try {
    tree = await getDriveTree("crossfriend")
  } catch (e) {
    error = e instanceof GoogleDriveError ? e.message : "Could not reach Google Drive."
    console.error("[documents] tree load failed", e)
  }

  if (!tree) {
    return (
      <Shell>
        <DriveErrorPanel message={error ?? "Unknown error."} />
      </Shell>
    )
  }

  const stages = tree.folders
    .filter((f) => f.path.length === 1)
    .map((f) => f.name)
    .sort(stageSort)

  const visible = tree.documents.filter((doc) => {
    if (stage && doc.pipeline !== stage) return false
    if (query && !doc.name.toLowerCase().includes(query)) return false
    return true
  })

  const chipHref = (name: string) => {
    const next = new URLSearchParams()
    if (name) next.set("stage", name)
    if (query) next.set("q", query)
    const search = next.toString()
    return `/documents${search ? `?${search}` : ""}`
  }

  const countIn = (name: string) => tree!.documents.filter((d) => d.pipeline === name).length

  return (
    <Shell
      action={
        config && (
          <a
            href={`https://drive.google.com/drive/folders/${config.rootFolderId}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Open in Drive ↗
          </a>
        )
      }
    >
      <div className="flex flex-wrap gap-1.5">
        <Chip href={chipHref("")} active={!stage}>
          All ({tree.documents.length})
        </Chip>
        {stages.map((name) => (
          <Chip key={name} href={chipHref(name)} active={stage === name}>
            {stageLabel(name)} ({countIn(name)})
          </Chip>
        ))}
      </div>

      <form method="get" className="flex gap-2">
        {stage && <input type="hidden" name="stage" value={stage} />}
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search document names…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Search
        </button>
      </form>

      {tree.truncated && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          The folder tree is deeper than this app walks, so some documents may be missing from this
          list. They are still in Drive.
        </p>
      )}

      <CardList>
        {visible.map((doc) => (
          <RecordCard
            key={doc.id}
            title={doc.name}
            subtitle={doc.path.map(stageLabel).join(" / ") || "Root"}
            href={`/documents/${doc.id}`}
            linkLabel="Read"
            fields={[
              { label: "Type", value: mimeLabel(doc.mimeType) },
              { label: "Updated", value: relativeTime(doc.modifiedTime) },
              { label: "Size", value: formatSize(doc.size) },
            ]}
          />
        ))}
        {visible.length === 0 && <NothingMatched tree={tree} />}
      </CardList>

      <TableWrap>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Document</th>
              <th className="px-4 py-2 font-semibold">Folder</th>
              <th className="px-4 py-2 font-semibold">Type</th>
              <th className="px-4 py-2 font-semibold">Updated</th>
              <th className="px-4 py-2 font-semibold">Size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {doc.name}
                  </Link>
                </td>
                {/* The full path, not just the immediate parent: a folder called "drafts" can sit
                    under three different stages, and the parent alone would not say which. */}
                <td className="px-4 py-2 text-xs text-slate-500">
                  {doc.path.map(stageLabel).join(" / ") || "Root"}
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">{mimeLabel(doc.mimeType)}</td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {relativeTime(doc.modifiedTime)}
                </td>
                <td className="px-4 py-2 text-xs tabular-nums text-slate-600">
                  {formatSize(doc.size)}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={99} className="px-4 py-8">
                  <NothingMatched tree={tree} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>

      <EmptyFolders tree={tree} stage={stage} />
    </Shell>
  )
}

/**
 * An empty result has two very different causes, and saying which is the whole value of this block.
 *
 * "Your search matched nothing" is a dead end the reader can back out of. "The folder is connected
 * but nothing has been written to it" is a fact about the work, and the reader should stop looking.
 */
function NothingMatched({ tree }: { tree: DriveTree }) {
  const empty = tree.documents.length === 0

  return (
    <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
      {empty
        ? "The folder is connected and readable, but nothing has been written to it yet."
        : "No documents match."}
    </p>
  )
}

/**
 * Folders with nothing in them, listed separately.
 *
 * These are the pipeline's declared structure standing ready for output that has not been produced.
 * Seeing them is how you tell "this stage has not run" from "this stage does not exist" — and on a
 * pipeline this new, most of the shape is still empty, which is itself the honest status.
 */
function EmptyFolders({ tree, stage }: { tree: DriveTree; stage: string }) {
  const empty = tree.folders.filter((folder) => {
    if (stage && folder.pipeline !== stage) return false
    const hasFiles = tree.documents.some((d) => d.folderId === folder.id)
    const hasChildren = tree.folders.some(
      (f) =>
        f.path.length === folder.path.length + 1 &&
        f.path.slice(0, folder.path.length).join("/") === folder.path.join("/")
    )
    return !hasFiles && !hasChildren
  })

  if (empty.length === 0) return null

  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
        Waiting for output ({empty.length})
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Folders the pipeline has created but not yet written to.
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {empty
          .slice()
          .sort((a, b) => stageSort(a.path.join("/"), b.path.join("/")))
          .map((folder) => (
            <li
              key={folder.id}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-500"
              title={folder.path.join(" / ")}
            >
              {folder.path.join("/")}
            </li>
          ))}
      </ul>
    </section>
  )
}

function Chip({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </Link>
  )
}

function Shell({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">Documents</h1>
            <p className="mt-1 max-w-3xl text-xs text-slate-500">
              The CrossFriend strategy, content and campaign artefacts, read live from Drive and
              walked through every subfolder. Read-only — this app cannot change a document.
            </p>
          </div>
          {action}
        </div>
      </header>
      <div className="space-y-4 p-6">{children}</div>
    </main>
  )
}
