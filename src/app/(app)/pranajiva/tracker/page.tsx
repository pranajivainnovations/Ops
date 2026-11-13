import { EmptyRow, SectionHeader, StatCard } from "../_components/section"
import { ENTRY_LABEL, loadTrackerOverview, trackerReady } from "@/lib/pranajiva/tracker"

export const dynamic = "force-dynamic"

const REMINDER_LABEL: Record<string, string> = {
  daily: "Daily check-in",
  weekly: "Weekly score",
  period: "Period due",
  habits: "Habits",
  monthly: "Monthly report",
  test: "Test due",
  comeback: "Come back",
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

const day = (d: string) =>
  new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  })

/**
 * Ritu — the cycle tracker at pranajiva.in/tracker — seen from the inside: who is using it and how
 * much, never what anyone wrote. See src/lib/pranajiva/tracker.ts for why OPS cannot and must not
 * read the health data itself.
 */
export default async function PranajivaTrackerPage() {
  const header = (
    <SectionHeader
      title="Ritu · cycle tracker"
      description="How pranajiva.in/tracker is being used. Counts only: what women log is encrypted and private to them, so it never appears here."
    />
  )

  if (!(await trackerReady())) {
    return (
      <div>
        {header}
        <div className="p-6">
          <EmptyRow>The tracker tables have not been created in this database yet.</EmptyRow>
        </div>
      </div>
    )
  }

  const o = await loadTrackerOverview()
  const peak = Math.max(1, ...o.daily.map((d) => d.entries))
  const last30 = o.daily.reduce((a, d) => a + d.entries, 0)

  return (
    <div>
      {header}

      <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Accounts"
          value={o.accounts}
          hint={o.accounts - o.setUp ? `${o.accounts - o.setUp} stopped before finishing setup` : "All finished setup"}
        />
        <StatCard label="Active this week" value={o.active7} hint={`${o.active30} in the last 30 days`} />
        <StatCard
          label="Reminders on"
          value={o.remindersOn}
          hint="Phones that allowed notifications"
          tone={o.remindersOn ? "default" : "muted"}
        />
        <StatCard label="Fingerprint unlock" value={o.fingerprint} tone={o.fingerprint ? "default" : "muted"} />
      </div>

      <div className="space-y-8 px-6 pb-10">
        <section>
          <h2 className="text-sm font-bold text-slate-900">Last 30 days</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Entries saved each day, all accounts together.{" "}
            <span className="tabular-nums">{last30}</span> in total.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex h-28 min-w-[480px] items-end gap-1">
              {o.daily.map((d) => (
                <div
                  key={d.date}
                  className="group relative flex h-full flex-1 flex-col justify-end"
                  title={`${day(d.date)}: ${d.entries} entries from ${d.people} ${d.people === 1 ? "account" : "accounts"}`}
                >
                  <div
                    className={`w-full rounded-t ${d.entries ? "bg-emerald-500" : "bg-slate-100"}`}
                    style={{ height: d.entries ? `${Math.max(6, (d.entries / peak) * 100)}%` : "3px" }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex min-w-[480px] justify-between text-[11px] text-slate-400">
              <span>{day(o.daily[0].date)}</span>
              <span>Today</span>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="text-sm font-bold text-slate-900">What gets logged</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Kind</th>
                    <th className="px-4 py-2 text-right font-semibold">All time</th>
                    <th className="px-4 py-2 text-right font-semibold">This week</th>
                  </tr>
                </thead>
                <tbody>
                  {o.entries.map((e) => (
                    <tr key={e.key} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2 text-slate-800">{ENTRY_LABEL[e.key]}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-800">{e.total}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${e.week ? "text-emerald-700" : "text-slate-300"}`}>
                        {e.week}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-slate-900">Reminders sent, last 30 days</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              {o.reminders.length === 0 ? (
                <EmptyRow>No reminders sent yet.</EmptyRow>
              ) : (
                <table className="w-full text-left text-xs">
                  <tbody>
                    {o.reminders.map((r) => (
                      <tr key={r.kind} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2 text-slate-800">{REMINDER_LABEL[r.kind] ?? r.kind}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-800">{r.sent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        <section>
          <h2 className="text-sm font-bold text-slate-900">
            Accounts{" "}
            <span className="font-mono text-xs font-normal tabular-nums text-slate-400">{o.people.length}</span>
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            Numbered in the order they joined. Who they are is not shown on purpose: knowing that a
            person uses a period tracker is itself private.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            {o.people.length === 0 ? (
              <EmptyRow>Nobody has opened the tracker yet.</EmptyRow>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Account</th>
                    <th className="px-4 py-2 font-semibold">Joined</th>
                    <th className="px-4 py-2 font-semibold">Last opened</th>
                    <th className="px-4 py-2 text-right font-semibold">Days active</th>
                    <th className="px-4 py-2 text-right font-semibold">Entries</th>
                    <th className="px-4 py-2 font-semibold">Reminders</th>
                  </tr>
                </thead>
                <tbody>
                  {o.people.map((p) => (
                    <tr key={p.label} className="border-b border-slate-50 last:border-0">
                      <td className="whitespace-nowrap px-4 py-2 font-semibold text-slate-800">
                        {p.label}
                        {!p.setUp && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            setup not finished
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-500">{when(p.joined)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-500">{p.lastActive ? when(p.lastActive) : "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-800">{p.daysLogged}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-800">{p.entries}</td>
                      <td className="px-4 py-2 text-slate-500">{p.remindersOn ? "On" : "Off"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
