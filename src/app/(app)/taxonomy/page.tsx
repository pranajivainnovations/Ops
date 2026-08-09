import { getDbPool } from "@/lib/db"
import {
  addOccasion,
  addProductType,
  setMatrixPairing,
  setOccasionActive,
  setProductTypeActive,
  updateOccasion,
  updateProductType,
} from "./actions"

export const dynamic = "force-dynamic"

/**
 * The Occasion × Product Type matrix — CrossFriend's navigation taxonomy.
 *
 * This page is the single source of truth for a relationship that used to live in four places at
 * once (two hardcoded maps in storefront code, a JSON file on the server, and a frozen whitelist
 * array) and had drifted apart in all of them. Every value here is a row with a foreign key, so a
 * pairing that references something that does not exist is now impossible rather than invisible.
 *
 * The grid leads because it is the thing people come here to change. The registries below it exist
 * to feed the grid — you add a type in order to put it on an occasion.
 *
 * No client JavaScript: every control is a plain form posting to a server action, matching how
 * /pricing and /constraints work. Each toggle is one round trip, which is the right trade for a
 * page edited a few times a month by a handful of people.
 */

interface TypeRow {
  type_id: string
  value: string
  label: string
  emoji: string | null
  display_order: number
  is_active: boolean
}

interface OccasionRow {
  collection_id: string
  handle: string
  label: string
  tagline: string | null
  emoji: string | null
  display_order: number
  is_active: boolean
}

