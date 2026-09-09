import Link from "next/link"
import { notFound } from "next/navigation"

import { coworkCommandsFor } from "@/lib/pranajiva/cowork"
import { loadDecisions } from "@/lib/pranajiva/decisions"
import { loadKnowledgeBase, type TopicArtifact } from "@/lib/pranajiva/knowledge-base"
import { splitTopicTypes } from "@/lib/pranajiva/parse"
import BackLink from "../../../_components/back-link"
import CopyField from "../../_components/copy-field"
import { DecisionControl } from "../../_components/decision"
import { SectionHeader } from "../../_components/section"

/**
 * One topic, and what to do about it.
 *
 * The board answers "which topic next"; this answers "right, now start it". Those are two different
 * moments, and the second one needs the corpus's full record plus the exact string to hand Cowork —
 * neither of which fits in a table row.
 *
 * notFound() is called in the page component only, never in generateMetadata: metadata resolves
 * after the response status is committed, so notFound() there renders the 404 body under a 200
 * status line.
 */
export const dynamic = "force-dynamic"

export default async function TopicDetail({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const topicKey = decodeURIComponent(key)

  const kb = await loadKnowledgeBase()
  const topic = kb.topics?.topics.find((t) => t.key === topicKey)
  if (!topic) notFound()

  const decisions = await loadDecisions("topic")
  const decision = decisions.get(topic.key)
  const commands = coworkCommandsFor(topic.key)
  const artifacts = kb.topicArtifacts.get(topic.key)
  /**
   * The pipeline's own row for this topic, when it has one.
   *
   * Worth reading even though the files above are the fact: the index's verse reference is
   * provisional and has been corrected for several topics during verification, and only the ledger
   * records the correction. PJ-C01-T05's index entry says 1.5.5-6.5; the verified reference is 1.6.
   */
  const ledgerRow = kb.ledger?.rows.find((row) => row.topicKey === topic.key) ?? null

  /**
   * Columns this page does not model explicitly, shown as-is.
   *
   * The index has 19 columns and this screen names about a dozen; dropping the rest would quietly
   * hide fields the pipeline may add later. Anything already displayed above is filtered out so it
   * is not printed twice.
   */
  const shown = new Set([
    "Topic ID",
    "Topic Name",
    "Chapter Number",
    "Chapter Name",
    "Topic Type",
    "Short Description",
    "Priority",
    "Status",
    "Flags",
    "Consumer Relevant",
    "Evidence Strength",
  ])
  const extra = Object.entries(topic.raw).filter(([column]) => !shown.has(column))

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <SectionHeader
        title={topic.title}
        description={`${topic.key}${topic.chapter ? ` · Chapter ${topic.chapter}` : ""}`}
      />

      <div className="space-y-5 p-6">
        <BackLink fallbackHref="/pranajiva/topics" label="All topics" />

        {topic.description && (
          <p className="max-w-3xl border-l-2 border-slate-300 pl-4 text-sm leading-relaxed text-slate-600">
            {topic.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {topic.priority && <Chip tone="slate">{topic.priority}</Chip>}
          {topic.status && <Chip tone="teal">{topic.status}</Chip>}
          {splitTopicTypes(topic.topicType).map((type) => (
            <Chip key={type} tone="slate">
              {type}
            </Chip>
          ))}
          {(topic.consumerRelevant ?? "").toUpperCase() === "N" && (
            <Chip tone="amber">Clinical / professional only</Chip>
          )}
          {topic.flags && <Chip tone="amber">{topic.flags}</Chip>}
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Decision</h2>
          <p className="mt-1 text-xs text-slate-500">
            Recorded in OPS. The topic index in Drive stays exactly as the pipeline wrote it.
          </p>
          <div className="mt-3">
            <DecisionControl
              kind="topic"
              subjectKey={topic.key}
              decision={decision}
              returnTo={`/pranajiva/topics/${encodeURIComponent(topic.key)}`}
              withNote
            />
          </div>
          {decision?.decidedBy && (
            <p className="mt-2 text-[11px] text-slate-400">
              Last changed by {decision.decidedBy} on{" "}
              {decision.decidedAt.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Hand it to Cowork
          </h2>
          <p className="mt-1 max-w-3xl text-xs text-slate-500">
            OPS cannot start a pipeline run — Cowork is driven by typing into a session, and there is
            no endpoint to call. Copy one of these into Cowork instead. Output lands back in Drive and
            appears here on the next load.
          </p>

          <div className="mt-3 space-y-3">
            {commands.map((entry) => (
              <div key={entry.command}>
                <p className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                  {entry.effect}
                  {entry.writes ? (
                    <Chip tone="teal">writes to Drive</Chip>
                  ) : (
                    <Chip tone="slate">read only</Chip>
                  )}
                </p>
                <CopyField value={entry.command} label={entry.command} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Corpus record
          </h2>
          <dl className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
            <Row label="Topic ID" value={topic.key} mono />
            <Row label="Chapter" value={topic.chapter} />
            {ledgerRow?.verseRef && <Row label="Verse reference" value={ledgerRow.verseRef} />}
            {ledgerRow?.stage && (
              <Row
                label="Pipeline stage"
                value={`${ledgerRow.stage}${ledgerRow.updated ? ` · ${ledgerRow.updated}` : ""}`}
                mono
              />
            )}
            <Row label="Evidence strength" value={topic.evidenceStrength} />
            <Row
              label="Audience"
              value={
                topic.consumerRelevant
                  ? topic.consumerRelevant.toUpperCase() === "Y"
                    ? "Consumer relevant"
                    : "Clinical / professional only"
                  : null
              }
            />
            <ArtifactRow
              label="Evidence Pack"
              artifact={artifacts?.evidencePack ?? null}
              missing="Not built yet"
            />
            <ArtifactRow
              label="Blog — English"
              artifact={artifacts?.blogEn ?? null}
              missing={artifacts?.blogLegacy ? "Only the retired format exists" : "Not written yet"}
            />
            <ArtifactRow
              label="Blog — Hindi"
              artifact={artifacts?.blogHi ?? null}
              missing="Not written yet"
            />
            {/* Shown only when one exists. An unsuffixed blog is not an English blog that forgot its
                label — the ledger records it as the pre-2026-09-08 scholarly format, awaiting an
                explicit `overwrite EN`. Folding it into the English row would make the topic look
                finished while both current-format blogs are still outstanding. */}
            {artifacts?.blogLegacy && (
              <ArtifactRow
                label="Earlier draft"
                artifact={artifacts.blogLegacy}
                missing=""
                note="Written before the English/Hindi split, in the retired scholarly format. The pipeline will not replace it without an explicit overwrite EN."
              />
            )}
            <ArtifactListRow
              label="Reel packs"
              artifacts={artifacts?.videoPacks ?? []}
              missing="No video scripts yet"
            />
            {(artifacts?.renderFiles.length ?? 0) > 0 && (
              <ArtifactListRow
                label="Render files"
                artifacts={artifacts!.renderFiles}
                missing=""
                note="The voiceover job and the Shotstack edit, generated from the pack's beat tables."
              />
            )}
            {extra.map(([column, value]) => (
              <Row key={column} label={column} value={value} />
            ))}
          </dl>
        </section>
      </div>
    </main>
  )
}

/**
 * A produced file, linked into the OPS reader.
 *
 * Reads from Drive rather than from the index's `Evidence Pack Location` / `Blog Location` columns,
 * which are empty on every row of master_index.csv — including this topic's, when both files exist.
 * The stage is shown alongside the article because the folder it lives in is its editorial status.
 */
function ArtifactRow({
  label,
  artifact,
  missing,
  note,
}: {
  label: string
  artifact: TopicArtifact | null
  missing: string
  note?: string
}) {
  return (
    <div className="contents">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="text-sm">
        {artifact ? (
          <>
            <ArtifactLine artifact={artifact} />
            {note && <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-500">{note}</p>}
          </>
        ) : (
          <span className="text-slate-400">{missing}</span>
        )}
      </dd>
    </div>
  )
}

/**
 * A row that can hold several files.
 *
 * Reel packs are one per language under the current standard, and the render files come in pairs —
 * so unlike the evidence pack and the blogs, "one artifact or nothing" is the wrong shape here. The
 * language is shown because a pack whose language is null predates the bilingual standard and is
 * genuinely different from an English one.
 */
function ArtifactListRow({
  label,
  artifacts,
  missing,
  note,
}: {
  label: string
  artifacts: TopicArtifact[]
  missing: string
  note?: string
}) {
  return (
    <div className="contents">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="text-sm">
        {artifacts.length === 0 ? (
          <span className="text-slate-400">{missing}</span>
        ) : (
          <>
            <ul className="flex flex-col gap-1">
              {artifacts.map((artifact) => (
                <li key={artifact.id}>
                  <ArtifactLine artifact={artifact} />
                </li>
              ))}
            </ul>
            {note && <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-500">{note}</p>}
          </>
        )}
      </dd>
    </div>
  )
}

function ArtifactLine({ artifact }: { artifact: TopicArtifact }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Link
        href={`/pranajiva/documents/${artifact.id}`}
        className="font-medium text-slate-900 underline underline-offset-2 hover:text-slate-600"
      >
        {artifact.name}
      </Link>
      <Chip tone="teal">{artifact.stage}</Chip>
      {artifact.language && <Chip tone="slate">{artifact.language}</Chip>}
      {artifact.webViewLink && (
        <a
          href={artifact.webViewLink}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-700"
        >
          Drive ↗
        </a>
      )}
    </span>
  )
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | null
  mono?: boolean
}) {
  return (
    <div className="contents">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className={`text-sm text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>
        {value ?? <span className="text-slate-300">—</span>}
      </dd>
    </div>
  )
}

const CHIP_TONE = {
  slate: "bg-slate-100 text-slate-600",
  teal: "bg-teal-100 text-teal-800",
  amber: "bg-amber-100 text-amber-800",
} as const

function Chip({
  tone,
  children,
}: {
  tone: keyof typeof CHIP_TONE
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP_TONE[tone]}`}
    >
      {children}
    </span>
  )
}
