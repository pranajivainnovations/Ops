import { getDbPool } from "@/lib/db"
import PricingTabs from "../pricing-tabs"
import { addAttribute, addAttributeValue, setValueActive, setRequiresRegeneration } from "./actions"

export const dynamic = "force-dynamic"

export default async function AttributesPage() {
  const db = getDbPool()

  const categoryRes = await db.query(`SELECT id FROM pricing.product_categories WHERE key = 'cake'`)
  const categoryId = categoryRes.rows[0]?.id

  const attributesRes = await db.query(
    `SELECT id, key, label, input_type, requires_regeneration FROM pricing.attributes WHERE category_id = $1 ORDER BY sort_order`,
    [categoryId]
  )
  const valuesRes = await db.query(
    `SELECT av.id, av.attribute_id, av.value, av.label, av.is_active
     FROM pricing.attribute_values av
     JOIN pricing.attributes a ON a.id = av.attribute_id
     WHERE a.category_id = $1
     ORDER BY av.sort_order`,
    [categoryId]
  )
  const valuesByAttribute = new Map<string, typeof valuesRes.rows>()
  for (const v of valuesRes.rows) {
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
        New values are ready to select immediately — setting their price still happens in a draft on
        the Rule Set tab.
      </p>

      {attributesRes.rows.map((attr) => {
        const values = valuesByAttribute.get(attr.id) ?? []
        return (
          <section key={attr.id} className="mb-6 rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
              <h2 className="text-sm font-bold text-slate-900">
                {attr.label} <span className="font-normal text-slate-400">({attr.key})</span>
              </h2>
              <form action={setRequiresRegeneration.bind(null, attr.id, !attr.requires_regeneration)}>
                <button
                  type="submit"
                  title="Does changing this attribute invalidate an already-generated AI cake image?"
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    attr.requires_regeneration
                      ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {attr.requires_regeneration ? "✓ Requires regeneration" : "Requires regeneration?"}
                </button>
              </form>
            </div>
            <div className="divide-y divide-slate-100">
              {values.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
                  <span className={`text-sm ${v.is_active ? "text-slate-900" : "text-slate-400 line-through"}`}>
                    {v.label} <span className="text-xs text-slate-400">({v.value})</span>
                  </span>
                  <form action={setValueActive.bind(null, v.id, !v.is_active)}>
                    <button
                      type="submit"
                      className={`text-xs font-semibold ${v.is_active ? "text-amber-600 hover:text-amber-800" : "text-emerald-600 hover:text-emerald-800"}`}
                    >
                      {v.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </div>
              ))}
            </div>
            <form action={addAttributeValue.bind(null, attr.id)} className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
              <input
                type="text"
                name="value"
                placeholder="Machine value, e.g. Pistachio"
                required
                className="flex-1 min-w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
              />
              <input
                type="text"
                name="label"
                placeholder="Display label"
                required
                className="flex-1 min-w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
              />
              <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                + Add value
              </button>
            </form>
          </section>
        )
      })}

      <section className="rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-bold text-slate-900">Add a new attribute</h2>
        <form action={addAttribute} className="flex flex-wrap items-center gap-2 px-5 py-3">
          <input
            type="text"
            name="key"
            placeholder="Machine key, e.g. icing_type"
            required
            className="flex-1 min-w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
          />
          <input
            type="text"
            name="label"
            placeholder="Display label, e.g. Icing Type"
            required
            className="flex-1 min-w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
          />
          <select name="inputType" className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none">
            <option value="select">select</option>
            <option value="toggle">toggle</option>
          </select>
          <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
            + Add attribute
          </button>
        </form>
      </section>
      </div>
    </main>
  )
}
