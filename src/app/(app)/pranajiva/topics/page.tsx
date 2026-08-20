import Link from "next/link"

import { GoogleDriveError, isDriveConfigured } from "@/lib/google-drive"
import { loadDecisions } from "@/lib/pranajiva/decisions"
import { loadKnowledgeBase, type KnowledgeBase } from "@/lib/pranajiva/knowledge-base"
import { splitTopicTypes, type TopicRow } from "@/lib/pranajiva/parse"
import { DecisionControl } from "../_components/decision"
import { EmptyRow, SectionHeader, StatCard } from "../_components/section"
import { DriveErrorPanel, SetupPanel } from "../_components/setup"

/**
 * The content pipeline's 432 topics.
 *
 * Two very different screens depending on what Drive will give us. When master_index.csv is
 * reachable — it is, since it was moved into P02_CONTENT_ENGINE/topics on 2026-08-19 — this is a
 * working board: filter by chapter, priority, type, audience, pipeline status and OPS decision, and
 * pick what to write next. If it ever becomes unreachable again, it falls back to the summary counts
 * PIPELINE_STATUS publishes and says why, rather than showing an empty table that reads as "there
 * are no topics".
 *
 * Audience is the filter that earns its place: 314 of the 432 are consumer-relevant and 85 are
 * marked clinical/professional-only. Choosing a blog topic without that distinction is how you end
 * up drafting something that should never have been a blog.
 */
