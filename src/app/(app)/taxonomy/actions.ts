"use server"

import { revalidatePath } from "next/cache"
import { getDbPool } from "@/lib/db"
import { getCurrentSession } from "@/lib/auth"

/**
 * Editing the CrossFriend taxonomy: product types, occasions, and the matrix that pairs them.
 *
 * ── Two tables per concept, on purpose ──────────────────────────────────────────────────────────
 * Adding a product type here writes TWO rows: a Medusa `product_type` (so products can actually be
 * filed against it) and a `crossfriend.product_types` registry row (so it appears in CrossFriend
 * navigation). Both are needed and neither implies the other — Pranajiva's types live in the first
 * table and must never reach the second, since the two brands share this database.
 *
 * Where a Medusa row already exists for the value, it is ADOPTED rather than duplicated. Neither
 * product_type.value nor product_collection.handle carries a unique constraint, so a blind insert
 * would silently create a second row and split the catalogue between them.
 *
 * ── Nothing here deletes ────────────────────────────────────────────────────────────────────────
 * Retiring is `is_active = false`. Deleting a type would cascade its matrix pairings away, so
 * bringing "Costumes" back after a season would silently lose which occasions it belonged to — and
 * products filed against it would be left pointing at nothing. Deactivation removes it from the
 * storefront while keeping every relationship intact.
 */

/** URL- and filter-safe machine value. This ends up in `/store?type=...`, so it must be stable. */
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

async function actor(): Promise<string | null> {
  const session = await getCurrentSession()
  return session?.userId ?? null
}

function done() {
  revalidatePath("/taxonomy")
}

// ── Product types ───────────────────────────────────────────────────────────────────────────────

