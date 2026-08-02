import Link from "next/link"
import { getDbPool } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const db = getDbPool()
  const result = await db.query(
    `SELECT c.name,
            COUNT(DISTINCT r.search_pincode)::int AS pincode_count,
            COUNT(r.id)::int AS result_count,
            MAX(r.fetched_at) AS last_fetched
     FROM research.categories c
     LEFT JOIN research.search_results r ON r.category_id = c.id
     GROUP BY c.name
     ORDER BY MAX(r.fetched_at) DESC NULLS LAST, c.name`
  )

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-bold text-slate-900">R&amp;D — Categories</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Every category researched so far — stored data, nothing fetched fresh from here.
            </p>
          </div>
          <Link href="/rnd" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            ← Back to search
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {result.rows.length === 0 ? (
          <p className="text-sm text-slate-500">No categories researched yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Pincodes searched</th>
                  <th className="px-4 py-2">Total results</th>
                  <th className="px-4 py-2">Last searched</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((c) => (
                  <tr key={c.name} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-900">
                      <Link href={`/rnd/categories/${encodeURIComponent(c.name)}`} className="hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{c.pincode_count}</td>
                    <td className="px-4 py-2 text-slate-600">{c.result_count}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {c.last_fetched ? new Date(c.last_fetched).toLocaleDateString("en-IN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
