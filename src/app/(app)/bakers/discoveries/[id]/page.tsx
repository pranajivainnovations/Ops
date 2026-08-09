import Link from "next/link"
import { notFound } from "next/navigation"
import { getDbPool } from "@/lib/db"
import { onboardDiscovery, holdDiscovery, dismissDiscovery } from "../../../pincodes/discovery-actions"
import BackLink from "../../../_components/back-link"

export const dynamic = "force-dynamic"

interface RawReview {
  rating?: number
  text?: { text?: string }
  authorAttribution?: { displayName?: string }
  relativePublishTimeDescription?: string
}

interface RawOpeningHours {
  openNow?: boolean
  weekdayDescriptions?: string[]
}

interface RawPlace {
  types?: string[]
  currentOpeningHours?: RawOpeningHours
  priceLevel?: string
  reviews?: RawReview[]
  delivery?: boolean
  takeout?: boolean
  googleMapsUri?: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  on_hold: "On hold",
  onboarded: "Onboarded",
  dismissed: "Dismissed",
}

export default async function DiscoveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = getDbPool()

  const result = await db.query(
    `SELECT * FROM baker_network.baker_discoveries WHERE id = $1`,
    [id]
  )
  const d = result.rows[0]
  if (!d) notFound()

  const raw = (d.raw_response ?? {}) as RawPlace
  const reviews = Array.isArray(raw.reviews) ? raw.reviews : []
  const openingHours = raw.currentOpeningHours

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
       <div className="max-w-3xl">
        <BackLink fallbackHref="/bakers/discoveries" label="Back" />

        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{d.display_name || "Unnamed"}</h1>
            <p className="mt-0.5 text-sm text-slate-600">{d.formatted_address || "—"}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              d.review_status === "onboarded"
                ? "bg-green-100 text-green-700"
                : d.review_status === "on_hold"
                  ? "bg-amber-100 text-amber-700"
                  : d.review_status === "dismissed"
                    ? "bg-slate-100 text-slate-500"
                    : "bg-blue-100 text-blue-700"
            }`}
          >
            {STATUS_LABEL[d.review_status] ?? d.review_status}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {d.review_status === "onboarded" ? (
            d.promoted_baker_id && (
              <Link
                href={`/bakers/${d.promoted_baker_id}`}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                View baker →
              </Link>
            )
          ) : d.review_status === "dismissed" ? null : (
            <>
              <form action={onboardDiscovery.bind(null, d.id)}>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Onboard
                </button>
              </form>
              {d.review_status !== "on_hold" && (
                <form action={holdDiscovery.bind(null, d.id)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                  >
                    Hold
                  </button>
                </form>
              )}
              <form action={dismissDiscovery.bind(null, d.id)}>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Dismiss
                </button>
              </form>
            </>
          )}
        </div>

        {/* Core details */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Rating</p>
            <p className="mt-0.5 text-slate-800">
              {d.rating != null ? `⭐ ${d.rating}${d.user_rating_count != null ? ` (${d.user_rating_count} reviews)` : ""}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Business status</p>
            <p className="mt-0.5 text-slate-800">{d.business_status || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Phone</p>
            <p className="mt-0.5 text-slate-800">{d.phone || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Website</p>
            <p className="mt-0.5 truncate text-slate-800">
              {d.website_url ? (
                <a href={d.website_url} target="_blank" rel="noopener noreferrer" className="text-slate-700 underline">
                  {d.website_url}
                </a>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Price level</p>
            <p className="mt-0.5 text-slate-800">{raw.priceLevel?.replace("PRICE_LEVEL_", "") || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Delivery / Takeout</p>
            <p className="mt-0.5 text-slate-800">
              {raw.delivery == null && raw.takeout == null
                ? "—"
                : `${raw.delivery ? "Delivery" : "No delivery"} · ${raw.takeout ? "Takeout" : "No takeout"}`}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Pincode (from address)</p>
            <p className="mt-0.5 text-slate-800">
              {d.postal_code || "—"}
              {d.search_pincode && d.postal_code !== d.search_pincode && (
                <span className="ml-1 text-[11px] text-slate-400">(found via search of {d.search_pincode})</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">District / State</p>
            <p className="mt-0.5 text-slate-800">{[d.district, d.state_name].filter(Boolean).join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Lat, Lng</p>
            <p className="mt-0.5 font-mono text-xs text-slate-800">
              {d.lat != null && d.lng != null ? `${d.lat}, ${d.lng}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Types</p>
            <p className="mt-0.5 text-slate-800">{raw.types?.join(", ") || "—"}</p>
          </div>
        </div>

        {/* Opening hours */}
        {openingHours?.weekdayDescriptions && openingHours.weekdayDescriptions.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Opening hours {openingHours.openNow != null && (openingHours.openNow ? "· Open now" : "· Closed now")}
            </p>
            <ul className="space-y-0.5 text-sm text-slate-700">
              {openingHours.weekdayDescriptions.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Reviews ({reviews.length})
            </p>
            <div className="space-y-3">
              {reviews.map((r, i) => (
                <div key={i} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-xs text-slate-500">
                    {r.rating != null && <span className="font-semibold">⭐ {r.rating}</span>}
                    {r.authorAttribution?.displayName && (
                      <span className="ml-2 font-medium text-slate-600">{r.authorAttribution.displayName}</span>
                    )}
                    {r.relativePublishTimeDescription && (
                      <span className="ml-2 text-slate-400">{r.relativePublishTimeDescription}</span>
                    )}
                  </p>
                  {r.text?.text && <p className="mt-1 text-sm italic text-slate-700">&quot;{r.text.text}&quot;</p>}
                </div>
              ))}
            </div>
          </div>
        )}

       </div>

        {/* Complete raw response — nothing requested from Google is ever hidden, even fields not
            surfaced above. Left full-width (outside the max-w-3xl content column above) since JSON
            reads better wide, unlike the structured stat grid and prose. */}
        <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Complete raw API response
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-slate-600">
            {JSON.stringify(d.raw_response, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  )
}
