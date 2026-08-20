import { notFound } from "next/navigation"

import { loadDecisions } from "@/lib/pranajiva/decisions"
import { loadKnowledgeBase } from "@/lib/pranajiva/knowledge-base"
import BackLink from "../../../_components/back-link"
import { DecisionControl } from "../../_components/decision"
import { SectionHeader } from "../../_components/section"
import { EvidenceChip } from "../page"

/**
 * One classical formula, in full.
 *
 * The list answers "which of these is worth looking at"; this answers "should we make it", which
 * needs the fields the list cannot fit — quantities, processing, and above all the source's own
 * caveats. Uncertainties, contraindications and open safety questions are given their own block
 * rather than being listed alongside the ingredients, because a formulation decision taken without
 * reading them is the one mistake this screen exists to prevent.
 *
 * notFound() is called here in the page component and never in generateMetadata: metadata resolves
 * after the response status is committed, so a notFound() there renders the 404 page under a 200
 * status line — which Search Console reads as a soft 404 and which cost this codebase 231 of them.
 */
export const dynamic = "force-dynamic"

export default async function FormulaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formulaId = decodeURIComponent(id)

  const kb = await loadKnowledgeBase()
  const formula = kb.formulas.find((f) => f.id === formulaId)
  if (!formula) notFound()

  const decisions = await loadDecisions("formula")
  const decision = decisions.get(formula.id)

  const facts: { label: string; value: string | null }[] = [
    { label: "Source reference", value: formula.reference },
    { label: "Ingredients", value: formula.ingredients },
    { label: "Quantities", value: formula.quantities },
    { label: "Processing", value: formula.processing },
    { label: "Traditional use", value: formula.purpose },
    { label: "Modern category", value: formula.category },
  ]

  const caveats: { label: string; value: string | null }[] = [
    { label: "Uncertainties", value: formula.uncertainties },
    { label: "Contraindications", value: formula.contraindication },
    { label: "Open safety questions", value: formula.safetyQuestions },
  ]

  const hasCaveats = caveats.some((c) => c.value)

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <SectionHeader
        title={formula.name}
        description={`${formula.id}${formula.chapter ? ` · ${formula.chapter}` : ""}`}
        action={<EvidenceChip level={formula.evidenceLevel} />}
      />

      <div className="space-y-5 p-6">
        <BackLink fallbackHref="/pranajiva/formulas" label="All formulas" />

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Decision</h2>
          <p className="mt-1 text-xs text-slate-500">
            Recorded in OPS, not in Drive — the research documents stay exactly as the pipeline wrote
            them.
          </p>
          <div className="mt-3">
            <DecisionControl
              kind="formula"
              subjectKey={formula.id}
              decision={decision}
              returnTo={`/pranajiva/formulas/${encodeURIComponent(formula.id)}`}
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
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Formulation</h2>
          <dl className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
            {facts.map((fact) => (
              <div key={fact.label} className="contents">
                <dt className="text-xs font-semibold text-slate-500">{fact.label}</dt>
                <dd className="text-sm text-slate-800">
                  {fact.value ?? <span className="text-slate-300">Not specified in source</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {hasCaveats && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-amber-700">
              What the source is unsure about
            </h2>
            <dl className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
              {caveats
                .filter((c) => c.value)
                .map((caveat) => (
                  <div key={caveat.label} className="contents">
                    <dt className="text-xs font-semibold text-amber-800">{caveat.label}</dt>
                    <dd className="text-sm text-amber-900">{caveat.value}</dd>
                  </div>
                ))}
            </dl>
          </section>
        )}

        {kb.found.formulaLibrary && (
          <p className="text-xs text-slate-400">
            Read from{" "}
            <a
              href={`https://drive.google.com/file/d/${kb.found.formulaLibrary.id}/view`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-slate-700"
            >
              {kb.found.formulaLibrary.name}
            </a>{" "}
            in Drive.
          </p>
        )}
      </div>
    </main>
  )
}
