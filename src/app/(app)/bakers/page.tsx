import Link from "next/link"
import { getDbPool } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function BakersPage() {
  const db = getDbPool()
  const result = await db.query(
    `SELECT id, name, city, state, pincode, status, is_active, trust_badge, blue_tick
     FROM baker_network.bakers
     ORDER BY created_at DESC`
  )

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Bakers</h1>
        <Link
          href="/bakers/new"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          + Add baker
        </Link>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        {result.rows.length === 0 ? (
          <p className="text-sm text-slate-500">No bakers yet. Add the first one.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Badges</th>
                  <th className="px-4 py-2">Active</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-900">{b.name}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {[b.city, b.state].filter(Boolean).join(", ") || "—"}
                      {b.pincode ? ` · ${b.pincode}` : ""}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{b.status}</td>
                    <td className="px-4 py-2">
                      {b.trust_badge && (
                        <span className="mr-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                          Trust
                        </span>
                      )}
                      {b.blue_tick && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          Blue Tick
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">{b.is_active ? "Yes" : "No"}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/bakers/${b.id}`}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        Edit
                      </Link>
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