export default async function TaxonomyPage() {
  const db = getDbPool()

  const [typesRes, occasionsRes, matrixRes] = await Promise.all([
    db.query<TypeRow>(
      `SELECT t.type_id, pt.value, t.label, t.emoji, t.display_order, t.is_active
         FROM crossfriend.product_types t
         JOIN public.product_type pt ON pt.id = t.type_id AND pt.deleted_at IS NULL
        ORDER BY t.display_order, t.label`
    ),
    db.query<OccasionRow>(
      `SELECT o.collection_id, pc.handle, o.label, o.tagline, o.emoji, o.display_order, o.is_active
         FROM crossfriend.occasions o
         JOIN public.product_collection pc ON pc.id = o.collection_id AND pc.deleted_at IS NULL
        ORDER BY o.display_order, o.label`
    ),
    db.query<{ collection_id: string; type_id: string }>(
      `SELECT collection_id, type_id FROM crossfriend.occasion_product_types`
    ),
  ])

  const types = typesRes.rows
  const occasions = occasionsRes.rows
  const paired = new Set(matrixRes.rows.map((r) => `${r.collection_id}|${r.type_id}`))

  // Only active × active pairings actually reach the storefront, so the preview has to apply both
  // flags — otherwise this page would promise sections that a retired type silently removes.
  const activeTypes = types.filter((t) => t.is_active)

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Taxonomy</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Which product types appear on which occasion. This drives storefront navigation.
        </p>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* ── The matrix ───────────────────────────────────────────────────────────────────── */}
        <section className="mb-8 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-bold text-slate-900">Occasion × Product Type</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Click a cell to pair or unpair. A pairing means that occasion&rsquo;s page shows a
              section of that type.
            </p>
          </div>

          {occasions.length === 0 || types.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              Add at least one occasion and one product type below.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="sticky left-0 bg-white px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Occasion
                    </th>
                    {types.map((t) => (
                      <th key={t.type_id} className="px-3 py-3 text-center">
                        <span
                          className={`block text-lg leading-none ${t.is_active ? "" : "opacity-30"}`}
                        >
                          {t.emoji ?? "•"}
                        </span>
                        <span
                          className={`mt-1 block text-[11px] font-semibold ${
                            t.is_active ? "text-slate-700" : "text-slate-300 line-through"
                          }`}
                        >
                          {t.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {occasions.map((o) => (
                    <tr key={o.collection_id} className={o.is_active ? "" : "bg-slate-50/60"}>
                      <th
                        scope="row"
                        className="sticky left-0 bg-inherit px-5 py-2.5 text-left font-medium"
                      >
                        <span className="mr-1.5">{o.emoji}</span>
                        <span
                          className={
                            o.is_active ? "text-slate-900" : "text-slate-400 line-through"
                          }
                        >
                          {o.label}
                        </span>
                        <span className="ml-1.5 font-mono text-[11px] font-normal text-slate-400">
                          /{o.handle}
                        </span>
                      </th>
                      {types.map((t) => {
                        const on = paired.has(`${o.collection_id}|${t.type_id}`)
                        const live = on && o.is_active && t.is_active
                        return (
                          <td key={t.type_id} className="px-3 py-2 text-center">
                            <form
                              action={setMatrixPairing.bind(null, o.collection_id, t.type_id, !on)}
                            >
                              <button
                                type="submit"
                                aria-label={`${on ? "Remove" : "Add"} ${t.label} on ${o.label}`}
                                title={
                                  on && !live
                                    ? "Paired, but hidden because the type or occasion is retired"
                                    : on
                                      ? "Paired — click to remove"
                                      : "Not paired — click to add"
                                }
                                className={`h-7 w-7 rounded-md border text-sm font-bold transition ${
                                  live
                                    ? "border-amber-500 bg-amber-500 text-white hover:bg-amber-600"
                                    : on
                                      ? "border-slate-300 bg-slate-200 text-slate-400"
                                      : "border-slate-200 bg-white text-transparent hover:border-amber-400 hover:bg-amber-50"
                                }`}
                              >
                                ✓
                              </button>
                            </form>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* What the storefront will actually render, so the consequence of an edit is visible
              here rather than only after loading the site. */}
          {occasions.some((o) => o.is_active) && (
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Storefront preview
              </p>
              <ul className="space-y-1">
                {occasions
                  .filter((o) => o.is_active)
                  .map((o) => {
                    const sections = activeTypes.filter((t) =>
                      paired.has(`${o.collection_id}|${t.type_id}`)
                    )
                    return (
                      <li key={o.collection_id} className="text-xs text-slate-600">
                        <span className="font-mono text-slate-400">/occasions/{o.handle}</span>
                        {"  "}
                        {sections.length === 0 ? (
                          <span className="text-red-500">no sections — page will be empty</span>
                        ) : (
                          <span className="text-slate-800">
                            {sections.map((t) => `${t.emoji ?? ""} ${t.label}`).join("  ·  ")}
                          </span>
                        )}
                      </li>
                    )
                  })}
              </ul>
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Product types ──────────────────────────────────────────────────────────────── */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3">
              <h2 className="text-sm font-bold text-slate-900">Product types</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                What a product <em>is</em>. Each product has exactly one.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {types.map((t) => (
                <div key={t.type_id} className="px-5 py-3">
                  <form
                    action={updateProductType.bind(null, t.type_id)}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      name="emoji"
                      defaultValue={t.emoji ?? ""}
                      aria-label={`Emoji for ${t.label}`}
                      className="w-12 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm focus:border-slate-500 focus:outline-none"
                    />
                    <input
                      name="label"
                      defaultValue={t.label}
                      required
                      aria-label={`Label for ${t.value}`}
                      className={`min-w-32 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none ${
                        t.is_active ? "text-slate-900" : "text-slate-400 line-through"
                      }`}
                    />
                    <input
                      name="displayOrder"
                      type="number"
                      defaultValue={t.display_order}
                      aria-label={`Order for ${t.label}`}
                      className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Save
                    </button>
                  </form>
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="font-mono text-[11px] text-slate-400">
                      ?type={t.value}
                    </span>
                    <form action={setProductTypeActive.bind(null, t.type_id, !t.is_active)}>
                      <button
                        type="submit"
                        // Named, not just "Retire": every row has one of these, so the bare word
                        // identifies nothing to a screen reader moving button to button.
                        aria-label={`${t.is_active ? "Retire" : "Bring back"} ${t.label}`}
                        className={`text-[11px] font-semibold ${
                          t.is_active
                            ? "text-amber-600 hover:text-amber-800"
                            : "text-emerald-600 hover:text-emerald-800"
                        }`}
                      >
                        {t.is_active ? "Retire" : "Bring back"}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>

            <form
              action={addProductType}
              className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3"
            >
              <input
                name="emoji"
                placeholder="💐"
                aria-label="Emoji"
                className="w-12 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm focus:border-slate-500 focus:outline-none"
              />
              <input
                name="value"
                placeholder="Machine value, e.g. bouquet"
                required
                aria-label="Machine value"
                className="min-w-36 flex-1 rounded-lg border border-slate-300 px-2 py-1 font-mono text-sm focus:border-slate-500 focus:outline-none"
              />
              <input
                name="label"
                placeholder="Label, e.g. Bouquets"
                required
                aria-label="Display label"
                className="min-w-32 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                + Add type
              </button>
            </form>
          </section>

          {/* ── Occasions ──────────────────────────────────────────────────────────────────── */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3">
              <h2 className="text-sm font-bold text-slate-900">Occasions</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                What a purchase is <em>for</em>. Each becomes a storefront page.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {occasions.map((o) => (
                <div key={o.collection_id} className="px-5 py-3">
                  <form
                    action={updateOccasion.bind(null, o.collection_id)}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      name="emoji"
                      defaultValue={o.emoji ?? ""}
                      aria-label={`Emoji for ${o.label}`}
                      className="w-12 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm focus:border-slate-500 focus:outline-none"
                    />
                    <input
                      name="label"
                      defaultValue={o.label}
                      required
                      aria-label={`Label for ${o.handle}`}
                      className={`min-w-32 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none ${
                        o.is_active ? "text-slate-900" : "text-slate-400 line-through"
                      }`}
                    />
                    <input
                      name="displayOrder"
                      type="number"
                      defaultValue={o.display_order}
                      aria-label={`Order for ${o.label}`}
                      className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
                    />
                    <input
                      name="tagline"
                      defaultValue={o.tagline ?? ""}
                      placeholder="Tagline shown on the occasion page"
                      aria-label={`Tagline for ${o.label}`}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Save
                    </button>
                  </form>
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="font-mono text-[11px] text-slate-400">
                      /occasions/{o.handle}
                    </span>
                    <form action={setOccasionActive.bind(null, o.collection_id, !o.is_active)}>
                      <button
                        type="submit"
                        aria-label={`${o.is_active ? "Retire" : "Bring back"} ${o.label}`}
                        className={`text-[11px] font-semibold ${
                          o.is_active
                            ? "text-amber-600 hover:text-amber-800"
                            : "text-emerald-600 hover:text-emerald-800"
                        }`}
                      >
                        {o.is_active ? "Retire" : "Bring back"}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>

            <form
              action={addOccasion}
              className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3"
            >
              <input
                name="emoji"
                placeholder="🪔"
                aria-label="Emoji"
                className="w-12 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm focus:border-slate-500 focus:outline-none"
              />
              <input
                name="handle"
                placeholder="URL, e.g. diwali"
                required
                aria-label="URL handle"
                className="min-w-32 flex-1 rounded-lg border border-slate-300 px-2 py-1 font-mono text-sm focus:border-slate-500 focus:outline-none"
              />
              <input
                name="label"
                placeholder="Label, e.g. Diwali"
                required
                aria-label="Display label"
                className="min-w-32 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
              />
              <input
                name="tagline"
                placeholder="Tagline (optional)"
                aria-label="Tagline"
                className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                + Add occasion
              </button>
            </form>
          </section>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Retiring hides a type or occasion from the storefront without losing its pairings — bring
          it back and the matrix is exactly as you left it. Adding a product type also creates it in
          Medusa, so products can be filed against it straight away.
        </p>
      </div>
    </main>
  )
}
