import Link from "next/link"
import { notFound } from "next/navigation"
import { getDbPool } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function CategoryPincodesPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: encodedCategory } = await params
  const category = decodeURIComponent(encodedCategory)
  const db = getDbPool()

  const result = await db.query(
    `SELECT r.search_pincode AS pincode, COUNT(*)::int AS n, MAX(r.fetched_at) AS last_fetched
     FROM research.search_results r
     JOIN research.categories c ON c.id = r.category_id
     WHERE c.name = $1
     GROUP BY r.search_pincode
     ORDER BY MAX(r.fetched_at) DESC`,
    [category]
  )

  if (result.rows.length === 0) notFound()

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-bold text-slate-900">&quot;{category}&quot;</h1>
            <p className="mt-0.5 text-xs text-slate-500">Pincodes searched for this category.</p>
          </div>
          <Link href="/rnd/categories" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            ← All categories
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="flex flex-wrap gap-2">
          {result.rows.map((r) => (
            <Link
              key={r.pincode}
              href={`/rnd?category=${encodeURIComponent(category)}&pincode=${r.pincode}`}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              {r.pincode} ({r.n} results, {new Date(r.last_fetched).toLocaleDateString("en-IN")})
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
