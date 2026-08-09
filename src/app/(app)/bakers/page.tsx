import Link from "next/link"
import { getDbPool } from "@/lib/db"
import BakerTabs from "./baker-tabs"

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
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Bakers</h1>
        <Link
          href="/bakers/new"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          + Add baker
        </Link>
      </header>
      <BakerTabs />

      <div className="mx-auto max-w-5xl px-6 py-6">
        {result.rows.length === 0 ? (
          <p className="text-sm text-slate-500">No bakers yet. Add the first one.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="hidden px-4 py-2 sm:table-cell">Location</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="hidden px-4 py-2 sm:table-cell">Badges</th>
                  <th className="hidden px-4 py-2 sm:table-cell">Active</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((b) => {
                  // Same full-cell links as the pincode browser: the whole row is the target, not
                  // just the name. Only the action column stays outside.
                  const href = `/bakers/${b.id}`
                  const cell = "block -mx-4 -my-2 px-4 py-2"
                  return (
                  <tr
                    key={b.id}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2 font-medium text-slate-900">
                      <Link href={href} className={cell}>
                        {b.name}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-2 text-slate-600 sm:table-cell">
                      <Link href={href} className={cell}>
                        {[b.city, b.state].filter(Boolean).join(", ") || "—"}
                        {b.pincode ? ` · ${b.pincode}` : ""}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      <Link href={href} className={cell}>
                        {b.status}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-2 sm:table-cell">
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
                    <td className="hidden px-4 py-2 sm:table-cell">
                      <Link href={href} className={cell}>
                        {b.is_active ? "Yes" : "No"}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`${href}?tab=edit`}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
