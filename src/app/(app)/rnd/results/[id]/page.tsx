import { notFound } from "next/navigation"
import { getDbPool } from "@/lib/db"
import BackLink from "../../../_components/back-link"

export const dynamic = "force-dynamic"

/**
 * Full detail for one research result.
 *
 * research.search_results carries the same Google Places payload as baker_network.baker_discoveries
 * — same columns, same raw_response — but nothing surfaced it, so the R&D screen could show a name
 * and a rating and nothing else. That is the half of the information that tells you whether a
 * business is worth approaching: how many reviews, what people actually said, opening hours,
 * whether they deliver.
 *
 * Deliberately read-only. Discovery rows have a review workflow (onboard / hold / dismiss) because
 * they are candidate bakers; research rows are market data for a category, and turning one into a
 * baker is a different decision that should go through the discoveries path, not this page.
 */

interface RawReview {
  rating?: number
  text?: { text?: string }
  authorAttribution?: { displayName?: string }
  relativePublishTimeDescription?: string
}

interface RawPlace {
  types?: string[]
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] }
  priceLevel?: string
  reviews?: RawReview[]
  delivery?: boolean
  takeout?: boolean
  dineIn?: boolean
  googleMapsUri?: string
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  )
}

export default async function ResearchResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = getDbPool()

  const result = await db.query(
    `SELECT r.*, c.name AS category_name
       FROM research.search_results r
       JOIN research.categories c ON c.id = r.category_id
      WHERE r.id = $1`,
    [id]
  )
  const d = result.rows[0]
  if (!d) notFound()

  const raw = (d.raw_response ?? {}) as RawPlace
  const reviews = Array.isArray(raw.reviews) ? raw.reviews : []
  const hours = raw.currentOpeningHours

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="max-w-3xl">
          <BackLink fallbackHref="/rnd" label="Back to R&D" />

          <header className="mt-3">
            <h1 className="text-xl font-bold text-slate-900">{d.display_name || "Unnamed"}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {d.category_name} · searched in {d.search_pincode}
              {d.search_query ? ` · "${d.search_query}"` : ""}
            </p>
          </header>

          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Rating">
                {d.rating != null
                  ? `⭐ ${d.rating}${d.user_rating_count != null ? ` · ${d.user_rating_count} reviews` : ""}`
                  : "No rating"}
              </Field>
              <Field label="Phone">{d.phone || "—"}</Field>
              <Field label="Website">
                {d.website_url ? (
                  <a
                    href={d.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
                  >
                    Yes — open site
                  </a>
                ) : (
                  <span className="text-slate-400">No website</span>
                )}
              </Field>
              <Field label="Business status">{d.business_status || "—"}</Field>
              <Field label="Address">
                <span className="block">{d.formatted_address || "—"}</span>
                {(d.district || d.state_name || d.postal_code) && (
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {[d.district, d.state_name, d.postal_code].filter(Boolean).join(" · ")}
                  </span>
                )}
              </Field>
              <Field label="Type">{d.primary_type || "—"}</Field>
              <Field label="Price level">{raw.priceLevel || "—"}</Field>
              <Field label="Service">
                {[
                  raw.delivery ? "Delivery" : null,
                  raw.takeout ? "Takeaway" : null,
                  raw.dineIn ? "Dine-in" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </Field>
            </dl>

            {raw.googleMapsUri && (
              <a
                href={raw.googleMapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Open in Google Maps
              </a>
            )}
          </section>

          {hours?.weekdayDescriptions?.length ? (
            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold text-slate-900">
                Opening hours
                {hours.openNow != null && (
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      hours.openNow
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {hours.openNow ? "Open now" : "Closed"}
                  </span>
                )}
              </h2>
              <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
                {hours.weekdayDescriptions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {reviews.length > 0 && (
            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold text-slate-900">
                Reviews <span className="font-normal text-slate-400">({reviews.length} shown)</span>
              </h2>
              <ul className="mt-3 space-y-3">
                {reviews.map((r, i) => (
                  <li key={i} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700">
                      {r.rating != null ? `⭐ ${r.rating}` : ""}
                      {r.authorAttribution?.displayName
                        ? ` · ${r.authorAttribution.displayName}`
                        : ""}
                      {r.relativePublishTimeDescription
                        ? ` · ${r.relativePublishTimeDescription}`
                        : ""}
                    </p>
                    {r.text?.text && (
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">{r.text.text}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <details className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer text-sm font-bold text-slate-900">
              Raw Google Places response
            </summary>
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
              {JSON.stringify(d.raw_response, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </main>
  )
}
