"use client"

import { useActionState } from "react"

import type { CatalogueProduct } from "@/lib/pranajiva/catalogue"
import {
  archiveProduct,
  makeThumbnail,
  removeImage,
  savePrice,
  uploadImages,
  type ActionResult,
} from "../actions"

const EMPTY: ActionResult = {}

const box =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"

/**
 * Photographs.
 *
 * ── Why the thumbnail is called out separately ────────────────────────────────────────────────
 * Medusa keeps the thumbnail and the gallery apart, and only the thumbnail is read by the things
 * that matter off-site: the sitemap, the Google Merchant feed, and the 1200x630 social preview the
 * storefront builds for WhatsApp. A product can have four gallery photographs and still be invisible
 * in all three if the thumbnail is unset, so the screen says which one is doing that job.
 */
export function ImagesPanel({ product }: { product: CatalogueProduct }) {
  const [upload, uploadAction, uploading] = useActionState(uploadImages, EMPTY)
  const [removed, removeAction] = useActionState(removeImage, EMPTY)
  const [thumbed, thumbAction] = useActionState(makeThumbnail, EMPTY)

  const message = upload.error ?? removed.error ?? thumbed.error
  const ok = upload.ok ?? removed.ok ?? thumbed.ok

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-bold text-slate-900">Photographs</h2>

      {!product.thumbnail && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
          No thumbnail. This product is left out of the Google Merchant feed, and a link to it
          shares with no preview image. Uploading one fixes both.
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {product.images.map((image) => {
          const isThumb = image.url === product.thumbnail
          return (
            <div
              key={image.id}
              className={`relative overflow-hidden rounded-lg border ${
                isThumb ? "border-emerald-400 ring-1 ring-emerald-200" : "border-slate-200"
              }`}
            >
              {/* Plain img: S3 urls on an internal tool, see the note on the list screen. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="aspect-square w-full object-cover" />

              {isThumb && (
                <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  thumbnail
                </span>
              )}

              <div className="flex divide-x divide-slate-200 border-t border-slate-200 text-[10px]">
                {!isThumb && (
                  <form action={thumbAction} className="flex-1">
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="url" value={image.url} />
                    <button className="w-full py-1 text-slate-600 hover:bg-slate-50">
                      Make thumbnail
                    </button>
                  </form>
                )}
                <form action={removeAction} className="flex-1">
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="url" value={image.url} />
                  <button className="w-full py-1 text-rose-600 hover:bg-rose-50">Remove</button>
                </form>
              </div>
            </div>
          )
        })}

        {product.images.length === 0 && (
          <p className="col-span-3 rounded-lg border border-dashed border-slate-300 py-6 text-center text-[11px] text-slate-400">
            No photographs yet.
          </p>
        )}
      </div>

      <form action={uploadAction} className="mt-3">
        <input type="hidden" name="productId" value={product.id} />
        <input
          type="file"
          name="images"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-[11px] text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-white"
        />
        <button
          type="submit"
          disabled={uploading}
          className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <span className="ml-2 text-[10px] text-slate-400">JPEG, PNG or WEBP, up to 8MB each.</span>
      </form>

      {message && <p className="mt-2 text-[11px] text-rose-700">{message}</p>}
      {ok && !message && <p className="mt-2 text-[11px] text-emerald-700">{ok}</p>}
    </section>
  )
}

/**
 * Price per variant.
 *
 * Only the default INR price. Adding or removing a variant stays in Medusa's admin — changing what
 * sizes exist is a bigger decision than changing what they cost, and it is rare enough that
 * rebuilding the option/variant machinery here would be a lot of surface for a few uses a year.
 */
export function PricePanel({ product }: { product: CatalogueProduct }) {
  const [state, action, pending] = useActionState(savePrice, EMPTY)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-bold text-slate-900">Price</h2>

      <div className="mt-2 space-y-3">
        {product.variants.map((v) => (
          <form key={v.id} action={action} className="flex items-end gap-2">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="variantId" value={v.id} />
            <label className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold text-slate-700">
                {v.title || "Default"}
                {v.sku && <span className="ml-1 font-mono text-slate-400">{v.sku}</span>}
              </span>
              <input
                name="priceRupees"
                inputMode="decimal"
                defaultValue={v.pricePaise === null ? "" : String(v.pricePaise / 100)}
                placeholder="299"
                className={`${box} tabular-nums`}
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="mb-0.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Set
            </button>
          </form>
        ))}

        {product.variants.length === 0 && (
          <p className="text-[11px] text-slate-500">
            This product has no variants, so it cannot be bought. Add one in Medusa&rsquo;s admin.
          </p>
        )}
      </div>

      <p className="mt-2 text-[10px] text-slate-400">
        Rupees, not paise. Sale prices and customer-group overrides are left alone.
      </p>

      {state.error && <p className="mt-2 text-[11px] text-rose-700">{state.error}</p>}
      {state.ok && !state.error && (
        <p className="mt-2 text-[11px] text-emerald-700">{state.ok}</p>
      )}
    </section>
  )
}

/**
 * Taking a product off the site.
 *
 * Never a delete, and the panel says so rather than offering one and refusing. Past orders
 * reference this product's variants — the count is shown, because it is the reason — and the
 * action that is actually wanted is almost always "stop selling it", which is reversible.
 */
export function ArchivePanel({ product }: { product: CatalogueProduct }) {
  const [state, action, pending] = useActionState(archiveProduct, EMPTY)
  const isOff = product.status === "rejected"

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-bold text-slate-900">
        {isOff ? "Off the site" : "Remove from the site"}
      </h2>

      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        {isOff
          ? "This product is hidden from the storefront, the sitemap and the Google feed. Putting it back publishes it again."
          : "Hides it from the storefront, the sitemap and the Google feed. Nothing is deleted and you can put it back."}
      </p>

      {product.orderCount > 0 && (
        <p className="mt-2 text-[11px] text-slate-500">
          {product.orderCount} order{product.orderCount === 1 ? "" : "s"} reference this product,
          which is why it is never deleted outright.
        </p>
      )}

      <form action={action} className="mt-3">
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="restore" value={isOff ? "true" : "false"} />
        <button
          type="submit"
          disabled={pending}
          className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${
            isOff
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "border border-rose-200 text-rose-700 hover:bg-rose-50"
          }`}
        >
          {pending ? "Working…" : isOff ? "Put back on the site" : "Take off the site"}
        </button>
      </form>

      {state.error && <p className="mt-2 text-[11px] text-rose-700">{state.error}</p>}
      {state.ok && !state.error && (
        <p className="mt-2 text-[11px] text-emerald-700">{state.ok}</p>
      )}
    </section>
  )
}
