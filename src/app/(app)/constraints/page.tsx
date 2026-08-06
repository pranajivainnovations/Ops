import { getDbPool } from "@/lib/db"
import { startDraft, discardDraft, publishDraft, addRule, updateRule, deleteRule } from "./actions"
import ConstraintsBoard, { type AttributeInfo, type RuleInfo } from "./constraints-board"

export const dynamic = "force-dynamic"

/**
 * The schema has no explicit "attribute type" — `input_type` is only a UI hint (see the pricing
 * migration's own comment: "not enforced in logic"). The Rule Builder needs one anyway to decide which
 * effects/operators make sense, so it's derived here: `toggle` input_type is boolean; otherwise, if
 * every active value parses as a plain number, it's numeric; anything else is enum.
 */
function classifyAttribute(inputType: string, values: { value: string }[]): AttributeInfo["type"] {
  if (inputType === "toggle") return "boolean"
  if (values.length > 0 && values.every((v) => v.value.trim() !== "" && Number.isFinite(Number(v.value)))) return "numeric"
  return "enum"
}

export default async function ConstraintsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const db = getDbPool()

  const categoryRes = await db.query(`SELECT id FROM pricing.product_categories WHERE key = 'cake'`)
  const categoryId = categoryRes.rows[0]?.id

  const attributesRes = await db.query(
    `SELECT id, key, label, input_type FROM pricing.attributes WHERE category_id = $1 AND is_active = true ORDER BY sort_order`,
    [categoryId]
  )
  const valuesRes = await db.query(
    `SELECT av.id, av.attribute_id, av.value, av.label
     FROM pricing.attribute_values av
     JOIN pricing.attributes a ON a.id = av.attribute_id
     WHERE a.category_id = $1 AND av.is_active = true
     ORDER BY av.sort_order`,
    [categoryId]
  )
  const valuesByAttribute = new Map<string, { id: string; value: string; label: string }[]>()
  for (const v of valuesRes.rows) {
    const list = valuesByAttribute.get(v.attribute_id) ?? []
    list.push({ id: v.id, value: v.value, label: v.label })
    valuesByAttribute.set(v.attribute_id, list)
  }

  const attributes: AttributeInfo[] = attributesRes.rows.map((a) => {
    const values = valuesByAttribute.get(a.id) ?? []
    return { id: a.id, key: a.key, label: a.label, type: classifyAttribute(a.input_type, values), values }
  })

  const ruleSetsRes = await db.query(
    `SELECT id, version, status, published_at FROM constraints.rule_sets
     WHERE category_id = $1 AND status IN ('draft', 'published')
     ORDER BY status = 'draft' DESC`,
    [categoryId]
  )
  const draft = ruleSetsRes.rows.find((r) => r.status === "draft")
  const published = ruleSetsRes.rows.find((r) => r.status === "published")
  const showing = draft ?? published
  const editable = Boolean(showing && showing.id === draft?.id)

  let rules: RuleInfo[] = []
  if (showing) {
    const rulesRes = await db.query(
      `SELECT id, trigger_attribute_id, trigger_operator, trigger_numeric_value,
              target_attribute_id, kind, numeric_value, message, priority
       FROM constraints.rules WHERE rule_set_id = $1 ORDER BY priority DESC, created_at`,
      [showing.id]
    )
    const ruleIds = rulesRes.rows.map((r) => r.id)

    const valueIdsByRule = new Map<string, string[]>()
    const triggerValueIdsByRule = new Map<string, string[]>()
    if (ruleIds.length > 0) {
      const rv = await db.query(`SELECT rule_id, attribute_value_id FROM constraints.rule_values WHERE rule_id = ANY($1)`, [ruleIds])
      for (const row of rv.rows) {
        const list = valueIdsByRule.get(row.rule_id) ?? []
        list.push(row.attribute_value_id)
        valueIdsByRule.set(row.rule_id, list)
      }
      const rtv = await db.query(`SELECT rule_id, attribute_value_id FROM constraints.rule_trigger_values WHERE rule_id = ANY($1)`, [ruleIds])
      for (const row of rtv.rows) {
        const list = triggerValueIdsByRule.get(row.rule_id) ?? []
        list.push(row.attribute_value_id)
        triggerValueIdsByRule.set(row.rule_id, list)
      }
    }

    rules = rulesRes.rows.map((r) => ({
      id: r.id,
      triggerAttributeId: r.trigger_attribute_id,
      triggerOperator: r.trigger_operator,
      triggerNumericValue: r.trigger_numeric_value != null ? Number(r.trigger_numeric_value) : null,
      triggerValueIds: triggerValueIdsByRule.get(r.id) ?? [],
      targetAttributeId: r.target_attribute_id,
      kind: r.kind,
      numericValue: r.numeric_value != null ? Number(r.numeric_value) : null,
      valueIds: valueIdsByRule.get(r.id) ?? [],
      message: r.message,
      priority: r.priority,
    }))
  }

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Constraints</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          What combinations are allowed — independent from Pricing, which only decides how much. A
          category with no published rules here behaves exactly as if this feature didn&apos;t exist.
        </p>
      </header>
      <div className="mx-auto max-w-[1200px] px-6 py-6">
        {!showing ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
            <p className="text-sm text-slate-500">No constraint rule set exists yet for &quot;cake&quot;.</p>
            <form action={startDraft}>
              <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                Start draft
              </button>
            </form>
          </div>
        ) : (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {editable ? `Draft v${showing.version}` : `Published v${showing.version}`}
              </p>
              <p className="text-xs text-slate-500">
                {editable
                  ? "Editing — nothing here is enforced until you Publish."
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
                    Edit rules
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {params.error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {params.error}
          </div>
        )}

        {showing && (
          <ConstraintsBoard
            attributes={attributes}
            rules={rules}
            editable={editable}
            addRuleAction={addRule}
            updateRuleAction={updateRule}
            deleteRuleAction={deleteRule}
          />
        )}
      </div>
    </main>
  )
}
