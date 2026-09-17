import Link from "next/link"

import { getDbPool } from "@/lib/db"
import GrantForm from "./grant-form"

export const dynamic = "force-dynamic"

/**
 * Credit given by hand, and the record of every one that has been.
 *
 * ── Why the history is on the same page as the form ────────────────────────────────────────────
 * A discretionary payment is the one kind this system cannot bound with a budget, because the whole
 * point of it is that a person decided. What stands in for a budget is that it is visible — so the
 * last fifty are directly under the form that makes the next one, where anybody about to give ₹500
 * can see what else has been given this week and by whom.
 */

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`

export default async function ManualGrantPage() {
  const db = getDbPool()

  const { rows } = await db.query(
    `SELECT e.amount_paise, e.brand, e.reason, e.created_at, e.expires_at,
            e.customer_id,
            COALESCE(o.name, o.email, '—') AS given_by
       FROM wallet.entries e
       LEFT JOIN baker_network.ops_users o ON o.id = e.created_by
      WHERE e.entry_type = 'manual_grant'
      ORDER BY e.created_at DESC
      LIMIT 50`
  )

  const { rows: totals } = await db.query(
    `SELECT COUNT(*)::int AS n,
            COALESCE(SUM(amount_paise), 0)::bigint AS paise
       FROM wallet.entries
      WHERE entry_type = 'manual_grant'
        AND created_at >= NOW() - INTERVAL '30 days'`
  )

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <Link href="/rewards" className="text-xs text-slate-500 hover:underline">
            ← Rewards
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900">Give a customer credit</h1>
          <p className="mt-1 text-sm text-slate-600">
            For the cases no rule covers — a late delivery, a goodwill gesture, a bonus somebody
            should have had. It lands in their wallet immediately and spends like any other credit.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-6">
        <GrantForm />

        <div className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Given by hand</h2>
            <p className="text-xs text-slate-500 tabular-nums">
              {totals[0].n} grant{totals[0].n === 1 ? "" : "s"} ·{" "}
              {rupees(Number(totals[0].paise))} in the last 30 days
            </p>
          </div>

          {rows.length === 0 ? (
            <p className="mt-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
              Nothing has been given by hand yet.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 font-semibold">When</th>
                    <th className="px-4 py-2 font-semibold">Amount</th>
                    <th className="px-4 py-2 font-semibold">Why</th>
                    <th className="px-4 py-2 font-semibold">By</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-none align-top">
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500 tabular-nums">
                        {new Date(r.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 font-semibold tabular-nums text-slate-900">
                        {rupees(Number(r.amount_paise))}
                        {r.expires_at && (
                          <span className="ml-1 text-[11px] font-normal text-amber-700">
                            expires {new Date(r.expires_at).toLocaleDateString("en-IN")}
                          </span>
                        )}
                      </td>
                      {/* The reason is given the room it needs. It is the point of the row. */}
                      <td className="px-4 py-2 text-slate-700">{r.reason}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
                        {r.given_by}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
