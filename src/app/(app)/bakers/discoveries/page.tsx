import Link from "next/link"
import { getDbPool } from "@/lib/db"
import BakerTabs from "../baker-tabs"
import WebsiteCell from "../../_components/website-cell"
import RecordCard, { CardList } from "../../_components/record-card"
import { onboardDiscovery, holdDiscovery, dismissDiscovery } from "../../pincodes/discovery-actions"

export const dynamic = "force-dynamic"

const STATUS_FILTERS = ["all", "pending", "on_hold", "onboarded", "dismissed"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  on_hold: "On hold",
  onboarded: "Onboarded",
  dismissed: "Dismissed",
}

export default async function DiscoveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const params = await searchParams
  const statusFilter: StatusFilter = STATUS_FILTERS.includes(params.status as StatusFilter)
    ? (params.status as StatusFilter)
    : "all"
  const query = (params.q || "").trim()

  const db = getDbPool()

  const [counts, rows] = await Promise.all([
    db.query(
      `SELECT review_status, COUNT(*)::int AS count FROM baker_network.baker_discoveries GROUP BY review_status`
    ),
    db.query(
      `SELECT id, display_name, formatted_address, search_pincode, postal_code, district, state_name,
              phone, website_url, rating, user_rating_count, business_status, review_status,
              promoted_baker_id
       FROM baker_network.baker_discoveries
       WHERE ($1 = 'all' OR review_status = $1)
         AND ($2 = '' OR display_name ILIKE $3 OR search_pincode ILIKE $3 OR postal_code ILIKE $3
              OR district ILIKE $3 OR state_name ILIKE $3)
       ORDER BY
         CASE review_status WHEN 'pending' THEN 0 WHEN 'on_hold' THEN 1 WHEN 'onboarded' THEN 2 ELSE 3 END,
         rating DESC NULLS LAST, user_rating_count DESC NULLS LAST
       LIMIT 100`,
      [statusFilter, query, `%${query}%`]
    ),
  ])

  const countByStatus: Record<string, number> = {}
  let total = 0
  for (const r of counts.rows) {
    countByStatus[r.review_status] = r.count
    total += r.count
  }

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Bakers</h1>
      </header>
      <BakerTabs />

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <p className="mb-4 text-xs text-slate-500">
          Every bakery candidate discovered across every pincode you&apos;ve searched — the complete
          picture, not just whichever pincode you happen to be looking at.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => {
            const count = s === "all" ? total : countByStatus[s] ?? 0
            const active = statusFilter === s
            return (
              <Link
                key={s}
                href={`/bakers/discoveries?status=${s}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s === "all" ? "All" : STATUS_LABEL[s]} ({count})
              </Link>
            )
          })}
        </div>

        <form method="GET" className="mb-4 flex gap-2">
          <input type="hidden" name="status" value={statusFilter} />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search name, pincode, district, or state..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Search
          </button>
        </form>

        {rows.rows.length === 0 ? (
          <p className="text-sm text-slate-500">No discoveries match this filter.</p>
        ) : (
          <>
            {/* Cards on phones — deciding whether to approach a bakery needs the rating, the phone
                number and whether they already have a website, and the table hides all three at
                this width. */}
            <CardList>
              {rows.rows.map((d) => (
                <RecordCard
                  key={d.id}
                  href={`/bakers/discoveries/${d.id}`}
                  title={d.display_name || "Unnamed"}
                  subtitle={d.formatted_address || "—"}
                  fields={[
                    { label: "Pincode", value: d.postal_code || d.search_pincode || "—" },
                    {
                      label: "Rating",
                      value:
                        d.rating != null
                          ? `⭐ ${d.rating}${d.user_rating_count != null ? ` (${d.user_rating_count})` : ""}`
                          : "—",
                    },
                    { label: "Phone", value: d.phone || "—" },
                    { label: "Website", value: <WebsiteCell url={d.website_url} /> },
                    { label: "Status", value: d.review_status },
                  ]}
                />
              ))}
            </CardList>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="hidden px-4 py-2 md:table-cell">Address</th>
                  <th className="hidden px-4 py-2 sm:table-cell">Pincode</th>
                  <th className="hidden px-4 py-2 sm:table-cell">Rating</th>
                  <th className="hidden px-4 py-2 md:table-cell">Phone</th>
                  {/* Already selected by the query but never rendered until now — which made "no
                      website" indistinguishable from "not looked at", the one thing that most
                      changes how you approach a bakery. */}
                  <th className="hidden px-4 py-2 sm:table-cell">Website</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.rows.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-900">
                      <Link href={`/bakers/discoveries/${d.id}`} className="hover:underline">
                        {d.display_name || "—"}
                      </Link>
                      <p className="text-[11px] font-normal text-slate-400 sm:hidden">
                        {d.postal_code || d.search_pincode || "—"}
                        {d.rating != null ? ` · ⭐ ${d.rating}` : ""}
                      </p>
                    </td>
                    <td className="hidden px-4 py-2 text-slate-600 md:table-cell">{d.formatted_address || "—"}</td>
                    <td className="hidden px-4 py-2 sm:table-cell">
                      <Link
                        href={`/pincodes/${d.postal_code || d.search_pincode}`}
                        className="font-mono text-xs text-slate-600 hover:underline"
                      >
                        {d.postal_code || d.search_pincode || "—"}
                      </Link>
                      {d.postal_code && d.search_pincode && d.postal_code !== d.search_pincode && (
                        <span className="ml-1 text-[10px] text-slate-400">(found via {d.search_pincode})</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-2 text-slate-600 sm:table-cell">
                      {d.rating != null ? `⭐ ${d.rating}${d.user_rating_count != null ? ` (${d.user_rating_count})` : ""}` : "—"}
                    </td>
                    <td className="hidden px-4 py-2 text-slate-600 md:table-cell">{d.phone || "—"}</td>
                    <td className="hidden px-4 py-2 sm:table-cell">
                      <WebsiteCell url={d.website_url} />
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
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
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
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
                              View →
                            </Link>
                          )
                        ) : d.review_status === "dismissed" ? null : (
                          <>
                            <form action={onboardDiscovery.bind(null, d.id)}>
                              <button
                                type="submit"
                                className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                              >
                                Onboard
                              </button>
                            </form>
                            {d.review_status !== "on_hold" && (
                              <form action={holdDiscovery.bind(null, d.id)}>
                                <button
                                  type="submit"
                                  className="text-xs font-semibold text-amber-600 hover:text-amber-800"
                                >
                                  Hold
                                </button>
                              </form>
                            )}
                            <form action={dismissDiscovery.bind(null, d.id)}>
                              <button
                                type="submit"
                                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                              >
                                Dismiss
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Outside the table wrapper so it shows on phones too — the card list would otherwise
              end silently at 100 with no hint that there are more. */}
          {rows.rows.length === 100 && (
            <p className="px-1 py-2 text-[11px] text-slate-400">
              Showing first 100 matches — refine your search or filter for more specific results.
            </p>
          )}
          </>
        )}
      </div>
    </main>
  )
}
