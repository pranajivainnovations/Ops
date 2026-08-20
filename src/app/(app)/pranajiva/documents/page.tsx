import Link from "next/link"

import {
  GoogleDriveError,
  driveConfig,
  getDriveTree,
  isDriveConfigured,
  type DriveTree,
} from "@/lib/google-drive"
import RecordCard, { CardList, TableWrap } from "../../_components/record-card"
import { EmptyRow, SectionHeader } from "../_components/section"
import { DriveErrorPanel, SetupPanel } from "../_components/setup"
import { formatSize, mimeLabel, relativeTime } from "../format"

/**
 * Every document in the knowledge base, whatever shape it is in.
 *
 * This is the generic fallback beneath the four purpose-built screens: a pipeline OPS knows nothing
 * about still appears here, in its own folders, readable. That is what keeps the rest of the section
 * from being a hardcoded list of pipelines — a fifth one shows up by existing, and only gains a
 * bespoke view if someone decides it deserves one.
 *
 * Folders are shown even when empty. An empty `blogs/drafts` is a fact about the pipeline's progress,
 * and hiding it would make a pipeline that has produced nothing look identical to one that does not
 * exist.
 */
export const dynamic = "force-dynamic"

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string; q?: string }>
}) {
  const params = await searchParams
  const pipeline = (params.pipeline ?? "").trim()
  const query = (params.q ?? "").trim().toLowerCase()

  const config = driveConfig()

  if (!isDriveConfigured()) {
    return (
      <Shell>
        <SetupPanel />
      </Shell>
    )
  }

  let tree: DriveTree | null = null
  let error: string | null = null

  try {
    tree = await getDriveTree()
  } catch (e) {
    error = e instanceof GoogleDriveError ? e.message : "Could not reach Google Drive."
    console.error("[pranajiva] document tree load failed", e)
  }

  if (!tree) {
    return (
      <Shell>
        <DriveErrorPanel message={error ?? "Unknown error."} />
      </Shell>
    )
  }

  const pipelines = tree.folders.filter((f) => f.path.length === 1)

  const visible = tree.documents.filter((doc) => {
    if (pipeline && doc.pipeline !== pipeline) return false
    if (query && !doc.name.toLowerCase().includes(query)) return false
    return true
  })

  const chipHref = (name: string) => {
    const next = new URLSearchParams()
    if (name) next.set("pipeline", name)
    if (query) next.set("q", query)
    const search = next.toString()
    return `/pranajiva/documents${search ? `?${search}` : ""}`
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
        <Chip href={chipHref("")} active={!pipeline}>
          All ({tree.documents.length})
        </Chip>
        {pipelines.map((folder) => (
          <Chip key={folder.id} href={chipHref(folder.name)} active={pipeline === folder.name}>
            {folder.name} ({countIn(folder.name)})
          </Chip>
        ))}
      </div>

      <form method="get" className="flex gap-2">
        {pipeline && <input type="hidden" name="pipeline" value={pipeline} />}
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
            subtitle={doc.path.join(" / ") || "Root"}
            href={`/pranajiva/documents/${doc.id}`}
            linkLabel="Read"
            fields={[
              { label: "Type", value: mimeLabel(doc.mimeType) },
              { label: "Updated", value: relativeTime(doc.modifiedTime) },
              { label: "Size", value: formatSize(doc.size) },
            ]}
          />
        ))}
        {visible.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
            No documents match.
          </p>
        )}
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
                    href={`/pranajiva/documents/${doc.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {doc.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {/* The full path, not just the immediate parent: "verification" appears under three
                      different pipelines, and the parent alone would not say which. */}
                  {doc.path.join(" / ") || "Root"}
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">{mimeLabel(doc.mimeType)}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{relativeTime(doc.modifiedTime)}</td>
                <td className="px-4 py-2 text-xs tabular-nums text-slate-600">
                  {formatSize(doc.size)}
                </td>
              </tr>
            ))}
            {visible.length === 0 && <EmptyRow>No documents match.</EmptyRow>}
          </tbody>
        </table>
      </TableWrap>

      <EmptyFolders tree={tree} pipeline={pipeline} />
    </Shell>
  )
}

/**
 * Folders with nothing in them, listed separately.
 *
 * These are the pipeline's declared structure — `evidence_packs`, `blogs/drafts`, `source_library` —
 * standing ready for output that has not been produced. Seeing them is how you tell "this pipeline
 * has not run" from "this pipeline does not have that stage".
 */
function EmptyFolders({ tree, pipeline }: { tree: DriveTree; pipeline: string }) {
  const empty = tree.folders.filter((folder) => {
    if (pipeline && folder.pipeline !== pipeline) return false
    if (folder.path.length < 2) return false
    const hasFiles = tree.documents.some((d) => d.folderId === folder.id)
    const hasChildren = tree.folders.some((f) => f.path.length === folder.path.length + 1 && f.path.slice(0, folder.path.length).join("/") === folder.path.join("/"))
    return !hasFiles && !hasChildren
  })

  if (empty.length === 0) return null

  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
        Waiting for output ({empty.length})
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Folders the pipelines have created but not yet written to.
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {empty.map((folder) => (
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
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
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
      <SectionHeader
        title="All documents"
        description="Everything the research pipelines have written to Drive, walked recursively through every subfolder. Read-only — this app cannot modify a research document."
        action={action}
      />
      <div className="space-y-4 p-6">{children}</div>
    </main>
  )
}
