/**
 * One-time bootstrap for the `pricing` schema — cake category, attributes/values, and a v1 published
 * rule_set, transcribed from the values that were live in `ai-cake-studio-config.json` so nothing
 * changes price-wise on cutover. Ops edits everything from here on via the OPS pricing pages, not by
 * re-running this script.
 *
 * Safe to re-run: categories/attributes/attribute_values upsert (so adding a brand-new flavor/shape
 * later is just editing the list below and re-running), but the rule_set + its rules are only ever
 * created once — a published rule_set is meant to be immutable (see the design doc), so re-running
 * this after v1 already exists is a deliberate no-op for that part, not an update path.
 *
 * Run: node scripts/seed-pricing-config.js
 */
require("dotenv").config({ path: ".env.local" })
const { Client } = require("pg")

// Transcribed exactly from ai-cake-studio-config.json → pricing, at the time of cutover.
const BASE_BY_WEIGHT = { "0.5": 500, "1": 900, "1.5": 1350, "2": 1800, "2.5": 2250, "3": 2700, "4": 3600, "5": 4500 }
const WEIGHT_SERVES = { "0.5": "4–6", "1": "8–10", "1.5": "12–15", "2": "16–20", "2.5": "20–25", "3": "25–30", "4": "30–40", "5": "40–50" }
const TIER_MULTIPLIER = { "1": 1.0, "2": 1.4, "3": 1.8, "4": 2.3 }
const TIER_LABEL = { "1": "Single tier", "2": "Two tiers", "3": "Three tiers", "4": "Four tiers" }
const SHAPE_ADJUSTMENT = { Round: 0, Square: 150, Heart: 200, Oval: 150 }
const STYLE_ADJUSTMENT = { Realistic: 0, Cartoon: 200, Luxury: 500, Minimal: 0, "3D Sculpted": 600, Wedding: 400, Kids: 200 }
const STYLE_EMOJI = { Realistic: "🎂", Cartoon: "🎨", Luxury: "✨", Minimal: "🤍", "3D Sculpted": "🏆", Wedding: "💍", Kids: "🎠" }
const FLAVOR_ADJUSTMENT = {
  Chocolate: 0, Vanilla: 0, "Red Velvet": 100, Strawberry: 100, Butterscotch: 50,
  "Salted Caramel": 150, Mango: 150, Blueberry: 200, Lemon: 100,
}
const FLAVOR_EMOJI = {
  Chocolate: "🍫", Vanilla: "🍦", "Red Velvet": "❤️", Strawberry: "🍓", Butterscotch: "🧈",
  "Salted Caramel": "🍮", Mango: "🥭", Blueberry: "🫐", Lemon: "🍋",
}
const FLAT_FEES = {
  express_delivery: { label: "Express Delivery", amount: 300 },
  midnight_delivery: { label: "Midnight Delivery", amount: 200 },
  message_on_cake: { label: "Message on Cake", amount: 50 },
  photo_on_cake: { label: "Photo on Cake", amount: 150 },
}

async function upsertCategory(client) {
  const res = await client.query(
    `INSERT INTO pricing.product_categories (key, label)
     VALUES ('cake', 'Cake')
     ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label
     RETURNING id`
  )
  return res.rows[0].id
}

async function upsertAttribute(client, categoryId, key, label, inputType, sortOrder) {
  const res = await client.query(
    `INSERT INTO pricing.attributes (category_id, key, label, input_type, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, input_type = EXCLUDED.input_type
     RETURNING id`,
    [categoryId, key, label, inputType, sortOrder]
  )
  return res.rows[0].id
}

