import { getDbPool } from "@/lib/db"
import PricingTabs from "./pricing-tabs"
import { startDraft, discardDraft, publishDraft, updateBasePriceRule, updateAdjustmentRule } from "./actions"

export const dynamic = "force-dynamic"

const CALC_TARGETS = ["BASE", "RUNNING_SUBTOTAL", "FINAL_TOTAL"] as const
const ADJUSTMENT_TYPES = ["flat", "multiplier", "per_kg", "percentage"] as const

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const db = getDbPool()

  const categoryRes = await db.query(`SELECT id FROM pricing.product_categories WHERE key = 'cake'`)
  const categoryId = categoryRes.rows[0]?.id

  const ruleSetsRes = await db.query(
    `SELECT id, version, status, published_at FROM pricing.rule_sets
     WHERE category_id = $1 AND status IN ('draft', 'published')
     ORDER BY status = 'draft' DESC`,
    [categoryId]
  )
  const draft = ruleSetsRes.rows.find((r) => r.status === "draft")
  const published = ruleSetsRes.rows.find((r) => r.status === "published")
  const showing = draft ?? published

  if (!showing) {
    return (
      <main className="min-h-screen flex-1 bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <h1 className="text-base font-bold text-slate-900">Pricing</h1>
        </header>
        <PricingTabs />
        <div className="mx-auto max-w-[1600px] px-6 py-6">
          <p className="text-sm text-slate-500">No pricing configuration exists yet.</p>
        </div>
      </main>
    )
  }

  const editable = showing.id === draft?.id

  const baseRulesRes = await db.query(
    `SELECT bpr.id, av.value, av.label, av.extra, bpr.amount
     FROM pricing.base_price_rules bpr
     JOIN pricing.attribute_values av ON av.id = bpr.weight_value_id
     WHERE bpr.rule_set_id = $1 AND bpr.region_id IS NULL
     ORDER BY av.sort_order`,
    [showing.id]
  )

  const attributesRes = await db.query(
    `SELECT id, key, label FROM pricing.attributes WHERE category_id = $1 AND key != 'weight' ORDER BY sort_order`,
    [categoryId]
  )

  const adjustmentRulesRes = await db.query(
    `SELECT ar.id, ar.calculation_target, ar.adjustment_type, ar.amount, ar.label AS rule_label,
            av.attribute_id, av.value, av.label AS value_label
     FROM pricing.adjustment_rules ar
     JOIN pricing.attribute_values av ON av.id = ar.attribute_value_id
     WHERE ar.rule_set_id = $1 AND ar.region_id IS NULL
     ORDER BY av.sort_order`,
    [showing.id]
  )

  const rulesByAttribute = new Map<string, typeof adjustmentRulesRes.rows>()
  for (const row of adjustmentRulesRes.rows) {
    const list = rulesByAttribute.get(row.attribute_id) ?? []
    list.push(row)
    rulesByAttribute.set(row.attribute_id, list)
  }

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Pricing</h1>
      </header>
      <PricingTabs />
      <div className="mx-auto max-w-[1600px] px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <p className="text-sm font-bold text-slate-900">
            {editable ? `Draft v${showing.version}` : `Published v${showing.version}`}
          </p>
          <p className="text-xs text-slate-500">
            {editable
              ? "Editing — nothing here is live until you Publish."
              : published?.published_at
                ? `Live since ${new Date(published.published_at).toLocaleString("en-IN")}`
                : "Live"}
          </p>
        </div>
        <div className="flex gap-2">
          {editable ? (
            <>
              <form action={discardDraft.bind(null, showing.id)}>
                <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Discard draft
                </button>
              </form>
              <form action={publishDraft.bind(null, showing.id)}>
                <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                  Publish
                </button>
              </form>
            </>
          ) : (
            <form action={startDraft}>
              <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                Edit prices
              </button>
            </form>
          )}
        </div>
      </div>

      {params.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {params.error}
        </div>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-bold text-slate-900">Base Price by Weight</h2>
        <div className="divide-y divide-slate-100">
          {baseRulesRes.rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{r.label}</p>
                {r.extra?.serves && <p className="text-xs text-slate-400">Serves {r.extra.serves}</p>}
              </div>
              {editable ? (
                <form action={updateBasePriceRule.bind(null, r.id)} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">₹</span>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    defaultValue={r.amount}
                    className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">
                    Save
                  </button>
                </form>
              ) : (
                <p className="text-sm font-semibold text-slate-900">₹{r.amount}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {attributesRes.rows.map((attr) => {
        const rules = rulesByAttribute.get(attr.id) ?? []
        return (
          <section key={attr.id} className="mb-6 rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-bold text-slate-900">{attr.label}</h2>
            <div className="divide-y divide-slate-100">
              {rules.length === 0 ? (
                <p className="px-5 py-3 text-xs text-slate-400">No values configured yet.</p>
              ) : editable ? (
                rules.map((r) => (
                  <form
                    key={r.id}
                    action={updateAdjustmentRule.bind(null, r.id)}
                    className="flex flex-wrap items-center gap-2 px-5 py-3"
                  >
                    <span className="w-32 shrink-0 text-sm font-medium text-slate-900">{r.value_label}</span>
                    <select
                      name="calculationTarget"
                      defaultValue={r.calculation_target}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
                    >
                      {CALC_TARGETS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <select
                      name="adjustmentType"
                      defaultValue={r.adjustment_type}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
                    >
                      {ADJUSTMENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      name="amount"
                      step="0.0001"
                      defaultValue={r.amount}
                      className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      name="label"
                      placeholder={r.value_label}
                      defaultValue={r.rule_label ?? ""}
                      className="min-w-32 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
                    />
                    <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">
                      Save
                    </button>
                  </form>
                ))
              ) : (
                rules.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <span className="text-sm font-medium text-slate-900">{r.rule_label ?? r.value_label}</span>
                    <span className="text-xs text-slate-500">
                      {r.adjustment_type} · {r.amount} · target: {r.calculation_target}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        )
      })}

      <p className="text-xs text-slate-400">
        These are the default prices, used everywhere a region hasn&apos;t set its own override — see
        the Regions tab above to add region-specific pricing or map pincodes to a region.
      </p>
      </div>
    </main>
  )
}
