import Link from "next/link"
import { getDbPool } from "@/lib/db"
import PricingTabs from "../../pricing-tabs"
import {
  addPincode,
  removePincode,
  upsertRegionBaseRule,
  removeRegionBaseRule,
  upsertRegionAdjustmentRule,
  removeRegionAdjustmentRule,
} from "../actions"

export const dynamic = "force-dynamic"

const CALC_TARGETS = ["BASE", "RUNNING_SUBTOTAL", "FINAL_TOTAL"] as const
const ADJUSTMENT_TYPES = ["flat", "multiplier", "per_kg", "percentage"] as const

export default async function RegionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: regionId } = await params
  const db = getDbPool()

  const regionRes = await db.query(`SELECT id, key, label FROM pricing.regions WHERE id = $1`, [regionId])
  const region = regionRes.rows[0]
  if (!region) {
    return (
      <main className="min-h-screen flex-1 bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <h1 className="text-base font-bold text-slate-900">Pricing</h1>
        </header>
        <PricingTabs />
        <div className="mx-auto max-w-[1600px] px-6 py-6">
          <p className="text-sm text-slate-500">Region not found.</p>
        </div>
      </main>
    )
  }

  const pincodesRes = await db.query(`SELECT pincode FROM pricing.region_pincodes WHERE region_id = $1 ORDER BY pincode`, [regionId])

  const categoryRes = await db.query(`SELECT id FROM pricing.product_categories WHERE key = 'cake'`)
  const categoryId = categoryRes.rows[0]?.id
  const ruleSetsRes = await db.query(
    `SELECT id, version, status FROM pricing.rule_sets WHERE category_id = $1 AND status IN ('draft', 'published')`,
    [categoryId]
  )
  const draft = ruleSetsRes.rows.find((r) => r.status === "draft")
  const published = ruleSetsRes.rows.find((r) => r.status === "published")
  // Overrides are always shown for whichever rule set is currently in view (draft if one's open, else
  // the live published version) — visibility never depends on a draft existing, only editing does.
  const viewRuleSet = draft ?? published
  const editable = Boolean(draft)

  const weightsWithOverride = viewRuleSet
    ? await db.query(
        `SELECT av.id, av.label, av.extra, bpr.id AS rule_id, bpr.amount
         FROM pricing.attribute_values av
         JOIN pricing.attributes a ON a.id = av.attribute_id
         LEFT JOIN pricing.base_price_rules bpr ON bpr.weight_value_id = av.id AND bpr.rule_set_id = $2 AND bpr.region_id = $3
         WHERE a.category_id = $1 AND a.key = 'weight' AND av.is_active = true
         ORDER BY av.sort_order`,
        [categoryId, viewRuleSet.id, regionId]
      )
    : { rows: [] }

  const attributesRes = await db.query(
    `SELECT id, key, label FROM pricing.attributes WHERE category_id = $1 AND key != 'weight' ORDER BY sort_order`,
    [categoryId]
  )
  const valuesWithOverride = viewRuleSet
    ? await db.query(
        `SELECT av.id, av.attribute_id, av.label, ar.id AS rule_id, ar.calculation_target, ar.adjustment_type, ar.amount, ar.label AS rule_label
         FROM pricing.attribute_values av
         JOIN pricing.attributes a ON a.id = av.attribute_id
         LEFT JOIN pricing.adjustment_rules ar ON ar.attribute_value_id = av.id AND ar.rule_set_id = $2 AND ar.region_id = $3
         WHERE a.category_id = $1 AND a.key != 'weight' AND av.is_active = true
         ORDER BY av.sort_order`,
        [categoryId, viewRuleSet.id, regionId]
      )
    : { rows: [] }
  const valuesByAttribute = new Map<string, typeof valuesWithOverride.rows>()
  for (const v of valuesWithOverride.rows) {
    const list = valuesByAttribute.get(v.attribute_id) ?? []
    list.push(v)
    valuesByAttribute.set(v.attribute_id, list)
  }

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Pricing</h1>
      </header>
      <PricingTabs />
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <p className="mb-4 text-xs text-slate-500">
          <Link href="/pricing/regions" className="underline hover:text-slate-700">← Back to regions</Link>
        </p>
        <h2 className="mb-4 text-base font-bold text-slate-900">{region.label}</h2>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white">
          <h3 className="border-b border-slate-200 px-5 py-3 text-sm font-bold text-slate-900">Pincodes</h3>
          <div className="flex flex-wrap gap-2 px-5 py-3">
            {pincodesRes.rows.map((p) => (
              <span key={p.pincode} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-mono text-slate-700">
                {p.pincode}
                <form action={removePincode.bind(null, regionId, p.pincode)}>
                  <button type="submit" className="text-slate-400 hover:text-red-600" aria-label={`Remove ${p.pincode}`}>×</button>
                </form>
              </span>
            ))}
            {pincodesRes.rows.length === 0 && <p className="text-xs text-slate-400">No pincodes mapped yet.</p>}
          </div>
          <form action={addPincode.bind(null, regionId)} className="flex items-center gap-2 border-t border-slate-100 px-5 py-3">
            <input
              type="text"
              name="pincode"
              placeholder="6-digit pincode"
              pattern="\d{6}"
              required
              className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm font-mono focus:border-slate-500 focus:outline-none"
            />
            <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
              + Add pincode
            </button>
          </form>
        </section>

        {!editable && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            Showing this region&apos;s current live overrides (read-only). Open a draft on the{" "}
            <Link href="/pricing" className="underline">Rule Set tab</Link> to add or change one.
          </div>
        )}

        {!viewRuleSet ? (
          <p className="text-sm text-slate-500">No pricing configuration exists yet.</p>
        ) : (
          <>
            <section className="mb-6 rounded-xl border border-slate-200 bg-white">
              <h3 className="border-b border-slate-200 px-5 py-3 text-sm font-bold text-slate-900">
                Base price overrides
              </h3>
              <div className="divide-y divide-slate-100">
                {weightsWithOverride.rows.map((w) => (
                  <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <span className="w-24 shrink-0 text-sm font-medium text-slate-900">{w.label}</span>
                    {editable ? (
                      <>
                        <form action={upsertRegionBaseRule.bind(null, draft.id, regionId, w.id)} className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">₹</span>
                          <input
                            type="number"
                            name="amount"
                            step="0.01"
                            defaultValue={w.amount ?? ""}
                            placeholder="uses default"
                            className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
                          />
                          <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">
                            {w.rule_id ? "Update" : "Override"}
                          </button>
                        </form>
                        {w.rule_id && (
                          <form action={removeRegionBaseRule.bind(null, w.rule_id, regionId)}>
                            <button type="submit" className="text-xs font-semibold text-slate-400 hover:text-red-600">Remove override</button>
                          </form>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-slate-600">
                        {w.rule_id ? `₹${w.amount} (override)` : <span className="text-slate-400">Uses default</span>}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {attributesRes.rows.map((attr) => {
              const values = valuesByAttribute.get(attr.id) ?? []
              return (
                <section key={attr.id} className="mb-6 rounded-xl border border-slate-200 bg-white">
                  <h3 className="border-b border-slate-200 px-5 py-3 text-sm font-bold text-slate-900">
                    {attr.label} overrides
                  </h3>
                  <div className="divide-y divide-slate-100">
                    {values.map((v) => (
                      <div key={v.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
                        <span className="w-32 shrink-0 text-sm font-medium text-slate-900">{v.label}</span>
                        {editable ? (
                          <>
                            <form action={upsertRegionAdjustmentRule.bind(null, draft.id, regionId, v.id)} className="flex flex-wrap items-center gap-2">
                              <select name="calculationTarget" defaultValue={v.calculation_target ?? "RUNNING_SUBTOTAL"} className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none">
                                {CALC_TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <select name="adjustmentType" defaultValue={v.adjustment_type ?? "flat"} className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none">
                                {ADJUSTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <input
                                type="number"
                                name="amount"
                                step="0.0001"
                                defaultValue={v.amount ?? ""}
                                placeholder="uses default"
                                className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
                              />
                              <input
                                type="text"
                                name="label"
                                placeholder={v.label}
                                defaultValue={v.rule_label ?? ""}
                                className="min-w-32 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
                              />
                              <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">
                                {v.rule_id ? "Update" : "Override"}
                              </button>
                            </form>
                            {v.rule_id && (
                              <form action={removeRegionAdjustmentRule.bind(null, v.rule_id, regionId)}>
                                <button type="submit" className="text-xs font-semibold text-slate-400 hover:text-red-600">Remove override</button>
                              </form>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-slate-600">
                            {v.rule_id
                              ? `${v.rule_label ?? v.label} — ${v.adjustment_type} ${v.amount} (override)`
                              : <span className="text-slate-400">Uses default</span>}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </>
        )}
      </div>
    </main>
  )
}
