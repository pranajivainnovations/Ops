"use client"

import { useActionState } from "react"

import type { CatalogueProduct } from "@/lib/pranajiva/catalogue"
import { FIELD_GROUPS, KNOWN_KEYS } from "@/lib/pranajiva/product-fields"
import { saveProduct, type ActionResult } from "../actions"
import FieldInput from "./field-input"

/**
 * The editor.
 *
 * One form and one Save, rather than a save button per section. These fields are edited together —
 * somebody writing the ingredients is usually also writing the benefits and the directions — and a
 * screen that saves eight times is eight chances to leave half the work behind.
 *
 * ── Fields the schema does not know about ─────────────────────────────────────────────────────
 * Shown at the bottom, read-only, rather than hidden. A key that exists in the database but not in
 * the schema is either something added by hand that should be promoted into the schema, or
 * something stale that should be removed — and neither conversation happens if the screen pretends
 * it is not there. They are not submitted, so saving cannot wipe them.
 */

const EMPTY: ActionResult = {}

export default function ProductForm({
  product,
  collections,
}: {
  product: CatalogueProduct
  collections: { id: string; title: string }[]
}) {
  const [state, action, pending] = useActionState(saveProduct, EMPTY)

  const strayKeys = Object.keys(product.metadata)
    .filter((k) => !KNOWN_KEYS.has(k))
    .sort()

  const box =
    "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={product.id} />

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900">The basics</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Changing the handle changes the product&rsquo;s URL. The old one stops working and
          anything already shared pointing at it breaks, so it is worth leaving alone once a
          product is live.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Title</span>
            <input name="title" defaultValue={product.title} className={box} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Handle</span>
            <input name="handle" defaultValue={product.handle} className={`${box} font-mono`} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Subtitle</span>
            <input name="subtitle" defaultValue={product.subtitle ?? ""} className={box} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Collection</span>
            <select
              name="collectionId"
              defaultValue={product.collectionId ?? ""}
              className={box}
            >
              <option value="">None</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-slate-700">Description</span>
          <textarea
            name="description"
            rows={5}
            defaultValue={product.description ?? ""}
            className={`${box} leading-relaxed`}
          />
          <span className="mt-1 block text-[11px] text-slate-500">
            Shown on the product page, and used as the Google description when the SEO description
            below is empty.
          </span>
        </label>
      </section>

      {FIELD_GROUPS.map((group) => (
        <section key={group.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900">{group.title}</h2>
          {group.blurb && (
            <p className="mt-0.5 max-w-3xl text-[11px] leading-snug text-slate-500">
              {group.blurb}
            </p>
          )}
          <div className="mt-2 grid gap-x-5 sm:grid-cols-2">
            {group.fields.map((spec) => (
              <FieldInput key={spec.key} spec={spec} value={product.metadata[spec.key]} />
            ))}
          </div>
        </section>
      ))}

      {strayKeys.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-bold text-amber-900">Fields this screen does not know</h2>
          <p className="mt-0.5 max-w-3xl text-[11px] leading-snug text-amber-800">
            These are on the product in Medusa but not in the editor&rsquo;s schema. They are left
            untouched when you save. If one of them matters, it belongs in
            <code className="mx-1 rounded bg-amber-100 px-1">lib/pranajiva/product-fields.ts</code>
            so it can be edited properly; if it does not, it should be removed.
          </p>
          <dl className="mt-3 space-y-1">
            {strayKeys.map((k) => (
              <div key={k} className="flex gap-3 text-[11px]">
                <dt className="w-48 shrink-0 font-mono text-amber-900">{k}</dt>
                <dd className="min-w-0 break-words font-mono text-amber-700">
                  {JSON.stringify(product.metadata[k])}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Sticky, because this form is long enough that the Save button would otherwise be a
          scroll away from whatever was just typed. */}
      <div className="sticky bottom-0 flex items-center gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {state.error && <span className="text-xs text-rose-700">{state.error}</span>}
        {state.ok && !state.error && <span className="text-xs text-emerald-700">{state.ok}</span>}
        <span className="ml-auto text-[11px] text-slate-400">
          Saves to Medusa — the storefront follows within the hour.
        </span>
      </div>
    </form>
  )
}
