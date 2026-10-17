"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth"
import { callBackend } from "@/lib/backend"
import { getCatalogueProduct } from "@/lib/pranajiva/catalogue"
import { FIELD_GROUPS, fromFormValue } from "@/lib/pranajiva/product-fields"
import { uploadProductImage } from "@/lib/s3"

/**
 * Every write the catalogue screen makes.
 *
 * All of them go through the backend rather than this app's database pool, even though OPS reads
 * Postgres directly two files away. Medusa fires hooks, events and search indexing from its own
 * services; a raw UPDATE skips all of it and leaves a product that is correct in the table and
 * stale everywhere that listens. See lib/backend.ts.
 *
 * ── Why these return a string instead of throwing ─────────────────────────────────────────────
 * The forms are progressively enhanced and submit without JavaScript, so a thrown error is a
 * Next.js error page and a lost form. Returning the message lets the screen show it next to the
 * thing that failed, with everything typed still on screen.
 */

const BASE = "/pranajiva/catalogue"

export interface ActionResult {
  error?: string
  ok?: string
}

/** Nobody signed in, nothing happens. Every action starts here. */
async function requireSession(): Promise<void> {
  const session = await getCurrentSession()
  if (!session) throw new Error("Your session has expired. Sign in again.")
}

/* ── Create ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * Creates the product and goes straight to its editor.
 *
 * It is created as a draft with one priced variant — see the backend route for why both are
 * non-negotiable — so the next screen is where the photograph and the PranaJiva fields get filled
 * in before anything is published.
 */
export async function createProduct(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSession()

  const { data, error } = await callBackend<{ id: string; handle: string }>(
    "/ops/pranajiva/products",
    {
      action: "create",
      title: String(formData.get("title") ?? ""),
      handle: String(formData.get("handle") ?? ""),
      description: String(formData.get("description") ?? ""),
      collectionId: String(formData.get("collectionId") ?? "") || undefined,
      wellnessCategory: String(formData.get("wellnessCategory") ?? "") || undefined,
      variantTitle: String(formData.get("variantTitle") ?? ""),
      sku: String(formData.get("sku") ?? ""),
      priceRupees: String(formData.get("priceRupees") ?? ""),
    }
  )

  if (error || !data) return { error: error ?? "The product was not created." }

  revalidatePath(BASE)
  redirect(`${BASE}/${data.id}`)
}

/* ── Edit ───────────────────────────────────────────────────────────────────────────────────── */

/**
 * Saves the basics and every PranaJiva field in one submit.
 *
 * The metadata is assembled from the field schema rather than from whatever the form happened to
 * contain, so a key the editor does not know about is left untouched instead of being wiped by a
 * form that never showed it.
 *
 * A cleared field is sent as an empty string, which is Medusa's own convention for "delete this
 * key" — storing "" instead would leave a key that reads as present to every `metadata.x ? …`
 * check on the storefront.
 */
export async function saveProduct(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSession()

  const productId = String(formData.get("productId") ?? "")
  if (!productId) return { error: "Which product? No id was submitted." }

  const metadata: Record<string, unknown> = {}
  for (const group of FIELD_GROUPS) {
    for (const field of group.fields) {
      const raw = formData.get(`meta.${field.key}`)
      /* Absent from the form entirely — not shown, so not ours to change. */
      if (raw === null) continue
      const value = fromFormValue(field.kind, String(raw))
      metadata[field.key] = value === undefined ? "" : value
    }
  }

  const { error } = await callBackend("/ops/pranajiva/products", {
    action: "update",
    productId,
    title: String(formData.get("title") ?? ""),
    handle: String(formData.get("handle") ?? ""),
    subtitle: String(formData.get("subtitle") ?? ""),
    description: String(formData.get("description") ?? ""),
    status: String(formData.get("status") ?? ""),
    collectionId: formData.has("collectionId")
      ? String(formData.get("collectionId") ?? "")
      : undefined,
    metadata,
  })

  if (error) return { error }

  revalidatePath(BASE)
  revalidatePath(`${BASE}/${productId}`)
  return { ok: "Saved." }
}

/* ── Price ──────────────────────────────────────────────────────────────────────────────────── */

export async function savePrice(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSession()

  const productId = String(formData.get("productId") ?? "")
  const variantId = String(formData.get("variantId") ?? "")
  if (!variantId) return { error: "No variant was submitted." }

  const { error } = await callBackend("/ops/pranajiva/products", {
    action: "setPrice",
    variantId,
    priceRupees: String(formData.get("priceRupees") ?? ""),
  })

  if (error) return { error }

  revalidatePath(BASE)
  revalidatePath(`${BASE}/${productId}`)
  return { ok: "Price updated." }
}

