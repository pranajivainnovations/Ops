"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getDbPool } from "@/lib/db"
import { getCurrentSession } from "@/lib/auth"

const CATEGORY_KEY = "cake"

// The UI never emits EQUALS/NOT_EQUALS — IN/NOT_IN with one checked value is functionally identical
// (the engine checks "selected id is/isn't in this set"), so the business-friendly builder only needs
// one value-based operator pair. The column still accepts EQUALS/NOT_EQUALS (schema unchanged) in case
// anything else ever writes a row directly.
const TRIGGER_OPERATORS = ["IN", "NOT_IN", "MIN_VALUE", "MAX_VALUE"] as const
const RULE_KINDS = ["MIN_VALUE", "MAX_VALUE", "ALLOWED_VALUES", "FORBIDDEN_VALUES", "RECOMMENDED_VALUES"] as const

async function getCategoryId(): Promise<string> {
  const db = getDbPool()
  const res = await db.query(`SELECT id FROM pricing.product_categories WHERE key = $1`, [CATEGORY_KEY])
  return res.rows[0].id
}

/**
 * Opens a new draft by cloning every rule (and its value/trigger-value rows) from the currently
 * published set — same clone-forward pattern as the Pricing Rule Set tab. No-op if a draft already
 * exists.
 */
export async function startDraft() {
  const session = await getCurrentSession()
  const db = getDbPool()
  const categoryId = await getCategoryId()

  const existingDraft = await db.query(
    `SELECT id FROM constraints.rule_sets WHERE category_id = $1 AND status = 'draft'`,
    [categoryId]
  )
  if (existingDraft.rows.length > 0) {
    redirect("/constraints")
  }

  const published = await db.query(
    `SELECT id, version FROM constraints.rule_sets WHERE category_id = $1 AND status = 'published' ORDER BY version DESC LIMIT 1`,
    [categoryId]
  )
  const publishedId: string | undefined = published.rows[0]?.id
  const nextVersion: number = (published.rows[0]?.version ?? 0) + 1

  const draft = await db.query(
    `INSERT INTO constraints.rule_sets (category_id, version, status, created_by)
     VALUES ($1, $2, 'draft', $3) RETURNING id`,
    [categoryId, nextVersion, session?.userId ?? null]
  )
  const draftId = draft.rows[0].id

  if (publishedId) {
    const oldRules = await db.query(`SELECT * FROM constraints.rules WHERE rule_set_id = $1`, [publishedId])
    for (const r of oldRules.rows) {
      const newRule = await db.query(
        `INSERT INTO constraints.rules
           (rule_set_id, trigger_attribute_id, trigger_operator, trigger_numeric_value,
            target_attribute_id, kind, numeric_value, message, priority, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          draftId,
          r.trigger_attribute_id,
          r.trigger_operator,
          r.trigger_numeric_value,
          r.target_attribute_id,
          r.kind,
          r.numeric_value,
          r.message,
          r.priority,
          session?.userId ?? null,
        ]
      )
      const newRuleId = newRule.rows[0].id
      await db.query(
        `INSERT INTO constraints.rule_values (rule_id, attribute_value_id)
         SELECT $1, attribute_value_id FROM constraints.rule_values WHERE rule_id = $2`,
        [newRuleId, r.id]
      )
      await db.query(
        `INSERT INTO constraints.rule_trigger_values (rule_id, attribute_value_id)
         SELECT $1, attribute_value_id FROM constraints.rule_trigger_values WHERE rule_id = $2`,
        [newRuleId, r.id]
      )
    }
  }

  revalidatePath("/constraints")
  redirect("/constraints")
}

export async function discardDraft(draftId: string) {
  const db = getDbPool()
  await db.query(`DELETE FROM constraints.rule_sets WHERE id = $1 AND status = 'draft'`, [draftId])
  revalidatePath("/constraints")
}

/** Shared field-extraction for add/update — same form shape either way. */
function readRuleForm(formData: FormData) {
  const triggerAttributeId = String(formData.get("triggerAttributeId") ?? "").trim() || null
  const triggerOperatorRaw = String(formData.get("triggerOperator") ?? "").trim()
  const triggerOperator =
    triggerAttributeId && (TRIGGER_OPERATORS as readonly string[]).includes(triggerOperatorRaw) ? triggerOperatorRaw : null
  const triggerNumericRaw = formData.get("triggerNumericValue")
  const triggerNumericValue = triggerNumericRaw != null && String(triggerNumericRaw).trim() !== "" ? Number(triggerNumericRaw) : null
  const triggerValueIds = formData.getAll("triggerValueIds").map(String).filter(Boolean)

  const targetAttributeId = String(formData.get("targetAttributeId") ?? "").trim()
  const kind = String(formData.get("kind") ?? "").trim()
  const numericRaw = formData.get("numericValue")
  const numericValue = numericRaw != null && String(numericRaw).trim() !== "" ? Number(numericRaw) : null
  const valueIds = formData.getAll("valueIds").map(String).filter(Boolean)

  const message = String(formData.get("message") ?? "").trim()
  const priority = Number(formData.get("priority") ?? 0) || 0

  return {
    triggerAttributeId,
    triggerOperator,
    triggerNumericValue: triggerOperator === "MIN_VALUE" || triggerOperator === "MAX_VALUE" ? triggerNumericValue : null,
    triggerValueIds: triggerOperator === "IN" || triggerOperator === "NOT_IN" ? triggerValueIds : [],
    targetAttributeId,
    kind: (RULE_KINDS as readonly string[]).includes(kind) ? kind : null,
    numericValue: kind === "MIN_VALUE" || kind === "MAX_VALUE" ? numericValue : null,
    valueIds: kind !== "MIN_VALUE" && kind !== "MAX_VALUE" ? valueIds : [],
    message,
    priority,
  }
}

/**
 * Adds one rule to the draft. Target attribute now comes from the form itself (a single global
 * builder, not a form scoped per-attribute-section) — trigger and target value sets are both real
 * `attribute_value` checkboxes rendered from the already-loaded catalog, never free text.
 */
export async function addRule(formData: FormData) {
  const session = await getCurrentSession()
  const db = getDbPool()
  const categoryId = await getCategoryId()

  const draftRes = await db.query(`SELECT id FROM constraints.rule_sets WHERE category_id = $1 AND status = 'draft'`, [categoryId])
  const ruleSetId = draftRes.rows[0]?.id
  if (!ruleSetId) return

  const f = readRuleForm(formData)
  if (!f.targetAttributeId || !f.kind || !f.message) return

  const ruleRes = await db.query(
    `INSERT INTO constraints.rules
       (rule_set_id, trigger_attribute_id, trigger_operator, trigger_numeric_value,
        target_attribute_id, kind, numeric_value, message, priority, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      ruleSetId,
      f.triggerAttributeId,
      f.triggerOperator,
      f.triggerNumericValue,
      f.targetAttributeId,
      f.kind,
      f.numericValue,
      f.message,
      f.priority,
      session?.userId ?? null,
    ]
  )
  const ruleId = ruleRes.rows[0]?.id
  if (!ruleId) return

  for (const valueId of f.valueIds) {
    await db.query(`INSERT INTO constraints.rule_values (rule_id, attribute_value_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [ruleId, valueId])
  }
  for (const valueId of f.triggerValueIds) {
    await db.query(`INSERT INTO constraints.rule_trigger_values (rule_id, attribute_value_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [ruleId, valueId])
  }

  revalidatePath("/constraints")
}

/** Same field set as addRule; replaces the rule's value/trigger-value rows rather than diffing them. */
export async function updateRule(ruleId: string, formData: FormData) {
  const session = await getCurrentSession()
  const db = getDbPool()

  const f = readRuleForm(formData)
  if (!f.targetAttributeId || !f.kind || !f.message) return

  const client = await db.connect()
  try {
    await client.query("BEGIN")
    const updated = await client.query(
      `UPDATE constraints.rules
       SET trigger_attribute_id = $1, trigger_operator = $2, trigger_numeric_value = $3,
           target_attribute_id = $4, kind = $5, numeric_value = $6, message = $7, priority = $8,
           updated_by = $9, updated_at = NOW()
       WHERE id = $10 AND rule_set_id IN (SELECT id FROM constraints.rule_sets WHERE status = 'draft')
       RETURNING id`,
      [
        f.triggerAttributeId,
        f.triggerOperator,
        f.triggerNumericValue,
        f.targetAttributeId,
        f.kind,
        f.numericValue,
        f.message,
        f.priority,
        session?.userId ?? null,
        ruleId,
      ]
    )
    if (updated.rows.length === 0) {
      // Not a draft rule (or doesn't exist) — nothing to replace, roll back and bail quietly.
      await client.query("ROLLBACK")
      client.release()
      return
    }

    await client.query(`DELETE FROM constraints.rule_values WHERE rule_id = $1`, [ruleId])
    await client.query(`DELETE FROM constraints.rule_trigger_values WHERE rule_id = $1`, [ruleId])
    for (const valueId of f.valueIds) {
      await client.query(`INSERT INTO constraints.rule_values (rule_id, attribute_value_id) VALUES ($1, $2)`, [ruleId, valueId])
    }
    for (const valueId of f.triggerValueIds) {
      await client.query(`INSERT INTO constraints.rule_trigger_values (rule_id, attribute_value_id) VALUES ($1, $2)`, [ruleId, valueId])
    }
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }

  revalidatePath("/constraints")
}

export async function deleteRule(ruleId: string) {
  const db = getDbPool()
  // Scoped to draft rule sets only — a published rule set must stay immutable no matter what reaches
  // this action, same defense-in-depth as the Pricing tab's update actions.
  await db.query(
    `DELETE FROM constraints.rules WHERE id = $1 AND rule_set_id IN (SELECT id FROM constraints.rule_sets WHERE status = 'draft')`,
    [ruleId]
  )
  revalidatePath("/constraints")
}

/**
 * No completeness gate on publish (unlike Pricing's base-price requirement) — an empty or partial
 * constraint rule set is a legitimate published state; "nothing configured" just means nothing is
 * constrained yet.
 */
export async function publishDraft(draftId: string) {
  const session = await getCurrentSession()
  const db = getDbPool()

  const draftRes = await db.query(`SELECT category_id FROM constraints.rule_sets WHERE id = $1 AND status = 'draft'`, [draftId])
  const categoryId = draftRes.rows[0]?.category_id
  if (!categoryId) return

  const client = await db.connect()
  try {
    await client.query("BEGIN")
    await client.query(
      `UPDATE constraints.rule_sets SET status = 'archived', effective_to = NOW() WHERE category_id = $1 AND status = 'published'`,
      [categoryId]
    )
    await client.query(
      `UPDATE constraints.rule_sets SET status = 'published', effective_from = NOW(), published_at = NOW(), published_by = $1 WHERE id = $2`,
      [session?.userId ?? null, draftId]
    )
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }

  revalidatePath("/constraints")
  redirect("/constraints")
}
