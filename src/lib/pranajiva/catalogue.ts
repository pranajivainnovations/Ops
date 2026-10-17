/**
 * The live PranaJiva catalogue, read straight from Postgres.
 *
 * Reads come from the database and writes go through the backend's `/ops/*` routes — the split
 * lib/backend.ts describes. Creating or changing a product has to run through Medusa's own
 * services so its hooks, events and indexing fire; reading does not, and going through the backend
 * for a list would be a second hop for no benefit.
 *
 * ── Why `metadata->>'brand'` and not product_category ─────────────────────────────────────────
 * Brand is metadata on the product, or on its collection. The `product_category` rows are legacy
 * and are not read, written or filtered on anywhere — see the catalogue rules in AGENTS.md.
 */

import { getDbPool } from "@/lib/db"

export interface CatalogueVariant {
  id: string
  title: string | null
  sku: string | null
  /** Paise. Null when the variant has no INR price, which is a product that cannot be bought. */
  pricePaise: number | null
  inventoryQuantity: number | null
}

export interface CatalogueImage {
  id: string
  url: string
}

export interface CatalogueProduct {
  id: string
  handle: string
  title: string
  subtitle: string | null
  description: string | null
  status: string
  thumbnail: string | null
  collectionId: string | null
  collectionTitle: string | null
  metadata: Record<string, unknown>
  images: CatalogueImage[]
  variants: CatalogueVariant[]
  /** Orders that reference this product, which is what makes a delete unsafe. */
  orderCount: number
}

export interface CatalogueSummary {
  id: string
  handle: string
  title: string
  status: string
  thumbnail: string | null
  collectionTitle: string | null
  imageCount: number
  variantCount: number
  /** Lowest INR price across variants, in paise. */
  fromPaise: number | null
  /** Fields that are empty and shouldn't be — surfaced in the list so they get fixed. */
  warnings: string[]
}

const BRAND_FILTER = `(
  p.metadata->>'brand' = 'pranajiva'
  OR EXISTS (
    SELECT 1 FROM product_collection pc
     WHERE pc.id = p.collection_id AND pc.metadata->>'brand' = 'pranajiva'
  )
)`

/**
 * Everything in the brand, newest first, with the gaps called out.
 *
 * The warnings are the point of this screen rather than a nicety: a product with no image is
 * silently excluded from the Google Merchant feed, and one with no INR price cannot be added to a
 * cart at all. Both are invisible in Medusa's admin, which shows a perfectly healthy-looking row.
 */
export async function listCatalogue(): Promise<CatalogueSummary[]> {
  const db = getDbPool()

  const { rows } = await db.query(
    `SELECT p.id, p.handle, p.title, p.status, p.thumbnail, p.metadata,
            pc.title AS collection_title,
            (SELECT count(*)::int FROM product_images pi WHERE pi.product_id = p.id) AS image_count,
            (SELECT count(*)::int FROM product_variant pv
              WHERE pv.product_id = p.id AND pv.deleted_at IS NULL) AS variant_count,
            (SELECT min(ma.amount)::int
               FROM product_variant pv
               JOIN product_variant_money_amount pvma
                 ON pvma.variant_id = pv.id AND pvma.deleted_at IS NULL
               JOIN money_amount ma ON ma.id = pvma.money_amount_id
              WHERE pv.product_id = p.id AND pv.deleted_at IS NULL
                AND ma.currency_code = 'inr' AND ma.deleted_at IS NULL
                /* The default price only. A price_list row is a sale or a customer-group
                   override, and showing one as the product's price misreports the catalogue. */
                AND ma.price_list_id IS NULL) AS from_paise
       FROM product p
       LEFT JOIN product_collection pc ON pc.id = p.collection_id
      WHERE p.deleted_at IS NULL AND ${BRAND_FILTER}
      ORDER BY p.created_at DESC`
  )

  return rows.map((r) => {
    const metadata = (r.metadata ?? {}) as Record<string, unknown>
    const warnings: string[] = []

    /**
     * Thumbnail, not gallery count. All twelve hampers carry a thumbnail and no gallery images at
     * all, which is a complete product — the storefront, the feed and the social preview all read
     * `thumbnail`. Warning on an empty gallery would have flagged twelve healthy products and
     * taught whoever reads this screen to ignore it.
     */
    if (!r.thumbnail) {
      warnings.push("no image — left out of the Google feed and shares with no preview")
    }
    if (r.from_paise === null) warnings.push("no INR price — cannot be added to a cart")
    /**
     * A product reaches the storefront either by its own `brand` or by its collection's. The
     * second works but is held up by one row somewhere else: move the product out of that
     * collection and it silently leaves the site. Worth saying so rather than showing it as fine.
     */
    if (metadata.brand !== "pranajiva") {
      warnings.push(`brand not set — on the site only through “${r.collection_title ?? "?"}”`)
    }
    if (!metadata.seo_description) warnings.push("no SEO description")

    return {
      id: r.id,
      handle: r.handle,
      title: r.title,
      status: r.status,
      thumbnail: r.thumbnail,
      collectionTitle: r.collection_title,
      imageCount: r.image_count,
      variantCount: r.variant_count,
      fromPaise: r.from_paise,
      warnings,
    }
  })
}