/* ── Images ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * Uploads one or more photographs and appends them to the gallery.
 *
 * Appends rather than replaces: the existing images are read back from the database and sent with
 * the new ones, so an upload cannot quietly drop what was already there. The first image in the
 * resulting list becomes the thumbnail when there is not one yet, which is what makes an upload on
 * a product with no image immediately fix its Google feed and social preview.
 */
export async function uploadImages(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSession()

  const productId = String(formData.get("productId") ?? "")
  if (!productId) return { error: "Which product? No id was submitted." }

  const product = await getCatalogueProduct(productId)
  if (!product) return { error: "That product is not in the PranaJiva catalogue." }

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) return { error: "Choose at least one image." }

  const uploaded: string[] = []
  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const { url } = await uploadProductImage(product.handle, buffer, file.type)
      uploaded.push(url)
    } catch (e) {
      /* Report what did land. Losing three good uploads because the fourth was a PDF is worse
         than a partial success the person can see and continue from. */
      const message = e instanceof Error ? e.message : "Upload failed."
      if (uploaded.length) {
        await pushImages(product.id, [...product.images.map((i) => i.url), ...uploaded], product.thumbnail)
        revalidatePath(`${BASE}/${productId}`)
        return { error: `${uploaded.length} uploaded, then: ${message}` }
      }
      return { error: message }
    }
  }

  const next = [...product.images.map((i) => i.url), ...uploaded]
  const { error } = await pushImages(product.id, next, product.thumbnail ?? uploaded[0])
  if (error) return { error }

  revalidatePath(BASE)
  revalidatePath(`${BASE}/${productId}`)
  return { ok: `${uploaded.length} image${uploaded.length === 1 ? "" : "s"} added.` }
}

/** Removes one image from the gallery, and re-points the thumbnail if it was the one removed. */
export async function removeImage(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSession()

  const productId = String(formData.get("productId") ?? "")
  const url = String(formData.get("url") ?? "")
  if (!productId || !url) return { error: "Nothing to remove." }

  const product = await getCatalogueProduct(productId)
  if (!product) return { error: "That product is not in the PranaJiva catalogue." }

  const next = product.images.map((i) => i.url).filter((u) => u !== url)
  const thumbnail = product.thumbnail === url ? next[0] ?? null : product.thumbnail

  const { error } = await pushImages(product.id, next, thumbnail)
  if (error) return { error }

  revalidatePath(BASE)
  revalidatePath(`${BASE}/${productId}`)
  return { ok: "Image removed." }
}

/** Makes one of the gallery images the thumbnail — the one the feed and social previews use. */
export async function makeThumbnail(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSession()

  const productId = String(formData.get("productId") ?? "")
  const url = String(formData.get("url") ?? "")
  if (!productId || !url) return { error: "Nothing to set." }

  const product = await getCatalogueProduct(productId)
  if (!product) return { error: "That product is not in the PranaJiva catalogue." }

  const { error } = await pushImages(product.id, product.images.map((i) => i.url), url)
  if (error) return { error }

  revalidatePath(BASE)
  revalidatePath(`${BASE}/${productId}`)
  return { ok: "Thumbnail updated." }
}

function pushImages(productId: string, images: string[], thumbnail: string | null) {
  return callBackend("/ops/pranajiva/products", {
    action: "setImages",
    productId,
    images,
    thumbnail,
  })
}

/* ── Archive ────────────────────────────────────────────────────────────────────────────────── */

/**
 * Takes a product off the site, or puts it back.
 *
 * Not a delete. A product whose variants appear on past orders cannot be removed without orphaning
 * those lines, and "stop selling this" is almost always what is actually meant — which is
 * reversible and should stay so. The backend sets Medusa's `rejected` status; the storefront, the
 * sitemap and the Merchant feed all read `published`, so this removes it from every one.
 */
export async function archiveProduct(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSession()

  const productId = String(formData.get("productId") ?? "")
  const restore = String(formData.get("restore") ?? "") === "true"
  if (!productId) return { error: "Which product? No id was submitted." }

  const { error } = await callBackend("/ops/pranajiva/products", {
    action: restore ? "restore" : "archive",
    productId,
  })

  if (error) return { error }

  revalidatePath(BASE)
  revalidatePath(`${BASE}/${productId}`)
  return { ok: restore ? "Back on the site." : "Taken off the site." }
}
