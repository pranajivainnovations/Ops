import Link from "next/link"

import { GoogleDriveError, isDriveConfigured } from "@/lib/google-drive"
import { loadDecisions } from "@/lib/pranajiva/decisions"
import { loadKnowledgeBase } from "@/lib/pranajiva/knowledge-base"
import { splitCategories, type ClassicalFormula } from "@/lib/pranajiva/parse"
import RecordCard, { CardList, TableWrap } from "../../_components/record-card"
import { DecisionChip, DecisionControl } from "../_components/decision"
import { EmptyRow, MissingDocument, SectionHeader } from "../_components/section"
import { DriveErrorPanel, SetupPanel } from "../_components/setup"

/**
 * The classical formula library as an index rather than an 81 KB document.
 *
 * The corpus already grades every formula (evidence level A–D) and tags it with a modern product
 * category. Those are precisely the two axes someone deciding "what could we actually make" filters
 * on, and neither is reachable by scrolling a Markdown file. The decision column is the answer they
 * leave behind.
 */
export const dynamic = "force-dynamic"

/**
 * Evidence grade drives colour because it is the field that changes what a formula is worth: an A
 * is a complete formulation with species and quantities, a D is a passing mention. Showing them in
 * the same weight would flatten the single most useful distinction in the corpus.
 */
const EVIDENCE_CHIP: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-teal-100 text-teal-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-slate-200 text-slate-600",
}

export default async function FormulasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; evidence?: string; category?: string; decided?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? "").trim().toLowerCase()
  const evidence = (params.evidence ?? "").trim().toUpperCase()
  const category = (params.category ?? "").trim()
  const decided = (params.decided ?? "").trim()

  if (!isDriveConfigured()) {
    return (
      <Shell>
        <SetupPanel />
      </Shell>
    )
  }

  let formulas: ClassicalFormula[] = []
  let error: string | null = null

  try {
    formulas = (await loadKnowledgeBase()).formulas
  } catch (e) {
    error = e instanceof GoogleDriveError ? e.message : "Could not reach Google Drive."
    console.error("[pranajiva] formulas load failed", e)
  }

  if (error) {
    return (
      <Shell>
        <DriveErrorPanel message={error} />
      </Shell>
    )
  }

  if (formulas.length === 0) {
    return (
      <Shell>
        <MissingDocument what="classical formula library" filename="CLASSICAL_FORMULA_LIBRARY" />
      </Shell>
    )
  }

  const decisions = await loadDecisions("formula")

  // Compound cells split into their parts, so "Skin/Glow-complexion, Pastes" puts its formula under
  // both Skin and Pastes rather than into a category of one.
  const categories = Array.from(
    new Set(formulas.flatMap((f) => splitCategories(f.category)))
  ).sort()

  const evidenceLevels = Array.from(
    new Set(formulas.map((f) => f.evidenceLevel).filter((e): e is string => Boolean(e)))
  ).sort()

  const visible = formulas.filter((formula) => {
    if (evidence && formula.evidenceLevel !== evidence) return false
    if (category && !splitCategories(formula.category).includes(category)) return false
    if (decided === "yes" && !decisions.get(formula.id)?.status) return false
    if (decided === "no" && decisions.get(formula.id)?.status) return false
    if (query) {
      // Ingredients are searched alongside the name because "what uses Amla" is the question the
      // team actually arrives with — a name-only search would answer almost none of them.
      const haystack = [formula.id, formula.name, formula.ingredients, formula.purpose, formula.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })

  const keep = (extra: Record<string, string>) => {
    const next = new URLSearchParams()
    if (query) next.set("q", query)
    if (evidence) next.set("evidence", evidence)
    if (category) next.set("category", category)
    if (decided) next.set("decided", decided)
    for (const [key, value] of Object.entries(extra)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    const search = next.toString()
    return `/pranajiva/formulas${search ? `?${search}` : ""}`
  }

  const returnTo = keep({})

  return (
    <Shell>
      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search name, ingredient or use…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
        <select
          name="evidence"
          defaultValue={evidence}
          aria-label="Evidence level"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="">All evidence</option>
          {evidenceLevels.map((level) => (
            <option key={level} value={level}>
              Level {level}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={category}
          aria-label="Product category"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          name="decided"
          defaultValue={decided}
          aria-label="Decision"
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
        <span className="font-semibold tabular-nums text-slate-900">{visible.length}</span> of{" "}
        {formulas.length} formulas
        {visible.length !== formulas.length && (
          <>
            {" · "}
            <Link href="/pranajiva/formulas" className="underline underline-offset-2">
              clear filters
            </Link>
          </>
        )}
      </p>

      <CardList>
        {visible.map((formula) => (
          <RecordCard
            key={formula.id}
            title={formula.name}
            subtitle={formula.id}
            href={`/pranajiva/formulas/${encodeURIComponent(formula.id)}`}
            linkLabel="Read"
            fields={[
              { label: "Evidence", value: <EvidenceChip level={formula.evidenceLevel} /> },
              { label: "Category", value: formula.category ?? "—" },
              { label: "Chapter", value: formula.chapter ?? "—" },
              {
                label: "Decision",
                value: <DecisionChip kind="formula" decision={decisions.get(formula.id)} />,
              },
            ]}
          />
        ))}
        {visible.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
            No formulas match these filters.
          </p>
        )}
      </CardList>

      <TableWrap>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Formula</th>
              <th className="px-4 py-2 font-semibold">Chapter</th>
              <th className="px-4 py-2 font-semibold">Evidence</th>
              <th className="px-4 py-2 font-semibold">Category</th>
              <th className="px-4 py-2 font-semibold">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((formula) => (
              <tr key={formula.id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/pranajiva/formulas/${encodeURIComponent(formula.id)}`}
                    className="font-semibold text-slate-900 underline-offset-2 hover:underline"
                  >
                    {formula.name}
                  </Link>
                  <p className="font-mono text-[10px] text-slate-400">{formula.id}</p>
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">{formula.chapter ?? "—"}</td>
                <td className="px-4 py-2">
                  <EvidenceChip level={formula.evidenceLevel} />
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">{formula.category ?? "—"}</td>
                <td className="px-4 py-2">
                  <DecisionControl
                    kind="formula"
                    subjectKey={formula.id}
                    decision={decisions.get(formula.id)}
                    returnTo={returnTo}
                  />
                </td>
              </tr>
            ))}
            {visible.length === 0 && <EmptyRow>No formulas match these filters.</EmptyRow>}
          </tbody>
        </table>
      </TableWrap>
    </Shell>
  )
}

export function EvidenceChip({ level }: { level: string | null }) {
  if (!level) return <span className="text-xs text-slate-300">—</span>
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
        EVIDENCE_CHIP[level] ?? "bg-slate-100 text-slate-600"
      }`}
      title={`Evidence level ${level}`}
    >
      {level}
    </span>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <SectionHeader
        title="Classical formulas"
        description="Formulations extracted from Aṣṭāṅga Hṛdaya Sūtrasthāna by the P01 pipeline, graded by how completely the source specifies them. Filter by evidence and category to find what is worth productising."
      />
      <div className="space-y-4 p-6">{children}</div>
    </main>
  )
}