/** One product, with everything the editor needs. Null when it is not ours or has been deleted. */
export async function getCatalogueProduct(id: string): Promise<CatalogueProduct | null> {
  const db = getDbPool()

  const { rows } = await db.query(
    `SELECT p.id, p.handle, p.title, p.subtitle, p.description, p.status, p.thumbnail,
            p.collection_id, p.metadata, pc.title AS collection_title
       FROM product p
       LEFT JOIN product_collection pc ON pc.id = p.collection_id
      WHERE p.id = $1 AND p.deleted_at IS NULL AND ${BRAND_FILTER}`,
    [id]
  )
  if (!rows.length) return null
  const p = rows[0]

  const { rows: images } = await db.query(
    `SELECT i.id, i.url
       FROM product_images pi JOIN image i ON i.id = pi.image_id
      WHERE pi.product_id = $1
      ORDER BY i.created_at`,
    [id]
  )

  const { rows: variants } = await db.query(
    `SELECT pv.id, pv.title, pv.sku, pv.inventory_quantity,
            (SELECT ma.amount
               FROM product_variant_money_amount pvma
               JOIN money_amount ma ON ma.id = pvma.money_amount_id
              WHERE pvma.variant_id = pv.id AND pvma.deleted_at IS NULL
                AND ma.currency_code = 'inr' AND ma.deleted_at IS NULL
                AND ma.price_list_id IS NULL
              LIMIT 1)::int AS price_paise
       FROM product_variant pv
      WHERE pv.product_id = $1 AND pv.deleted_at IS NULL
      ORDER BY pv.variant_rank NULLS LAST, pv.created_at`,
    [id]
  )

  /* Counted on the variant, because that is what an order line references. This is the number that
     decides whether removing the product is reversible. */
  const { rows: orders } = await db.query(
    `SELECT count(DISTINCT li.order_id)::int AS n
       FROM line_item li
       JOIN product_variant pv ON pv.id = li.variant_id
      WHERE pv.product_id = $1 AND li.order_id IS NOT NULL`,
    [id]
  )

  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    subtitle: p.subtitle,
    description: p.description,
    status: p.status,
    thumbnail: p.thumbnail,
    collectionId: p.collection_id,
    collectionTitle: p.collection_title,
    metadata: (p.metadata ?? {}) as Record<string, unknown>,
    images: images.map((i) => ({ id: i.id, url: i.url })),
    variants: variants.map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      pricePaise: v.price_paise,
      inventoryQuantity: v.inventory_quantity,
    })),
    orderCount: orders[0]?.n ?? 0,
  }
}

/**
 * The collections a PranaJiva product can sit in.
 *
 * Read rather than listed in code: the rule is that Medusa owns what exists, and a hardcoded set
 * of collections would stop matching the database the first time somebody adds one.
 */
export async function listBrandCollections(): Promise<{ id: string; title: string }[]> {
  const db = getDbPool()
  const { rows } = await db.query(
    `SELECT pc.id, pc.title
       FROM product_collection pc
      WHERE pc.deleted_at IS NULL
        AND (pc.metadata->>'brand' = 'pranajiva'
             OR EXISTS (SELECT 1 FROM product p
                         WHERE p.collection_id = pc.id AND p.deleted_at IS NULL
                           AND p.metadata->>'brand' = 'pranajiva'))
      ORDER BY pc.title`
  )
  return rows.map((r) => ({ id: r.id, title: r.title }))
}

/** Handles, for the "Pairs with" picker. Cheap, and avoids typing a handle that does not exist. */
export async function listHandles(): Promise<{ handle: string; title: string }[]> {
  const db = getDbPool()
  const { rows } = await db.query(
    `SELECT p.handle, p.title FROM product p
      WHERE p.deleted_at IS NULL AND ${BRAND_FILTER}
      ORDER BY p.title`
  )
  return rows.map((r) => ({ handle: r.handle, title: r.title }))
}

export function formatPaise(paise: number | null): string {
  if (paise === null) return "—"
  return `₹${(paise / 100).toLocaleString("en-IN")}`
}
