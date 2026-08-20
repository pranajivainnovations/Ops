import Link from "next/link"
import { notFound } from "next/navigation"

import {
  GoogleDriveError,
  getDocumentContent,
  getDocumentMeta,
  getDriveTree,
  isDriveConfigured,
} from "@/lib/google-drive"
import DocumentBody from "../../document-body"
import { formatDate, formatSize, mimeLabel, statusClass } from "../../format"

/**
 * One research document, read out of Drive and rendered in OPS.
 *
 * Reading here rather than bouncing to Drive is the whole point of the section: the team can scan
 * what the pipelines produced without leaving the tool, and without needing a Google account each.
 * The "Open in Drive" link stays, for commenting and for anything this renderer cannot show.
 */
export const dynamic = "force-dynamic"

/** Keys rendered as their own labelled chips; everything else in frontmatter becomes a plain chip. */
const PRIMARY_META = ["status", "pipeline", "subject", "date", "owner"]

export default async function ResearchDocumentPage({
  params,
}: {
  params: Promise<{ fileId: string }>
}) {
  const { fileId } = await params

  if (!isDriveConfigured()) notFound()

  const meta = await getDocumentMeta(fileId)
  if (!meta) notFound()

  let content: Awaited<ReturnType<typeof getDocumentContent>> | null = null
  let error: string | null = null

  try {
    content = await getDocumentContent(meta.id, meta.mimeType)
  } catch (e) {
    // A document that fails to export should still show its header and its Drive link — a dead
    // screen tells the reader nothing about what they were trying to open.
    error = e instanceof GoogleDriveError ? e.message : "Could not read this document."
    console.error("[documents] document read failed", e)
  }

  /**
   * The file carries a parent ID but not a parent name, so its place in the hierarchy is looked up
   * in the walked tree. Matching on the file's own id rather than its parent's is what makes this
   * work for a document four levels down: the tree already knows every file's full path and which
   * pipeline it belongs to, and the tree is cached, so this costs nothing.
   */
  const tree = await getDriveTree().catch(() => null)
  const inTree = tree?.documents.find((d) => d.id === meta.id) ?? null
  const pipelineName = inTree?.pipeline ?? null
  const folderPath = inTree?.path ?? []

  const frontmatter = content?.meta ?? {}
  const extraMeta = Object.entries(frontmatter).filter(
    ([key]) => !PRIMARY_META.includes(key) && key !== "summary" && key !== "tags"
  )
  const tags = (frontmatter.tags ?? "")
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <Link
          href={
            pipelineName
              ? `/pranajiva/documents?pipeline=${encodeURIComponent(pipelineName)}`
              : "/pranajiva/documents"
          }
          className="text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          ← {pipelineName ?? "All documents"}
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900">{meta.name}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {/* The full folder path, because "verification" exists under three pipelines and the
                  immediate parent alone would not say which document this is. */}
              {folderPath.length > 0 ? `${folderPath.join(" / ")} · ` : ""}
              {mimeLabel(meta.mimeType)} · Updated {formatDate(meta.modifiedTime)}
              {meta.size !== null ? ` · ${formatSize(meta.size)}` : ""}
            </p>
          </div>
          {meta.webViewLink && (
            <a
              href={meta.webViewLink}
              target="_blank"
              rel="noreferrer noopener"
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Open in Drive →
            </a>
          )}
        </div>

        {(frontmatter.status || tags.length > 0 || extraMeta.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {frontmatter.status && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusClass(
                  frontmatter.status
                )}`}
              >
                {frontmatter.status}
              </span>
            )}
            {extraMeta.map(([key, value]) => (
              <span
                key={key}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
              >
                {key}: {value}
              </span>
            ))}
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-800"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {frontmatter.summary && (
          <p className="mb-6 max-w-3xl border-l-2 border-slate-300 pl-4 text-sm leading-relaxed text-slate-600">
            {frontmatter.summary}
          </p>
        )}

        {error ? (
          <div className="max-w-2xl rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">Could not read this document</p>
            <p className="mt-1 text-xs text-red-800">{error}</p>
          </div>
        ) : content?.unreadable ? (
          <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-slate-900">
              This file is a {mimeLabel(meta.mimeType)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              OPS renders text documents — Google Docs, Markdown, plain text, CSV and JSON. This one
              has no text to show, so it opens in Drive instead.
            </p>
            {meta.webViewLink && (
              <a
                href={meta.webViewLink}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Open in Drive →
              </a>
            )}
          </div>
        ) : (
          <article className="rounded-xl border border-slate-200 bg-white px-6 py-5">
            <DocumentBody text={content?.text ?? ""} />
          </article>
        )}
      </div>
    </main>
  )
}
