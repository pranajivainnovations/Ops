"use server"

import { revalidatePath } from "next/cache"
import { getDbPool } from "@/lib/db"
import { getCurrentSession } from "@/lib/auth"

async function getCategoryId(): Promise<string> {
  const db = getDbPool()
  const res = await db.query(`SELECT id FROM pricing.product_categories WHERE key = 'cake'`)
  return res.rows[0].id
}

export async function addAttribute(formData: FormData) {
  const session = await getCurrentSession()
  const key = String(formData.get("key") ?? "").trim().toLowerCase().replace(/\s+/g, "_")
  const label = String(formData.get("label") ?? "").trim()
  const inputType = String(formData.get("inputType") ?? "select")
  if (!key || !label) return

  const db = getDbPool()
  const categoryId = await getCategoryId()
  const maxSort = await db.query(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM pricing.attributes WHERE category_id = $1`, [categoryId])

  await db.query(
    `INSERT INTO pricing.attributes (category_id, key, label, input_type, sort_order, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (category_id, key) DO NOTHING`,
    [categoryId, key, label, inputType, maxSort.rows[0].next, session?.userId ?? null]
  )
  revalidatePath("/pricing/attributes")
}

export async function addAttributeValue(attributeId: string, formData: FormData) {
  const session = await getCurrentSession()
  const value = String(formData.get("value") ?? "").trim()
  const label = String(formData.get("label") ?? "").trim()
  if (!value || !label) return

  const db = getDbPool()
  const maxSort = await db.query(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM pricing.attribute_values WHERE attribute_id = $1`, [attributeId])

  await db.query(
    `INSERT INTO pricing.attribute_values (attribute_id, value, label, sort_order, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (attribute_id, value) DO UPDATE SET label = EXCLUDED.label, is_active = true, updated_by = $5`,
    [attributeId, value, label, maxSort.rows[0].next, session?.userId ?? null]
  )
  revalidatePath("/pricing/attributes")
}

export async function setValueActive(valueId: string, active: boolean) {
  const session = await getCurrentSession()
  const db = getDbPool()
  await db.query(
    `UPDATE pricing.attribute_values SET is_active = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`,
    [active, session?.userId ?? null, valueId]
  )
  revalidatePath("/pricing/attributes")
}

/**
 * Flags whether changing this attribute invalidates an already-generated AI cake image — read by
 * nothing yet (no storefront enforcement exists for this), but OPS can start marking it accurately now
 * so that follow-up work has real data instead of a blank slate.
 */
export async function setRequiresRegeneration(attributeId: string, requiresRegeneration: boolean) {
  const session = await getCurrentSession()
  const db = getDbPool()
  await db.query(
    `UPDATE pricing.attributes SET requires_regeneration = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`,
    [requiresRegeneration, session?.userId ?? null, attributeId]
  )
  revalidatePath("/pricing/attributes")
}
