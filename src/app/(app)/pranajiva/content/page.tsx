import Link from "next/link"

import { GoogleDriveError } from "@/lib/google-drive"
import {
  hasArtifacts,
  loadKnowledgeBase,
  type KnowledgeBase,
  type TopicArtifact,
  type TopicArtifacts,
} from "@/lib/pranajiva/knowledge-base"
import { ledgerStageRank } from "@/lib/pranajiva/ledger"
import { DriveErrorPanel } from "../_components/setup"
import { SectionHeader, StatCard } from "../_components/section"
import { relativeTime } from "../../_components/drive-format"

/**
 * The production board — every topic the pipeline has actually started, and what exists for it.
 *
 * ── Why this is a separate screen from the topic board ─────────────────────────────────────────
 * /pranajiva/topics answers "which of the 432 topics should we write next", and it is a catalogue:
 * 432 rows, filtered by priority and flags, almost all of them untouched. This answers a different
 * question — "of the handful we have started, what is finished and what is half-done" — and the
 * answer is seven rows. Filtering a 432-row catalogue down to seven every time is not the same
 * screen, and neither view is improved by being both.
 *
 * ── Why the columns are what they are ──────────────────────────────────────────────────────────
 * A topic is not done when a blog exists. Since 2026-09-08 each one produces an evidence pack, an
 * English blog, a Hindi blog, and then reel packs in P05 built on top of the approved blog. Those
 * four are independent and routinely out of step — PJ-C08-T01 has a Hindi blog written on 8 Sep
 * sitting beside an English one from 27 Aug in the retired format, waiting on an explicit
 * `overwrite EN`. One "article" column cannot show that, and its absence is exactly what the team
 * needs to see.
 *
 * ── Files decide, the ledger annotates ─────────────────────────────────────────────────────────
 * The cells are matched from Drive, because the files are the fact — master_index's Blog Location
 * column is empty on all 432 rows while the blogs demonstrably exist. The ledger supplies what no
 * filename can: the corrected verse reference, whether a blog is current or retired format, and what
 * the pipeline is waiting for. Where they disagree, both are shown.
 */
export const dynamic = "force-dynamic"

