import Link from "next/link"
import { getDbPool } from "@/lib/db"
import ResearchTrigger from "./research-trigger"

export const dynamic = "force-dynamic"

function normalizeCategory(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ")
}

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; pincode?: string }>
}) {
  const params = await searchParams
  const category = normalizeCategory(params.category || "")
  const pincode = (params.pincode || "").trim()
  const hasQuery = category.length > 0 && /^\d{6}$/.test(pincode)

  const db = getDbPool()

  const recentResult = await db.query(
    `SELECT c.name AS category, r.search_pincode AS pincode, COUNT(*)::int AS n, MAX(r.fetched_at) AS last_fetched
     FROM research.search_results r
     JOIN research.categories c ON c.id = r.category_id
     GROUP BY c.name, r.search_pincode
     ORDER BY MAX(r.fetched_at) DESC
     LIMIT 20`
  )

  let results: Record<string, unknown>[] = []
  let lastSearchedAt: string | null = null

  if (hasQuery) {
    const resultsResult = await db.query(
      `SELECT r.id, r.display_name, r.formatted_address, r.postal_code, r.rating, r.user_rating_count,
              r.phone, r.website_url, r.business_status, MAX(r.fetched_at) OVER () AS last_fetched
       FROM research.search_results r
       JOIN research.categories c ON c.id = r.category_id
       WHERE c.name = $1 AND r.search_pincode = $2
       ORDER BY r.rating DESC NULLS LAST, r.user_rating_count DESC NULLS LAST`,
      [category, pincode]
    )
    results = resultsResult.rows
    lastSearchedAt = results[0]?.last_fetched ? new Date(results[0].last_fetched as string).toISOString() : null
  }

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-bold text-slate-900">R&amp;D</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Exploratory market research via Google Places — completely separate from the real baker
              network. Search any category in any pincode to see what&apos;s actually there before
              deciding whether to build it out for real.
            </p>
          </div>
          <Link href="/rnd/categories" className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-800">
            Browse categories →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <form method="GET" className="mb-6 flex flex-wrap gap-2">
          <input
            type="text"
            name="category"
            defaultValue={params.category || ""}
            placeholder="Category, e.g. toys, bouquets, fancy dress..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <input
            type="text"
            name="pincode"
            defaultValue={params.pincode || ""}
            maxLength={6}
            placeholder="Pincode"
            className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Go
          </button>
        </form>

        {hasQuery ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  &quot;{category}&quot; in {pincode}
                </p>
                <p className="text-[11px] text-slate-400">
                  {lastSearchedAt
                    ? `Last searched ${new Date(lastSearchedAt).toLocaleString("en-IN")}`
                    : "Never searched"}
                </p>
              </div>
              <ResearchTrigger category={category} pincode={pincode} lastSearchedAt={lastSearchedAt} />
            </div>

            {results.length === 0 ? (
              <p className="text-sm text-slate-500">
                No results stored yet for this search — click Search above to run it.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Address</th>
                      <th className="px-4 py-2">Pincode</th>
                      <th className="px-4 py-2">Rating</th>
                      <th className="px-4 py-2">Phone</th>
                      <th className="px-4 py-2">Website</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id as string} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2 font-medium text-slate-900">{(r.display_name as string) || "—"}</td>
                        <td className="px-4 py-2 text-slate-600">{(r.formatted_address as string) || "—"}</td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-600">{(r.postal_code as string) || "—"}</td>
                        <td className="px-4 py-2 text-slate-600">
                          {r.rating != null
                            ? `⭐ ${r.rating}${r.user_rating_count != null ? ` (${r.user_rating_count})` : ""}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-600">{(r.phone as string) || "—"}</td>
                        {/* Whether a business already has a website changes how you approach them,
                            so it reads Yes/No at a glance with the link behind the Yes. */}
                        <td className="px-4 py-2">
                          {r.website_url ? (
                            <a
                              href={r.website_url as string}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={r.website_url as string}
                              className="font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
                            >
                              Yes
                            </a>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">
                          {(r.business_status as string) || "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link
                            href={`/rnd/results/${r.id as string}`}
                            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                          >
                            Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500">
              Enter a category and pincode above to search or revisit past research.
            </p>
            {recentResult.rows.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Recent research
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentResult.rows.map((r) => (
                    <Link
                      key={`${r.category}-${r.pincode}`}
                      href={`/rnd?category=${encodeURIComponent(r.category)}&pincode=${r.pincode}`}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      {r.category} in {r.pincode} ({r.n})
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
