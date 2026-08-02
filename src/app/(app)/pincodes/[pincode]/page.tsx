import Link from "next/link"
import { notFound } from "next/navigation"
import { getDbPool } from "@/lib/db"
import { onboardPincode, offboardPincode } from "../actions"
import { onboardDiscovery, holdDiscovery, dismissDiscovery } from "../discovery-actions"
import DiscoveryTrigger from "./discovery-trigger"

export const dynamic = "force-dynamic"

interface ReviewExcerpt {
  rating?: number
  text?: string
  author?: string
}

function getReviewExcerpts(raw: unknown, limit = 3): ReviewExcerpt[] {
  if (!raw || typeof raw !== "object") return []
  const reviews = (raw as { reviews?: unknown }).reviews
  if (!Array.isArray(reviews)) return []
  return reviews.slice(0, limit).map((r) => {
    const review = r as {
      rating?: number
      text?: { text?: string }
      authorAttribution?: { displayName?: string }
    }
    return {
      rating: review.rating,
      text: review.text?.text,
      author: review.authorAttribution?.displayName,
    }
  })
}

const STATUS_ORDER: Record<string, number> = { pending: 0, on_hold: 1, onboarded: 2, dismissed: 3 }

export default async function PincodeDetailPage({
  params,
}: {
  params: Promise<{ pincode: string }>
}) {
  const { pincode } = await params
  const db = getDbPool()

  const [offices, status, discoveries, lastSearch] = await Promise.all([
    db.query(
      `SELECT circle_name, region_name, division_name, office_name, office_type, delivery_status,
              district, state_name, latitude, longitude
       FROM baker_network.pincode_directory
       WHERE pincode = $1
       ORDER BY office_name`,
      [pincode]
    ),
    db.query(
      `SELECT service_enabled, service_enabled_at, notes FROM baker_network.pincode_service_status WHERE pincode = $1`,
      [pincode]
    ),
    // Candidates shown here are matched by their own real postal_code (Google's address data — ground
    // truth), NOT by which pincode's search happened to find them. A bakery discovered while searching
    // a neighboring pincode's circle still shows up here if it actually belongs to this pincode, and
    // conversely won't clutter this page if it doesn't — falls back to search_pincode only when Google
    // didn't return a parseable postal code at all, so nothing found is ever invisible everywhere.
    db.query(
      `SELECT id, display_name, formatted_address, phone, website_url, rating, user_rating_count,
              business_status, review_status, promoted_baker_id, raw_response
       FROM baker_network.baker_discoveries
       WHERE postal_code = $1 OR (postal_code IS NULL AND search_pincode = $1)
       ORDER BY rating DESC NULLS LAST, user_rating_count DESC NULLS LAST`,
      [pincode]
    ),
    // "Last searched" tracks when a sweep last specifically targeted this pincode — independent of
    // which candidates ended up actually belonging here.
    db.query(
      `SELECT MAX(fetched_at) AS last_fetched FROM baker_network.baker_discoveries WHERE search_pincode = $1`,
      [pincode]
    ),
  ])

  if (offices.rows.length === 0) notFound()

  const statusRow = status.rows[0]
  const enabled = Boolean(statusRow?.service_enabled)
  const first = offices.rows[0]

  const sortedDiscoveries = [...discoveries.rows].sort(
    (a, b) => (STATUS_ORDER[a.review_status] ?? 9) - (STATUS_ORDER[b.review_status] ?? 9)
  )
  const lastFetched = lastSearch.rows[0]?.last_fetched
  const lastSearchedAt: string | null = lastFetched ? new Date(lastFetched).toISOString() : null

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      <Link href="/pincodes" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
        ← Back to browse
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-mono text-xl font-bold text-slate-900">{pincode}</h2>
          <p className="text-sm text-slate-600">
            {first.district || "—"}
            {first.state_name ? `, ${first.state_name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {enabled ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
              Onboarded{statusRow?.service_enabled_at ? ` · live since ${new Date(statusRow.service_enabled_at).toLocaleDateString("en-IN")}` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
              Not onboarded
            </span>
          )}
          {enabled ? (
            <form action={offboardPincode.bind(null, pincode)}>
              <button
                type="submit"
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
              >
                Pause service
              </button>
            </form>
          ) : (
            <form action={onboardPincode.bind(null, pincode)}>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Onboard
              </button>
            </form>
          )}
        </div>
      </div>

      <p className="mt-6 mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        Post offices in this pincode ({offices.rows.length})
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Office name</th>
              <th className="px-4 py-2">Type</th>
              <th className="hidden px-4 py-2 sm:table-cell">Delivery</th>
              <th className="hidden px-4 py-2 md:table-cell">Circle</th>
              <th className="hidden px-4 py-2 md:table-cell">Region</th>
              <th className="hidden px-4 py-2 md:table-cell">Division</th>
              <th className="hidden px-4 py-2 lg:table-cell">Lat, Lng</th>
            </tr>
          </thead>
          <tbody>
            {offices.rows.map((o, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-900">
                  {o.office_name || "—"}
                  <p className="text-[11px] font-normal text-slate-400 sm:hidden">{o.delivery_status || "—"}</p>
                </td>
                <td className="px-4 py-2 text-slate-600">{o.office_type || "—"}</td>
                <td className="hidden px-4 py-2 text-slate-600 sm:table-cell">{o.delivery_status || "—"}</td>
                <td className="hidden px-4 py-2 text-slate-600 md:table-cell">{o.circle_name || "—"}</td>
                <td className="hidden px-4 py-2 text-slate-600 md:table-cell">{o.region_name || "—"}</td>
                <td className="hidden px-4 py-2 text-slate-600 md:table-cell">{o.division_name || "—"}</td>
                <td className="hidden px-4 py-2 font-mono text-[11px] text-slate-500 lg:table-cell">
                  {o.latitude != null && o.longitude != null ? `${o.latitude}, ${o.longitude}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Lat/lng in this file isn&apos;t from India Post&apos;s own directory (it has none) — some
        values are known to be inaccurate. Trust the other columns; don&apos;t rely on lat/lng for
        real distance calculations yet.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Bakery discovery</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {lastSearchedAt
              ? `Last searched ${new Date(lastSearchedAt).toLocaleString("en-IN")}`
              : "Never searched"}
          </p>
        </div>
        <DiscoveryTrigger pincode={pincode} lastSearchedAt={lastSearchedAt} />
      </div>

      {sortedDiscoveries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No candidates found yet — click &quot;Find bakeries here&quot; to run a Google Places search
          for this pincode.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {sortedDiscoveries.map((d) => {
            const reviews = getReviewExcerpts(d.raw_response)
            const closed = d.business_status && d.business_status !== "OPERATIONAL"

            return (
              <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{d.display_name || "Unnamed"}</p>
                      {closed && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          {d.business_status}
                        </span>
                      )}
                      {d.review_status === "onboarded" && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                          ✓ Onboarded
                        </span>
                      )}
                      {d.review_status === "on_hold" && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          On hold
                        </span>
                      )}
                      {d.review_status === "dismissed" && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          Dismissed
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{d.formatted_address || "—"}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      {d.rating != null && (
                        <span>⭐ {d.rating}{d.user_rating_count != null ? ` (${d.user_rating_count} reviews)` : ""}</span>
                      )}
                      {d.phone && <span>📞 {d.phone}</span>}
                      {d.website_url && (
                        <a
                          href={d.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-600 underline hover:text-slate-900"
                        >
                          Website
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/bakers/discoveries/${d.id}`}
                      className="text-xs font-semibold text-slate-500 underline hover:text-slate-800"
                    >
                      Details
                    </Link>
                    {d.review_status === "onboarded" ? (
                      d.promoted_baker_id && (
                        <Link
                          href={`/bakers/${d.promoted_baker_id}`}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
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
                </div>

                {reviews.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                    {reviews.map((r, i) => (
                      <p key={i} className="text-[11px] text-slate-500">
                        {r.rating != null && <span className="font-semibold">⭐{r.rating} </span>}
                        {r.author && <span className="font-medium text-slate-600">{r.author}: </span>}
                        <span className="italic">&quot;{r.text}&quot;</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
