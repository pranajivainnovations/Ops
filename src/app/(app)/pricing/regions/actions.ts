"use server"

import { revalidatePath } from "next/cache"
import { getDbPool } from "@/lib/db"
import { getCurrentSession } from "@/lib/auth"

export async function addRegion(formData: FormData) {
  const session = await getCurrentSession()
  const key = String(formData.get("key") ?? "").trim().toLowerCase().replace(/\s+/g, "_")
  const label = String(formData.get("label") ?? "").trim()
  if (!key || !label) return

  const db = getDbPool()
  await db.query(
    `INSERT INTO pricing.regions (key, label, created_by) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
    [key, label, session?.userId ?? null]
  )
  revalidatePath("/pricing/regions")
}

export async function addPincode(regionId: string, formData: FormData) {
  const session = await getCurrentSession()
  const pincode = String(formData.get("pincode") ?? "").trim()
  if (!/^\d{6}$/.test(pincode)) return

  const db = getDbPool()
  await db.query(
    `INSERT INTO pricing.region_pincodes (region_id, pincode, created_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (pincode) DO UPDATE SET region_id = EXCLUDED.region_id`,
    [regionId, pincode, session?.userId ?? null]
  )
  revalidatePath(`/pricing/regions/${regionId}`)
}

export async function removePincode(regionId: string, pincode: string) {
  const db = getDbPool()
  await db.query(`DELETE FROM pricing.region_pincodes WHERE region_id = $1 AND pincode = $2`, [regionId, pincode])
  revalidatePath(`/pricing/regions/${regionId}`)
}

/** Only ever operates on the current draft — region overrides follow the same immutable-once-published rule as everything else. */
export async function upsertRegionBaseRule(draftId: string, regionId: string, weightValueId: string, formData: FormData) {
  const session = await getCurrentSession()
  const amount = Number(formData.get("amount"))
  if (!Number.isFinite(amount) || amount < 0) return

  const db = getDbPool()
  await db.query(
    `INSERT INTO pricing.base_price_rules (rule_set_id, weight_value_id, region_id, amount, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (rule_set_id, weight_value_id, region_id) WHERE region_id IS NOT NULL
     DO UPDATE SET amount = EXCLUDED.amount, updated_by = $5, updated_at = NOW()`,
    [draftId, weightValueId, regionId, amount, session?.userId ?? null]
  )
  revalidatePath(`/pricing/regions/${regionId}`)
}

export async function removeRegionBaseRule(ruleId: string, regionId: string) {
  const db = getDbPool()
  await db.query(
    `DELETE FROM pricing.base_price_rules WHERE id = $1 AND region_id IS NOT NULL
       AND rule_set_id IN (SELECT id FROM pricing.rule_sets WHERE status = 'draft')`,
    [ruleId]
  )
  revalidatePath(`/pricing/regions/${regionId}`)
}

export async function upsertRegionAdjustmentRule(
  draftId: string,
  regionId: string,
  attributeValueId: string,
  formData: FormData
) {
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
    `INSERT INTO pricing.adjustment_rules
       (rule_set_id, attribute_value_id, region_id, calculation_target, adjustment_type, amount, label, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (rule_set_id, attribute_value_id, region_id) WHERE region_id IS NOT NULL
     DO UPDATE SET calculation_target = EXCLUDED.calculation_target, adjustment_type = EXCLUDED.adjustment_type,
                   amount = EXCLUDED.amount, label = EXCLUDED.label, updated_by = $8, updated_at = NOW()`,
    [draftId, attributeValueId, regionId, calculationTarget, adjustmentType, amount, labelRaw.length > 0 ? labelRaw : null, session?.userId ?? null]
  )
  revalidatePath(`/pricing/regions/${regionId}`)
}

export async function removeRegionAdjustmentRule(ruleId: string, regionId: string) {
  const db = getDbPool()
  await db.query(
    `DELETE FROM pricing.adjustment_rules WHERE id = $1 AND region_id IS NOT NULL
       AND rule_set_id IN (SELECT id FROM pricing.rule_sets WHERE status = 'draft')`,
    [ruleId]
  )
  revalidatePath(`/pricing/regions/${regionId}`)
}