export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    chapter?: string
    priority?: string
    status?: string
    type?: string
    consumer?: string
    decided?: string
    page?: string
  }>
}) {
  const params = await searchParams

  if (!isDriveConfigured()) {
    return (
      <Shell>
        <SetupPanel />
      </Shell>
    )
  }

  let kb: KnowledgeBase | null = null
  let error: string | null = null

  try {
    kb = await loadKnowledgeBase()
  } catch (e) {
    error = e instanceof GoogleDriveError ? e.message : "Could not reach Google Drive."
    console.error("[pranajiva] topics load failed", e)
  }

  if (!kb) {
    return (
      <Shell>
        <DriveErrorPanel message={error ?? "Unknown error."} />
      </Shell>
    )
  }

  const index = kb.topics
  if (!index) {
    return (
      <Shell>
        <SummaryOnly kb={kb} />
      </Shell>
    )
  }

  const decisions = await loadDecisions("topic")

  const query = (params.q ?? "").trim().toLowerCase()
  const chapter = (params.chapter ?? "").trim()
  const priority = (params.priority ?? "").trim()
  const status = (params.status ?? "").trim()
  const type = (params.type ?? "").trim()
  const consumer = (params.consumer ?? "").trim()
  const decided = (params.decided ?? "").trim()
  const page = Math.max(1, Number(params.page ?? "1") || 1)

  const uniques = (pick: (t: TopicRow) => string | null) =>
    Array.from(new Set(index.topics.map(pick).filter((v): v is string => Boolean(v)))).sort()

  const chapters = uniques((t) => t.chapter)
  const priorities = uniques((t) => t.priority)
  const statuses = uniques((t) => t.status)
  // Compound cells split, so a topic tagged "FOUNDATION; HISTORICAL" is findable under either —
  // 122 raw values collapse to a list someone can actually pick from.
  const types = Array.from(
    new Set(index.topics.flatMap((t) => splitTopicTypes(t.topicType)))
  ).sort()

  const matching = index.topics.filter((topic) => {
    if (chapter && topic.chapter !== chapter) return false
    if (priority && topic.priority !== priority) return false
    if (status && topic.status !== status) return false
    if (type && !splitTopicTypes(topic.topicType).includes(type)) return false
    if (consumer && (topic.consumerRelevant ?? "").toUpperCase() !== consumer) return false
    if (decided === "yes" && !decisions.get(topic.key)?.status) return false
    if (decided === "no" && decisions.get(topic.key)?.status) return false
    if (query) {
      // The description is searched too: topic titles are terse, and "what did we have on ghee"
      // is answered by the one-line summary far more often than by the title.
      const haystack = [topic.title, topic.key, topic.description, topic.flags, topic.topicType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })

  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const visible = matching.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const hrefWith = (overrides: Record<string, string>) => {
    const next = new URLSearchParams()
    if (query) next.set("q", query)
    if (chapter) next.set("chapter", chapter)
    if (priority) next.set("priority", priority)
    if (status) next.set("status", status)
    if (type) next.set("type", type)
    if (consumer) next.set("consumer", consumer)
    if (decided) next.set("decided", decided)
    for (const [key, value] of Object.entries(overrides)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    const search = next.toString()
    return `/pranajiva/topics${search ? `?${search}` : ""}`
  }

  return (
    <Shell>
      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search topics…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
        <Select name="chapter" value={chapter} label="All chapters" options={chapters} />
        <Select name="priority" value={priority} label="All priorities" options={priorities} />
        <Select name="status" value={status} label="All statuses" options={statuses} />
        <Select name="type" value={type} label="All types" options={types} />
        <select
          name="consumer"
          defaultValue={consumer}
          aria-label="Consumer relevance"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="">Any audience</option>
          <option value="Y">Consumer relevant</option>
          <option value="N">Clinical only</option>
        </select>
        <select
          name="decided"
          defaultValue={decided}
          aria-label="OPS decision"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="">Any decision</option>
          <option value="yes">Decided</option>
          <option value="no">Not yet decided</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Filter
        </button>
      </form>

      <p className="text-xs text-slate-500">
        <span className="font-semibold tabular-nums text-slate-900">{matching.length}</span> of{" "}
        {index.topics.length} topics
        {pageCount > 1 && ` · page ${current} of ${pageCount}`}
        {matching.length !== index.topics.length && (
          <>
            {" · "}
            <Link href="/pranajiva/topics" className="underline underline-offset-2">
              clear filters
            </Link>
          </>
        )}
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Topic</th>
              <th className="px-4 py-2 font-semibold">Chapter</th>
              <th className="px-4 py-2 font-semibold">Priority</th>
              <th className="px-4 py-2 font-semibold">Pipeline</th>
              <th className="px-4 py-2 font-semibold">OPS decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((topic) => (
              <tr key={topic.key} className="align-top hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/pranajiva/topics/${encodeURIComponent(topic.key)}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {topic.title}
                  </Link>
                  {topic.description && (
                    <p className="mt-0.5 max-w-xl text-xs text-slate-500">{topic.description}</p>
                  )}
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] text-slate-400">{topic.key}</span>
                    {splitTopicTypes(topic.topicType).map((t) => (
                      <span
                        key={t}
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
                      >
                        {t}
                      </span>
                    ))}
                    {/* Clinical-only topics are marked, not hidden: they are still real corpus
                        entries, they are just not blog candidates. */}
                    {(topic.consumerRelevant ?? "").toUpperCase() === "N" && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        clinical only
                      </span>
                    )}
                  </p>
                  {topic.flags && (
                    <p className="mt-0.5 text-[11px] font-semibold text-amber-700">{topic.flags}</p>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">{topic.chapter ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{topic.priority ?? "—"}</td>
                <td className="px-4 py-2 text-xs">
                  <p className="text-slate-600">{topic.status ?? "—"}</p>
                  {/* Presence of the artefacts, not just the declared status — the two can disagree,
                      and the overview raises it as a gap when they do. */}
                  {(topic.evidencePack || topic.blog) && (
                    <p className="mt-0.5 flex flex-wrap gap-1">
                      {topic.evidencePack && (
                        <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800">
                          pack
                        </span>
                      )}
                      {topic.blog && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          blog
                        </span>
                      )}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2">
                  <DecisionControl
                    kind="topic"
                    subjectKey={topic.key}
                    decision={decisions.get(topic.key)}
                    returnTo={hrefWith({ page: String(current) })}
                  />
                </td>
              </tr>
            ))}
            {visible.length === 0 && <EmptyRow>No topics match these filters.</EmptyRow>}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <nav className="flex items-center justify-between text-xs">
          {current > 1 ? (
            <Link
              href={hrefWith({ page: String(current - 1) })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {current < pageCount ? (
            <Link
              href={hrefWith({ page: String(current + 1) })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </Shell>
  )
}

function Select({
  name,
  value,
  label,
  options,
}: {
  name: string
  value: string
  label: string
  options: string[]
}) {
  if (options.length === 0) return null
  return (
    <select
      name={name}
      defaultValue={value}
      aria-label={label}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

/**
 * What can be shown when the per-topic file is out of reach: the pipeline's published summary, plus
 * an honest account of what is missing and the one action that fixes it.
 *
 * Showing an empty table instead would be worse than useless — it would read as "there are no
 * topics", which is the opposite of true.
 */
function SummaryOnly({ kb }: { kb: KnowledgeBase }) {
  const content = kb.content

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900">
          The per-topic file is not shared with OPS
        </h2>
        <p className="mt-1 max-w-3xl text-xs text-slate-600">
          <code className="rounded bg-slate-100 px-1">master_index.csv</code> holds one row per topic
          with all 18 tracked fields. It sits in <code className="rounded bg-slate-100 px-1">claude-cowork/Blog/</code>,
          outside the research root, and the service account cannot see it — so this screen can show
          the pipeline&rsquo;s own totals but not the topics themselves. Share that folder as Viewer
          with the service account and the board fills in on the next load. Nothing else changes.
        </p>
      </div>

      {content && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {content.headline.map((row) => (
              <StatCard key={row.label} label={row.label} value={row.value} />
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {content.priorities.length > 0 && (
              <Breakdown title="By priority" rows={content.priorities} />
            )}
            {content.flags.length > 0 && <Breakdown title="Flagged" rows={content.flags} />}
            {content.attributes.length > 0 && (
              <Breakdown title="Content attributes" rows={content.attributes} />
            )}
          </div>
        </>
      )}

      {!content && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
          No PIPELINE_STATUS document was found either, so there is nothing to summarise.
        </p>
      )}
    </>
  )
}

function Breakdown({
  title,
  rows,
}: {
  title: string
  rows: { label: string; count: number; remaining?: number }[]
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <dl className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 text-xs">
            <dt className="min-w-0 text-slate-600">{row.label}</dt>
            <dd className="shrink-0 font-semibold tabular-nums text-slate-900">{row.count}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <SectionHeader
        title="Content topics"
        description="The 432 topics discovered across all 30 chapters of Sūtrasthāna by the P02 pipeline. Pipeline status comes from the corpus; the decision column is OPS's."
      />
      <div className="space-y-4 p-6">{children}</div>
    </main>
  )
}