export default async function ContentBoardPage() {
  let kb: KnowledgeBase | null = null
  let error: string | null = null

  try {
    kb = await loadKnowledgeBase()
  } catch (e) {
    error = e instanceof GoogleDriveError ? e.message : "Could not reach Google Drive."
    console.error("[pranajiva] content board load failed", e)
  }

  if (!kb) {
    return (
      <Shell>
        <DriveErrorPanel message={error ?? "Unknown error."} />
      </Shell>
    )
  }

  const started = Array.from(kb.topicArtifacts.entries())
    .filter(([, artifacts]) => hasArtifacts(artifacts))
    .map(([topicKey, artifacts]) => ({
      topicKey,
      artifacts,
      title: kb!.topics?.topics.find((t) => t.key === topicKey)?.title ?? topicKey,
      ledger: kb!.ledger?.rows.find((r) => r.topicKey === topicKey) ?? null,
    }))
    /**
     * Furthest along first, then by topic id.
     *
     * Sorting by last-modified would put whatever the pipeline touched most recently on top, which
     * on a board about completeness is the least useful order — the rows worth reading are the ones
     * closest to shipping and the ones stuck.
     */
    .sort(
      (a, b) =>
        ledgerStageRank(b.ledger?.stage ?? null) - ledgerStageRank(a.ledger?.stage ?? null) ||
        a.topicKey.localeCompare(b.topicKey)
    )

  const count = (pick: (a: TopicArtifacts) => boolean) =>
    started.filter((row) => pick(row.artifacts)).length

  const evidence = count((a) => Boolean(a.evidencePack))
  const blogsEn = count((a) => Boolean(a.blogEn))
  const blogsHi = count((a) => Boolean(a.blogHi))
  const legacy = count((a) => Boolean(a.blogLegacy) && !a.blogEn)
  const packs = started.reduce((sum, row) => sum + row.artifacts.videoPacks.length, 0)

  return (
    <Shell
      updated={kb.ledger?.lastUpdated ?? null}
      missingLedger={!kb.ledger}
    >
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Evidence packs"
          value={evidence}
          hint="The sourced record every blog is written from"
        />
        <StatCard
          label="English blogs"
          value={blogsEn}
          hint={
            legacy
              ? `${legacy} more in the retired format, awaiting rewrite`
              : "All in the current format"
          }
          tone={blogsEn ? "default" : "muted"}
        />
        <StatCard
          label="Hindi blogs"
          value={blogsHi}
          hint={
            blogsHi < blogsEn
              ? `${blogsEn - blogsHi} English blog${blogsEn - blogsHi === 1 ? "" : "s"} with no Hindi yet`
              : "Written natively, not translated"
          }
          tone={blogsHi ? "default" : "muted"}
        />
        <StatCard
          label="Reel packs"
          value={packs}
          hint="Five short-video scripts each, from P05"
          tone={packs ? "default" : "muted"}
        />
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Topics in production ({started.length})
          </h2>
          <Link
            href="/pranajiva/run-card"
            className="text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-900"
          >
            How to start one →
          </Link>
        </div>

        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Topic</th>
                <th className="px-3 py-2 font-semibold">Evidence</th>
                <th className="px-3 py-2 font-semibold">Blog EN</th>
                <th className="px-3 py-2 font-semibold">Blog HI</th>
                <th className="px-3 py-2 font-semibold">Reel pack</th>
                <th className="px-3 py-2 font-semibold">Stage</th>
              </tr>
            </thead>
            <tbody>
              {started.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-500">
                    Nothing has entered the pipeline yet. Say{" "}
                    <span className="font-mono font-semibold">run PJ-C12-T04</span> to start a topic.
                  </td>
                </tr>
              )}
              {started.map((row) => (
                <tr key={row.topicKey} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/pranajiva/topics/${encodeURIComponent(row.topicKey)}`}
                      className="text-sm font-semibold text-slate-900 underline underline-offset-2 hover:text-slate-600"
                    >
                      {row.title}
                    </Link>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">{row.topicKey}</p>
                    {row.ledger?.verseRef && (
                      <p className="mt-0.5 text-[11px] text-slate-500">{row.ledger.verseRef}</p>
                    )}
                  </td>
                  <Cell artifact={row.artifacts.evidencePack} />
                  <Cell
                    artifact={row.artifacts.blogEn ?? row.artifacts.blogLegacy}
                    note={
                      !row.artifacts.blogEn && row.artifacts.blogLegacy
                        ? "retired format"
                        : row.ledger?.blogEn.note ?? null
                    }
                    warn={!row.artifacts.blogEn && Boolean(row.artifacts.blogLegacy)}
                  />
                  <Cell artifact={row.artifacts.blogHi} note={row.ledger?.blogHi.note ?? null} />
                  <PackCell artifacts={row.artifacts} note={row.ledger?.videoPack.note ?? null} />
                  <td className="px-3 py-3">
                    <StagePill stage={row.ledger?.stage ?? null} artifacts={row.artifacts} />
                    {row.ledger?.updated && (
                      <p className="mt-1 text-[10px] text-slate-400">{row.ledger.updated}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Every cell is a file found in Drive, not a column read from the index — master_index&rsquo;s
          own location columns are empty on all 432 rows. The verse reference and any note come from{" "}
          <span className="font-mono">PIPELINE_LEDGER.md</span>, which is where the pipeline records
          its corrections.
        </p>
      </section>

      {kb.ledger && kb.ledger.counts.length > 0 && <LedgerCounts ledger={kb.ledger} />}
      {kb.ledger && kb.ledger.openItems.length > 0 && <OpenItems ledger={kb.ledger} />}
    </Shell>
  )
}

function Shell({
  children,
  updated,
  missingLedger,
}: {
  children: React.ReactNode
  updated?: string | null
  missingLedger?: boolean
}) {
  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <SectionHeader
        title="Content pipeline"
        description="What has actually been produced for each topic — the evidence pack, both blogs, and the reel packs built on top of them. Read from the files in Drive."
        action={
          updated ? (
            <p className="text-xs text-slate-400">Ledger updated {updated}</p>
          ) : undefined
        }
      />
      <div className="space-y-6 p-6">
        {missingLedger && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-700">
              PIPELINE_LEDGER.md was not found
            </p>
            <p className="mt-1 max-w-3xl text-xs text-slate-500">
              The board below still works — it is built from the files themselves. What is missing is
              the pipeline&rsquo;s own commentary: corrected verse references, which blogs are in the
              current format, and what each run is waiting for.
            </p>
          </div>
        )}
        {children}
      </div>
    </main>
  )
}

/**
 * One artifact cell.
 *
 * Shows the stage rather than the filename. The filename is the topic id plus the slug plus the
 * language, all three of which are already on the row — printing it in every cell would fill the
 * table with the same string five times and hide the one thing that differs.
 */
function Cell({
  artifact,
  note,
  warn = false,
}: {
  artifact: TopicArtifact | null
  note?: string | null
  warn?: boolean
}) {
  if (!artifact) {
    return (
      <td className="px-3 py-3">
        <span className="text-xs text-slate-300">—</span>
      </td>
    )
  }

  return (
    <td className="px-3 py-3">
      <Link
        href={`/pranajiva/documents/${artifact.id}`}
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold underline-offset-2 hover:underline ${
          warn ? "bg-amber-100 text-amber-800" : stageTone(artifact.stage)
        }`}
      >
        {artifact.stage}
      </Link>
      {note && <p className="mt-1 max-w-[11rem] text-[10px] leading-tight text-slate-500">{note}</p>}
      {artifact.modifiedTime && (
        <p className="mt-0.5 text-[10px] text-slate-400">{relativeTime(artifact.modifiedTime)}</p>
      )}
    </td>
  )
}

/**
 * The reel-pack cell, which is a list rather than a single file.
 *
 * The current standard is one pack per language; the single pack that predates it carries no
 * language suffix and is labelled by what it is rather than silently shown as though it were both.
 * The `_VO.json` / `_EDIT.json` render files are counted, not listed — they are handoff material for
 * whoever cuts the video, and listing them here would triple the apparent output.
 */
function PackCell({ artifacts, note }: { artifacts: TopicArtifacts; note?: string | null }) {
  if (artifacts.videoPacks.length === 0) {
    return (
      <td className="px-3 py-3">
        <span className="text-xs text-slate-300">—</span>
      </td>
    )
  }

  return (
    <td className="px-3 py-3">
      <div className="flex flex-col items-start gap-1">
        {artifacts.videoPacks.map((pack) => (
          <Link
            key={pack.id}
            href={`/pranajiva/documents/${pack.id}`}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold underline-offset-2 hover:underline ${stageTone(
              pack.stage
            )}`}
          >
            {pack.language ?? "no language"} · {pack.stage}
          </Link>
        ))}
      </div>
      {artifacts.renderFiles.length > 0 && (
        <p className="mt-1 text-[10px] text-slate-400">
          + {artifacts.renderFiles.length} render file
          {artifacts.renderFiles.length === 1 ? "" : "s"}
        </p>
      )}
      {note && <p className="mt-1 max-w-[11rem] text-[10px] leading-tight text-slate-500">{note}</p>}
    </td>
  )
}

/**
 * The ledger's stage, or the stage the files imply when the ledger has no row.
 *
 * The ledger itself sets the precedence: "stage is also structural — a file's folder IS its stage.
 * Where the two disagree, the folder wins and this file is corrected." So a topic with files and no
 * ledger row is not unknown, it is derivable, and saying "—" would be a worse answer than the one
 * the folders already give.
 */
function StagePill({
  stage,
  artifacts,
}: {
  stage: string | null
  artifacts: TopicArtifacts
}) {
  const derived = (() => {
    if (artifacts.videoPacks.length) return "PACK_DRAFT"
    if (artifacts.blogEn || artifacts.blogHi || artifacts.blogLegacy) return "BLOG_DRAFT"
    if (artifacts.evidencePack) return "EVIDENCE"
    return null
  })()

  const value = stage ?? derived
  if (!value) return <span className="text-xs text-slate-300">—</span>

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
        {value}
      </span>
      {!stage && <span className="text-[10px] text-slate-400">from the folders</span>}
    </span>
  )
}

const STAGE_TONE: Record<string, string> = {
  drafts: "bg-slate-100 text-slate-700",
  review: "bg-sky-100 text-sky-800",
  approved: "bg-emerald-100 text-emerald-800",
  published: "bg-emerald-600 text-white",
}

function stageTone(stage: string): string {
  return STAGE_TONE[stage.toLowerCase()] ?? "bg-slate-100 text-slate-700"
}

function LedgerCounts({ ledger }: { ledger: NonNullable<KnowledgeBase["ledger"]> }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
        What the pipeline reports
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        The ledger&rsquo;s own tally, shown as written. The counts above are recounted from Drive, so
        a difference between the two means the ledger was not updated after the last run.
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {ledger.counts.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 text-xs">
            <dt className="min-w-0 truncate text-slate-600">{row.label}</dt>
            <dd className="shrink-0 font-semibold text-slate-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * The pipeline's own unresolved questions.
 *
 * These are written by the agents against themselves — an unverified verse, a voice engine that no
 * longer suits the format, a source map with a known page error. They are the most decision-shaped
 * content in the whole corpus and until now lived only inside a Markdown file nobody opens.
 */
function OpenItems({ ledger }: { ledger: NonNullable<KnowledgeBase["ledger"]> }) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-amber-800">
        Open items ({ledger.openItems.length})
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {ledger.openItems.map((item) => (
          <li key={item.title}>
            <p className="text-sm font-semibold text-amber-900">{item.title}</p>
            {item.detail && (
              <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-amber-800">
                {item.detail}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
