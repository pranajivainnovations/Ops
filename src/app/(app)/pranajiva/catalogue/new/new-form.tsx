"use client"

import { useActionState } from "react"

import { createProduct, type ActionResult } from "../actions"

const EMPTY: ActionResult = {}

const box =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"

/**
 * Creating a product.
 *
 * ── Why this asks for a price ─────────────────────────────────────────────────────────────────
 * Because a product without one cannot be added to a cart, and a Create button that produces
 * something broken is worse than one that asks for an extra field. The same reasoning puts
 * `brand: pranajiva` on it automatically rather than leaving it to the editor afterwards — a
 * product created without that does not appear on the site, and "created successfully, invisible
 * everywhere" is the most confusing possible outcome.
 *
 * ── Why it is created as a draft ──────────────────────────────────────────────────────────────
 * It has no photograph yet and nobody has checked the price. The next screen is where that work
 * happens, and publishing is a deliberate act there.
 */
export default function NewProductForm({
  collections,
}: {
  collections: { id: string; title: string }[]
}) {
  const [state, action, pending] = useActionState(createProduct, EMPTY)

  return (
    <form action={action} className="max-w-2xl space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-slate-700">Title</span>
            <input name="title" required placeholder="Neem Powder" className={box} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">
              Handle <span className="font-normal text-slate-400">optional</span>
            </span>
            <input name="handle" placeholder="from the title" className={`${box} font-mono`} />
            <span className="mt-1 block text-[11px] text-slate-500">
              The URL: pranajiva.in/shop/<em>handle</em>. Left empty it is made from the title.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Collection</span>
            <select name="collectionId" className={box} defaultValue="">
              <option value="">None</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Wellness category</span>
            <input name="wellnessCategory" list="wc" placeholder="Glow Care" className={box} />
            <datalist id="wc">
              <option value="Glow Care" />
              <option value="Nutrition" />
              <option value="Ayurveda" />
              <option value="Intimate Wellness" />
              <option value="Gifting" />
            </datalist>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Variant name</span>
            <input name="variantTitle" placeholder="100 g jar" className={box} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">SKU</span>
            <input name="sku" placeholder="PJ-NEEM-100" className={`${box} font-mono`} />
            <span className="mt-1 block text-[11px] text-slate-500">
              Used as the Google Merchant identifier.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Price (₹)</span>
            <input
              name="priceRupees"
              required
              inputMode="decimal"
              placeholder="199"
              className={`${box} tabular-nums`}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-slate-700">Description</span>
            <textarea name="description" rows={4} className={`${box} leading-relaxed`} />
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create as draft"}
        </button>
        {state.error && <span className="text-xs text-rose-700">{state.error}</span>}
        <span className="ml-auto text-[11px] text-slate-400">
          Photographs and the PranaJiva fields come next.
        </span>
      </div>
    </form>
  )
}
