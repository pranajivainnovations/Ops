import Link from "next/link"

/**
 * Deliberate order: what the bakery *is*, then where the conversation stands, then the form that
 * changes things. Reading comes before editing — most visits to a baker page are someone checking
 * a fact before a call, not someone changing a field.
 */
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "pipeline", label: "Pipeline" },
  { key: "edit", label: "Edit" },
] as const

export type BakerTab = (typeof TABS)[number]["key"]

/** Anything unrecognised falls back to Overview rather than rendering an empty page. */
export function normalizeTab(value: string | undefined): BakerTab {
  return TABS.some((t) => t.key === value) ? (value as BakerTab) : "overview"
}

export default function BakerDetailTabs({
  bakerId,
  active,
}: {
  bakerId: string
  active: BakerTab
}) {
  return (
    <div className="flex gap-1 border-b border-slate-200 bg-white px-6">
      {TABS.map((tab) => {
        const isActive = tab.key === active
        return (
          <Link
            key={tab.key}
            href={`/bakers/${bakerId}?tab=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "border-b-2 border-slate-900 text-slate-900"
                : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
