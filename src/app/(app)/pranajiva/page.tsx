import Link from "next/link"

import { GoogleDriveError, driveConfig, isDriveConfigured } from "@/lib/google-drive"
import { countDecisions, decisionsSchemaReady } from "@/lib/pranajiva/decisions"
import { classifyProductStatus } from "@/lib/pranajiva/parse"
import {
  loadKnowledgeBase,
  stageRank,
  type Gap,
  type KnowledgeBase,
} from "@/lib/pranajiva/knowledge-base"
import { SectionHeader, StatCard } from "./_components/section"
import { DriveErrorPanel, MigrationPendingPanel, SetupPanel } from "./_components/setup"
import { relativeTime } from "./format"

/**
 * The Pranajiva research overview.
 *
 * Deliberately not a file list. The corpus is 21 documents, and knowing their names tells the team
 * nothing — the work is "432 topics discovered, none researched" and "14 product concepts queued".
 * That state already exists inside the pipelines' own control documents; this reads it out and puts
 * it on one screen.
 */
export const dynamic = "force-dynamic"

export default async function PranajivaOverview() {
  const config = driveConfig()

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
    console.error("[pranajiva] overview load failed", e)
  }

  if (!kb) {
    return (
      <Shell>
        <DriveErrorPanel message={error ?? "Unknown error."} />
      </Shell>
    )
  }

  const [decisionsReady, formulaDecisions, productDecisions, topicDecisions] = await Promise.all([
    decisionsSchemaReady(),
    countDecisions("formula"),
    countDecisions("product"),
    countDecisions("topic"),
  ])

  const decided = (counts: Map<string, number>) =>
    Array.from(counts.values()).reduce((sum, n) => sum + n, 0)

  const topicTotal =
    kb.topics?.topics.length ??
    kb.content?.headline.find((row) => /topics discovered/i.test(row.label))?.count ??
    null

  const productsQueued = kb.products.filter((p) => classifyProductStatus(p.status) === "queued").length
  const nextProduct = kb.products
    .filter((p) => classifyProductStatus(p.status) === "queued" && p.researchOrder !== null)
    .sort((a, b) => (a.researchOrder ?? 0) - (b.researchOrder ?? 0))[0]

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
      {!decisionsReady && <MigrationPendingPanel />}
      {kb.gaps.length > 0 && <GapList gaps={kb.gaps} />}

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Corpus</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Content topics"
            value={topicTotal ?? "—"}
            hint={
              kb.topics
                ? `${decided(topicDecisions)} decided in OPS`
                : "Per-topic state not shared yet"
            }
            href="/pranajiva/topics"
            tone={topicTotal ? "default" : "muted"}
          />
          <StatCard
            label="Classical formulas"
            value={kb.formulas.length || "—"}
            hint={
              kb.formulas.length
                ? `${decided(formulaDecisions)} decided in OPS`
                : "Formula library not found"
            }
            href="/pranajiva/formulas"
            tone={kb.formulas.length ? "default" : "muted"}
          />
          <StatCard
            label="Product concepts"
            value={kb.products.length || "—"}
            hint={
              kb.products.length
                ? `${productsQueued} still to research · ${decided(productDecisions)} decided`
                : "Portfolio sheet not found"
            }
            href="/pranajiva/products"
            tone={kb.products.length ? "default" : "muted"}
          />
          <StatCard
            label="Documents"
            value={kb.tree.documents.length}
            hint={`across ${kb.tree.folders.length} folders`}
            href="/pranajiva/documents"
          />
        </div>
      </section>

      {nextProduct && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Next in the research queue
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {nextProduct.researchOrder}. {nextProduct.name}
          </p>
          {nextProduct.evolved && (
            <p className="mt-1 max-w-3xl text-xs text-slate-600">{nextProduct.evolved}</p>
          )}
          <Link
            href="/pranajiva/products"
            className="mt-2 inline-block text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-900"
          >
            See the whole portfolio →
          </Link>
        </section>
      )}

      <EditorialPanel kb={kb} />

      {kb.content && <ContentPipelinePanel state={kb.content} />}

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Pipelines</h2>
        <p className="mt-1 text-xs text-slate-500">
          Every top-level folder under the research root, discovered on load. A new pipeline appears
          here by existing in Drive.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kb.pipelines.map((pipeline) => (
            <Link
              key={pipeline.id}
              href={`/pranajiva/documents?pipeline=${encodeURIComponent(pipeline.name)}`}
              className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
            >
              <p className="text-sm font-bold text-slate-900">{pipeline.label}</p>
              <p className="mt-0.5 font-mono text-[10px] text-slate-400">{pipeline.name}</p>
              <p className="mt-2 text-xs text-slate-600">
                {pipeline.documentCount === 0 ? (
                  <span className="text-slate-400">No documents yet</span>
                ) : (
                  <>
                    <span className="font-semibold tabular-nums">{pipeline.documentCount}</span>{" "}
                    document{pipeline.documentCount === 1 ? "" : "s"} in{" "}
                    <span className="tabular-nums">{pipeline.folderCount}</span> folder
                    {pipeline.folderCount === 1 ? "" : "s"}
                  </>
                )}
              </p>
              {pipeline.lastActivity && (
                <p className="mt-1 text-[11px] text-slate-400">
                  Last output {relativeTime(pipeline.lastActivity)}
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>
    </Shell>
  )
}

function Shell({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <SectionHeader
        title="Research"
        description="The Ayurveda knowledge base produced by the Cowork pipelines, read live from Google Drive. Drive owns the research; OPS owns the decisions made about it."
        action={action}
      />
      <div className="space-y-6 p-6">{children}</div>
    </main>
  )
}

/**
 * Problems the corpus admits to, computed by comparing what the documents claim against what Drive
 * actually contains. Placed above everything else because a stale index is worth more of the team's
 * attention than a count that has not moved.
 */
function GapList({ gaps }: { gaps: Gap[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Needs attention</h2>
      {gaps.map((gap, index) => (
        <div
          key={index}
          className={`rounded-xl border p-4 ${
            gap.severity === "warning"
              ? "border-amber-200 bg-amber-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <p
            className={`text-sm font-bold ${
              gap.severity === "warning" ? "text-amber-900" : "text-slate-900"
            }`}
          >
            {gap.title}
          </p>
          <p
            className={`mt-1 max-w-3xl text-xs ${
              gap.severity === "warning" ? "text-amber-800" : "text-slate-600"
            }`}
          >
            {gap.detail}
          </p>
          {gap.href && (
            <Link
              href={gap.href}
              className="mt-2 inline-block text-xs font-semibold underline underline-offset-2 opacity-80 hover:opacity-100"
            >
              {gap.hrefLabel ?? "Open"} →
            </Link>
          )}
        </div>
      ))}
    </section>
  )
}

/**
 * Articles the pipeline has actually produced, grouped by the folder they sit in.
 *
 * Counted from files in Drive rather than from the topic index, whose Blog Location column is empty
 * on every row — an article exists today and the index does not know about it. The folder is the
 * status, so moving a file from drafts to review in Drive moves it here with no other change.
 *
 * Renders nothing when no article has been written yet, rather than a row of zeros: an empty
 * editorial pipeline is already said by "0 blogs" in the content panel below.
 */
function EditorialPanel({ kb }: { kb: KnowledgeBase }) {
  const articles = Array.from(kb.topicArtifacts.entries())
    .map(([topicKey, artifacts]) => ({ topicKey, article: artifacts.article }))
    .filter((entry): entry is { topicKey: string; article: NonNullable<typeof entry.article> } =>
      Boolean(entry.article)
    )

  if (articles.length === 0) return null

  const byStage = new Map<string, typeof articles>()
  for (const entry of articles) {
    const list = byStage.get(entry.article.stage) ?? []
    list.push(entry)
    byStage.set(entry.article.stage, list)
  }

  const stages = Array.from(byStage.entries()).sort(
    ([a], [b]) => stageRank(a) - stageRank(b) || a.localeCompare(b)
  )

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
        Articles written ({articles.length})
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Grouped by the folder each one sits in — that is how the pipeline records editorial stage.
      </p>

      <div className="mt-3 space-y-3">
        {stages.map(([stage, entries]) => (
          <div key={stage}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              {stage} ({entries.length})
            </p>
            <ul className="mt-1 space-y-0.5">
              {entries.map((entry) => (
                <li key={entry.article.id} className="text-xs">
                  <Link
                    href={`/pranajiva/documents/${entry.article.id}`}
                    className="text-slate-700 underline underline-offset-2 hover:text-slate-900"
                  >
                    {entry.article.name}
                  </Link>
                  <Link
                    href={`/pranajiva/topics/${encodeURIComponent(entry.topicKey)}`}
                    className="ml-2 font-mono text-[10px] text-slate-400 hover:text-slate-600"
                  >
                    {entry.topicKey}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function ContentPipelinePanel({
  state,
}: {
  state: NonNullable<KnowledgeBase["content"]>
}) {
  const hasBreakdown = state.priorities.length > 0 || state.flags.length > 0
  if (!hasBreakdown && state.headline.length === 0) return null

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Content pipeline
        </h2>
        {state.phase && <p className="text-xs text-slate-500">{state.phase}</p>}
      </div>

      {state.workflow.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
          {state.workflow.map((step, index) => (
            <span key={step} className="flex items-center gap-1">
              {index > 0 && <span className="text-slate-300">→</span>}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
                {step}
              </span>
            </span>
          ))}
        </p>
      )}

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {state.priorities.length > 0 && (
          <CountTable title="By priority" rows={state.priorities} />
        )}
        {state.flags.length > 0 && <CountTable title="Flagged" rows={state.flags} />}
      </div>

      {state.lastUpdated && (
        <p className="mt-3 text-[11px] text-slate-400">
          Pipeline status last updated {state.lastUpdated}
        </p>
      )}
    </section>
  )
}

function CountTable({
  title,
  rows,
}: {
  title: string
  rows: { label: string; count: number; remaining?: number }[]
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <dl className="mt-1.5 space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 text-xs">
            <dt className="min-w-0 truncate text-slate-600">{row.label}</dt>
            <dd className="shrink-0 font-semibold tabular-nums text-slate-900">
              {row.count}
              {row.remaining !== undefined && row.remaining !== row.count && (
                <span className="ml-1 font-normal text-slate-400">({row.remaining} left)</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
