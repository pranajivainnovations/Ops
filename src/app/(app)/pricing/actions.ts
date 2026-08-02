"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getDbPool } from "@/lib/db"
import { getCurrentSession } from "@/lib/auth"

const CATEGORY_KEY = "cake"

async function getCategoryId(): Promise<string> {
  const db = getDbPool()
  const res = await db.query(`SELECT id FROM pricing.product_categories WHERE key = $1`, [CATEGORY_KEY])
  return res.rows[0].id
}

/**
 * Opens a new draft by cloning every row (default AND region-specific) from the current published
 * rule set — nothing is lost when a new version is published, region overrides carry forward too.
 * A no-op if a draft already exists (only one draft in flight at a time).
 */
export async function startDraft() {
  const session = await getCurrentSession()
  const db = getDbPool()
  const categoryId = await getCategoryId()

  const existingDraft = await db.query(
    `SELECT id FROM pricing.rule_sets WHERE category_id = $1 AND status = 'draft'`,
    [categoryId]
  )
  if (existingDraft.rows.length > 0) {
    redirect("/pricing")
  }

  const published = await db.query(
    `SELECT id, version FROM pricing.rule_sets WHERE category_id = $1 AND status = 'published' ORDER BY version DESC LIMIT 1`,
    [categoryId]
  )
  const publishedId: string | undefined = published.rows[0]?.id
  const nextVersion: number = (published.rows[0]?.version ?? 0) + 1

  const draft = await db.query(
    `INSERT INTO pricing.rule_sets (category_id, version, status, created_by)
     VALUES ($1, $2, 'draft', $3) RETURNING id`,
    [categoryId, nextVersion, session?.userId ?? null]
  )
  const draftId = draft.rows[0].id

  if (publishedId) {
    await db.query(
      `INSERT INTO pricing.base_price_rules (rule_set_id, weight_value_id, region_id, amount, created_by)
       SELECT $1, weight_value_id, region_id, amount, $2 FROM pricing.base_price_rules WHERE rule_set_id = $3`,
      [draftId, session?.userId ?? null, publishedId]
    )
    await db.query(
      `INSERT INTO pricing.adjustment_rules
         (rule_set_id, attribute_value_id, region_id, calculation_target, adjustment_type, amount, label, display_order, evaluation_order, created_by)
       SELECT $1, attribute_value_id, region_id, calculation_target, adjustment_type, amount, label, display_order, evaluation_order, $2
       FROM pricing.adjustment_rules WHERE rule_set_id = $3`,
      [draftId, session?.userId ?? null, publishedId]
    )
  }

  revalidatePath("/pricing")
  redirect("/pricing")
}

export async function discardDraft(draftId: string) {
  const db = getDbPool()
  await db.query(`DELETE FROM pricing.rule_sets WHERE id = $1 AND status = 'draft'`, [draftId])
  revalidatePath("/pricing")
}

export async function updateBasePriceRule(ruleId: string, formData: FormData) {
  const session = await getCurrentSession()
  const amount = Number(formData.get("amount"))
  if (!Number.isFinite(amount) || amount < 0) return

  const db = getDbPool()
  // The rule_set_id-in-draft check is defense in depth — the UI never renders published rows as
  // editable, but published rule sets must stay immutable no matter what reaches this action.
  await db.query(
    `UPDATE pricing.base_price_rules SET amount = $1, updated_by = $2, updated_at = NOW()
     WHERE id = $3 AND rule_set_id IN (SELECT id FROM pricing.rule_sets WHERE status = 'draft')`,
    [amount, session?.userId ?? null, ruleId]
  )
  revalidatePath("/pricing")
}

export async function updateAdjustmentRule(ruleId: string, formData: FormData) {
  const session = await getCurrentSession()
  const calculationTarget = String(formData.get("calculationTarget"))
  const adjustmentType = String(formData.get("adjustmentType"))
  const amount = Number(formData.get("amount"))
  const labelRaw = String(formData.get("label") ?? "").trim()

  if (!["BASE", "RUNNING_SUBTOTAL", "FINAL_TOTAL"].includes(calculationTarget)) return
  if (!["flat", "multiplier", "per_kg", "percentage"].includes(adjustmentType)) return
  if (!Number.isFinite(amount)) return

  const db = getDbPool()
  await db.query(
    `UPDATE pricing.adjustment_rules
     SET calculation_target = $1, adjustment_type = $2, amount = $3, label = $4, updated_by = $5, updated_at = NOW()
     WHERE id = $6 AND rule_set_id IN (SELECT id FROM pricing.rule_sets WHERE status = 'draft')`,
    [calculationTarget, adjustmentType, amount, labelRaw.length > 0 ? labelRaw : null, session?.userId ?? null, ruleId]
  )
  revalidatePath("/pricing")
}

/**
 * Publish validation: every active weight value needs a default base price row, and every active
 * non-weight attribute value needs a default adjustment row — an incomplete config simply cannot go
 * live. This is what turns "never fails" (see the design doc's fallback section) from a hope into an
 * enforced precondition.
 */
export async function publishDraft(draftId: string) {
  const session = await getCurrentSession()
  const db = getDbPool()

  const draftRes = await db.query(`SELECT category_id FROM pricing.rule_sets WHERE id = $1 AND status = 'draft'`, [draftId])
  const categoryId = draftRes.rows[0]?.category_id
  if (!categoryId) return

  const missingBase = await db.query(
    `SELECT av.label FROM pricing.attribute_values av
     JOIN pricing.attributes a ON a.id = av.attribute_id
     WHERE a.category_id = $1 AND a.key = 'weight' AND av.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM pricing.base_price_rules bpr
         WHERE bpr.rule_set_id = $2 AND bpr.weight_value_id = av.id AND bpr.region_id IS NULL
       )`,
    [categoryId, draftId]
  )
  const missingAdjustment = await db.query(
    `SELECT av.label FROM pricing.attribute_values av
     JOIN pricing.attributes a ON a.id = av.attribute_id
     WHERE a.category_id = $1 AND a.key != 'weight' AND av.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM pricing.adjustment_rules ar
         WHERE ar.rule_set_id = $2 AND ar.attribute_value_id = av.id AND ar.region_id IS NULL
       )`,
    [categoryId, draftId]
  )

  if (missingBase.rows.length > 0 || missingAdjustment.rows.length > 0) {
    const names = [...missingBase.rows, ...missingAdjustment.rows].map((r) => r.label).join(", ")
    redirect(`/pricing?error=${encodeURIComponent(`Cannot publish — missing a default price for: ${names}`)}`)
  }

  const client = await db.connect()
  try {
    await client.query("BEGIN")
    await client.query(
      `UPDATE pricing.rule_sets SET status = 'archived', effective_to = NOW() WHERE category_id = $1 AND status = 'published'`,
      [categoryId]
    )
    await client.query(
      `UPDATE pricing.rule_sets SET status = 'published', effective_from = NOW(), published_at = NOW(), published_by = $1 WHERE id = $2`,
      [session?.userId ?? null, draftId]
    )
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }

  revalidatePath("/pricing")
  redirect("/pricing")
}