async function upsertValue(client, attributeId, value, label, extra, sortOrder) {
  const res = await client.query(
    `INSERT INTO pricing.attribute_values (attribute_id, value, label, extra, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (attribute_id, value) DO UPDATE SET label = EXCLUDED.label, extra = EXCLUDED.extra
     RETURNING id`,
    [attributeId, value, label, JSON.stringify(extra || {}), sortOrder]
  )
  return res.rows[0].id
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error("DATABASE_URL is not set (check .env.local).")
    process.exit(1)
  }

  const client = new Client({ connectionString })
  await client.connect()

  try {
    const categoryId = await upsertCategory(client)

    const weightAttrId = await upsertAttribute(client, categoryId, "weight", "Weight", "select", 1)
    const tiersAttrId = await upsertAttribute(client, categoryId, "tiers", "Tiers", "select", 2)
    const shapeAttrId = await upsertAttribute(client, categoryId, "shape", "Shape", "select", 3)
    const styleAttrId = await upsertAttribute(client, categoryId, "style", "Style", "select", 4)
    const flavorAttrId = await upsertAttribute(client, categoryId, "flavor", "Flavor", "select", 5)
    const expressAttrId = await upsertAttribute(client, categoryId, "express_delivery", "Express Delivery", "toggle", 6)
    const midnightAttrId = await upsertAttribute(client, categoryId, "midnight_delivery", "Midnight Delivery", "toggle", 7)
    const messageAttrId = await upsertAttribute(client, categoryId, "message_on_cake", "Message on Cake", "toggle", 8)
    const photoAttrId = await upsertAttribute(client, categoryId, "photo_on_cake", "Photo on Cake", "toggle", 9)

    const weightValueId = {}
    let i = 0
    for (const value of Object.keys(BASE_BY_WEIGHT)) {
      weightValueId[value] = await upsertValue(client, weightAttrId, value, `${value} Kg`, { serves: WEIGHT_SERVES[value] }, i++)
    }

    const tierValueId = {}
    i = 0
    for (const value of Object.keys(TIER_MULTIPLIER)) {
      tierValueId[value] = await upsertValue(client, tiersAttrId, value, TIER_LABEL[value], {}, i++)
    }

    const shapeValueId = {}
    i = 0
    for (const value of Object.keys(SHAPE_ADJUSTMENT)) {
      shapeValueId[value] = await upsertValue(client, shapeAttrId, value, value, {}, i++)
    }

    const styleValueId = {}
    i = 0
    for (const value of Object.keys(STYLE_ADJUSTMENT)) {
      styleValueId[value] = await upsertValue(client, styleAttrId, value, value, { emoji: STYLE_EMOJI[value] }, i++)
    }

    const flavorValueId = {}
    i = 0
    for (const value of Object.keys(FLAVOR_ADJUSTMENT)) {
      flavorValueId[value] = await upsertValue(client, flavorAttrId, value, value, { emoji: FLAVOR_EMOJI[value] }, i++)
    }

    const feeAttrByKey = {
      express_delivery: expressAttrId,
      midnight_delivery: midnightAttrId,
      message_on_cake: messageAttrId,
      photo_on_cake: photoAttrId,
    }
    const feeValueId = {}
    for (const [key, fee] of Object.entries(FLAT_FEES)) {
      feeValueId[key] = await upsertValue(client, feeAttrByKey[key], "on", fee.label, {}, 0)
    }

    // Published rule_sets are immutable by convention — only ever create version 1 once.
    const existing = await client.query(
      `SELECT id FROM pricing.rule_sets WHERE category_id = $1 AND version = 1`,
      [categoryId]
    )
    if (existing.rows.length > 0) {
      console.log("Attributes/values upserted. Rule set v1 already exists — left untouched (published rule sets are immutable).")
      await client.end()
      return
    }

    const ruleSetRes = await client.query(
      `INSERT INTO pricing.rule_sets (category_id, version, status, effective_from, published_at)
       VALUES ($1, 1, 'published', NOW(), NOW())
       RETURNING id`,
      [categoryId]
    )
    const ruleSetId = ruleSetRes.rows[0].id

    for (const [value, amount] of Object.entries(BASE_BY_WEIGHT)) {
      await client.query(
        `INSERT INTO pricing.base_price_rules (rule_set_id, weight_value_id, region_id, amount)
         VALUES ($1, $2, NULL, $3)`,
        [ruleSetId, weightValueId[value], amount]
      )
    }

    async function insertAdjustment(attributeValueId, calcTarget, adjType, amount, label, order) {
      await client.query(
        `INSERT INTO pricing.adjustment_rules
           (rule_set_id, attribute_value_id, region_id, calculation_target, adjustment_type, amount, label, display_order, evaluation_order)
         VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $7)`,
        [ruleSetId, attributeValueId, calcTarget, adjType, amount, label, order]
      )
    }

    // Tier multiplier applies to the raw base weight price only — matches the original
    // `tierExtra = base * (multiplier - 1)` formula exactly (never against a running subtotal).
    let order = 1
    for (const [value, multiplier] of Object.entries(TIER_MULTIPLIER)) {
      await insertAdjustment(tierValueId[value], "BASE", "multiplier", multiplier, null, order++)
    }
    for (const [value, amount] of Object.entries(SHAPE_ADJUSTMENT)) {
      await insertAdjustment(shapeValueId[value], "RUNNING_SUBTOTAL", "flat", amount, null, order++)
    }
    for (const [value, amount] of Object.entries(STYLE_ADJUSTMENT)) {
      await insertAdjustment(styleValueId[value], "RUNNING_SUBTOTAL", "flat", amount, null, order++)
    }
    for (const [value, amount] of Object.entries(FLAVOR_ADJUSTMENT)) {
      // Seeded as 'flat' — matching current live behavior exactly. Individual flavors can be
      // switched to 'per_kg' later in OPS once real per-kg cost differentials are known; doing that
      // now for all of them would silently change every live price on cutover, not just fix one.
      await insertAdjustment(flavorValueId[value], "RUNNING_SUBTOTAL", "flat", amount, null, order++)
    }
    for (const [key, fee] of Object.entries(FLAT_FEES)) {
      await insertAdjustment(feeValueId[key], "RUNNING_SUBTOTAL", "flat", fee.amount, fee.label, order++)
    }

    console.log(`Pricing config seeded. category=${categoryId} rule_set(v1, published)=${ruleSetId}`)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