export async function addProductType(formData: FormData) {
  const value = slugify(String(formData.get("value") ?? ""))
  const label = String(formData.get("label") ?? "").trim()
  const emoji = String(formData.get("emoji") ?? "").trim() || null
  if (!value || !label) return

  const db = getDbPool()
  const userId = await actor()
  const client = await db.connect()

  try {
    await client.query("BEGIN")

    // Adopt an existing Medusa type if one already carries this value; otherwise create it.
    // Deterministic id matches the ptyp_cf_* convention used by the taxonomy migration.
    const existing = await client.query(
      `SELECT id FROM public.product_type WHERE value = $1 AND deleted_at IS NULL`,
      [value]
    )
    let typeId: string = existing.rows[0]?.id
    if (!typeId) {
      typeId = `ptyp_cf_${value.replace(/-/g, "_")}`
      await client.query(
        `INSERT INTO public.product_type (id, value, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
        [typeId, value]
      )
    }

    const nextOrder = await client.query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM crossfriend.product_types`
    )

    // Re-adding something previously retired reactivates it rather than erroring — its matrix
    // pairings are still there, which is the whole reason deactivation isn't a delete.
    await client.query(
      `INSERT INTO crossfriend.product_types (type_id, label, emoji, display_order, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (type_id) DO UPDATE
          SET label = EXCLUDED.label, emoji = EXCLUDED.emoji,
              is_active = true, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [typeId, label, emoji, nextOrder.rows[0].next, userId]
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[taxonomy] addProductType failed", error)
  } finally {
    client.release()
  }

  done()
}

export async function updateProductType(typeId: string, formData: FormData) {
  const label = String(formData.get("label") ?? "").trim()
  const emoji = String(formData.get("emoji") ?? "").trim() || null
  const order = parseInt(String(formData.get("displayOrder") ?? ""), 10)
  if (!label) return

  const db = getDbPool()
  await db.query(
    `UPDATE crossfriend.product_types
        SET label = $1, emoji = $2, display_order = COALESCE($3, display_order),
            updated_at = NOW(), updated_by = $4
      WHERE type_id = $5`,
    [label, emoji, Number.isFinite(order) ? order : null, await actor(), typeId]
  )
  done()
}

export async function setProductTypeActive(typeId: string, active: boolean) {
  const db = getDbPool()
  await db.query(
    `UPDATE crossfriend.product_types
        SET is_active = $1, updated_at = NOW(), updated_by = $2 WHERE type_id = $3`,
    [active, await actor(), typeId]
  )
  done()
}

// ── Occasions ───────────────────────────────────────────────────────────────────────────────────

export async function addOccasion(formData: FormData) {
  const handle = slugify(String(formData.get("handle") ?? ""))
  const label = String(formData.get("label") ?? "").trim()
  const tagline = String(formData.get("tagline") ?? "").trim() || null
  const emoji = String(formData.get("emoji") ?? "").trim() || null
  if (!handle || !label) return

  const db = getDbPool()
  const userId = await actor()
  const client = await db.connect()

  try {
    await client.query("BEGIN")

    const existing = await client.query(
      `SELECT id FROM public.product_collection WHERE handle = $1 AND deleted_at IS NULL`,
      [handle]
    )
    let collectionId: string = existing.rows[0]?.id
    if (!collectionId) {
      collectionId = `pcol_cf_${handle.replace(/-/g, "_")}`
      await client.query(
        `INSERT INTO public.product_collection (id, title, handle, created_at, updated_at, metadata)
         VALUES ($1, $2, $3, NOW(), NOW(), '{"brand":"crossfriend"}'::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [collectionId, label, handle]
      )
    }

    const nextOrder = await client.query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM crossfriend.occasions`
    )

    await client.query(
      `INSERT INTO crossfriend.occasions
             (collection_id, label, tagline, emoji, display_order, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (collection_id) DO UPDATE
          SET label = EXCLUDED.label, tagline = EXCLUDED.tagline, emoji = EXCLUDED.emoji,
              is_active = true, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [collectionId, label, tagline, emoji, nextOrder.rows[0].next, userId]
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[taxonomy] addOccasion failed", error)
  } finally {
    client.release()
  }

  done()
}

export async function updateOccasion(collectionId: string, formData: FormData) {
  const label = String(formData.get("label") ?? "").trim()
  const tagline = String(formData.get("tagline") ?? "").trim() || null
  const emoji = String(formData.get("emoji") ?? "").trim() || null
  const order = parseInt(String(formData.get("displayOrder") ?? ""), 10)
  if (!label) return

  const db = getDbPool()
  await db.query(
    `UPDATE crossfriend.occasions
        SET label = $1, tagline = $2, emoji = $3,
            display_order = COALESCE($4, display_order), updated_at = NOW(), updated_by = $5
      WHERE collection_id = $6`,
    [label, tagline, emoji, Number.isFinite(order) ? order : null, await actor(), collectionId]
  )
  done()
}

export async function setOccasionActive(collectionId: string, active: boolean) {
  const db = getDbPool()
  await db.query(
    `UPDATE crossfriend.occasions
        SET is_active = $1, updated_at = NOW(), updated_by = $2 WHERE collection_id = $3`,
    [active, await actor(), collectionId]
  )
  done()
}

// ── The matrix ──────────────────────────────────────────────────────────────────────────────────

/**
 * Pair or unpair one occasion with one product type.
 *
 * A pairing either exists or it does not — there is no third state and no ordering to preserve on
 * removal, so unpairing genuinely is a DELETE here. Re-adding restores it at the end of that
 * occasion's section order, which is the honest default: we cannot know where it used to sit.
 *
 * The foreign keys do the validation. A type that is not registered as a CrossFriend type cannot
 * be paired at all, which is what keeps Pranajiva's catalogue structurally out of CrossFriend
 * navigation rather than relying on every caller to filter correctly.
 */
export async function setMatrixPairing(
  collectionId: string,
  typeId: string,
  enabled: boolean
) {
  const db = getDbPool()

  if (enabled) {
    const nextOrder = await db.query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 AS next
         FROM crossfriend.occasion_product_types WHERE collection_id = $1`,
      [collectionId]
    )
    await db.query(
      `INSERT INTO crossfriend.occasion_product_types
             (collection_id, type_id, display_order, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (collection_id, type_id) DO NOTHING`,
      [collectionId, typeId, nextOrder.rows[0].next, await actor()]
    )
  } else {
    await db.query(
      `DELETE FROM crossfriend.occasion_product_types
        WHERE collection_id = $1 AND type_id = $2`,
      [collectionId, typeId]
    )
  }

  done()
}
