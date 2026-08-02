import { getDbPool } from "@/lib/db"
import PricingTabs from "../pricing-tabs"
import SimulatorForm from "./simulator-form"

export const dynamic = "force-dynamic"

export default async function SimulatorPage() {
  const db = getDbPool()

  const categoryRes = await db.query(`SELECT id FROM pricing.product_categories WHERE key = 'cake'`)
  const categoryId = categoryRes.rows[0]?.id

  const valuesRes = await db.query(
    `SELECT a.key AS attribute_key, av.value, av.label
     FROM pricing.attribute_values av
     JOIN pricing.attributes a ON a.id = av.attribute_id
     WHERE a.category_id = $1 AND av.is_active = true AND a.is_active = true
     ORDER BY a.sort_order, av.sort_order`,
    [categoryId]
  )

  const optionsByAttribute: Record<string, { value: string; label: string }[]> = {}
  for (const row of valuesRes.rows) {
    const list = optionsByAttribute[row.attribute_key] ?? []
    list.push({ value: row.value, label: row.label })
    optionsByAttribute[row.attribute_key] = list
  }

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Pricing</h1>
      </header>
      <PricingTabs />
      <div className="mx-auto max-w-[900px] px-6 py-6">
        <p className="mb-4 text-xs text-slate-500">
          Pick a combination and calculate — this calls the exact same pricing route a real
          customer&apos;s browser hits, so what you see here is what they&apos;d see, including any
          region-specific overrides if you enter a pincode.
        </p>
        <SimulatorForm
          weights={optionsByAttribute["weight"] ?? []}
          tiers={optionsByAttribute["tiers"] ?? []}
          shapes={optionsByAttribute["shape"] ?? []}
          styles={optionsByAttribute["style"] ?? []}
          flavors={optionsByAttribute["flavor"] ?? []}
        />
      </div>
    </main>
  )
}
