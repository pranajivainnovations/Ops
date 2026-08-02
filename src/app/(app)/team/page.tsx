import Link from "next/link"
import { getDbPool } from "@/lib/db"
import { getCurrentSession } from "@/lib/auth"
import { setOpsUserActiveAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function TeamPage() {
  const [result, session] = await Promise.all([
    getDbPool().query(
      `SELECT id, email, name, is_active, last_login_at, created_at
       FROM baker_network.ops_users
       ORDER BY created_at ASC`
    ),
    getCurrentSession(),
  ])

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-base font-bold text-slate-900">Team</h1>
          <p className="mt-0.5 text-xs text-slate-500">Who has access to this ops tool.</p>
        </div>
        <Link
          href="/team/new"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          + Add team member
        </Link>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="hidden px-4 py-2 sm:table-cell">Email</th>
                <th className="px-4 py-2">Status</th>
                <th className="hidden px-4 py-2 sm:table-cell">Last login</th>
                <th className="hidden px-4 py-2 sm:table-cell">Added</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {result.rows.map((u) => {
                const isYou = u.id === session?.userId
                return (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {u.name || "—"} {isYou && <span className="text-[11px] font-normal text-slate-400">(you)</span>}
                      <p className="text-[11px] font-normal text-slate-400 sm:hidden">{u.email}</p>
                    </td>
                    <td className="hidden px-4 py-2 text-slate-600 sm:table-cell">{u.email}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col items-start gap-1">
                        {u.is_active ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            Deactivated
                          </span>
                        )}
                        {/* Mobile only — desktop shows this in its own column at the end of the row */}
                        {!isYou && (
                          <div className="sm:hidden">
                            {u.is_active ? (
                              <form action={setOpsUserActiveAction.bind(null, u.id, false)}>
                                <button type="submit" className="text-[11px] font-semibold text-amber-600">
                                  Deactivate
                                </button>
                              </form>
                            ) : (
                              <form action={setOpsUserActiveAction.bind(null, u.id, true)}>
                                <button type="submit" className="text-[11px] font-semibold text-emerald-600">
                                  Reactivate
                                </button>
                              </form>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-2 text-slate-600 sm:table-cell">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString("en-IN") : "Never"}
                    </td>
                    <td className="hidden px-4 py-2 text-slate-600 sm:table-cell">
                      {new Date(u.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="hidden px-4 py-2 text-right sm:table-cell">
                      {isYou ? null : u.is_active ? (
                        <form action={setOpsUserActiveAction.bind(null, u.id, false)}>
                          <button type="submit" className="text-xs font-semibold text-amber-600 hover:text-amber-800">
                            Deactivate
                          </button>
                        </form>
                      ) : (
                        <form action={setOpsUserActiveAction.bind(null, u.id, true)}>
                          <button
                            type="submit"
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                          >
                            Reactivate
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          No password-reset UI yet — re-run <code>node scripts/seed-admin.js &lt;email&gt; &lt;new
          password&gt;</code> for that.
        </p>
      </div>
    </main>
  )
}
