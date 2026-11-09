import { EmptyRow, SectionHeader, StatCard } from "../_components/section"
import { listSubscribers, newsletterReady } from "@/lib/pranajiva/newsletter"

export const dynamic = "force-dynamic"

/**
 * Email sign-ups from the pranajiva.in footer.
 *
 * ── Why there is a box of addresses at the top ─────────────────────────────────────────────────
 * Because there is no mail service in this stack, the only thing anybody will do with this list is
 * paste it into the To/BCC line of a message written by hand. So the active addresses are given
 * as one comma-separated block, ready to copy, and the table below is the record.
 */
export default async function PranajivaSubscribersPage() {
  if (!(await newsletterReady())) {
    return (
      <div>
        <SectionHeader
          title="Email sign-ups"
          description="Addresses left in the footer of pranajiva.in."
        />
        <div className="p-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">
              The table has not been created yet.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Apply <code className="font-mono">1729300000000-CreateNewsletterSubscribers</code> on
              the backend and this screen fills in. Until then the footer tells visitors their
              email could not be saved.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const rows = await listSubscribers()
  const active = rows.filter((r) => !r.unsubscribedAt)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const thisWeek = active.filter((r) => new Date(r.createdAt).getTime() > weekAgo)

  return (
    <div>
      <SectionHeader
        title="Email sign-ups"
        description="Addresses left in the footer of pranajiva.in. Nothing is sent automatically — write to them by hand when there is news."
      />

      <div className="grid gap-3 p-6 sm:grid-cols-3">
        <StatCard label="On the list" value={active.length} />
        <StatCard
          label="This week"
          value={thisWeek.length}
          tone={thisWeek.length ? "default" : "muted"}
        />
        <StatCard label="Opted out" value={rows.length - active.length} tone="muted" />
      </div>

      <div className="space-y-8 px-6 pb-10">
        {active.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-slate-900">Copy all</h2>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
              Every active address, comma-separated. Paste into BCC, never To, so people do not see
              each other.
            </p>
            <textarea
              readOnly
              rows={Math.min(8, Math.max(2, Math.ceil(active.length / 4)))}
              value={active.map((r) => r.email).join(", ")}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-700"
            />
          </section>
        )}

        <section>
          <h2 className="text-sm font-bold text-slate-900">
            Everyone{" "}
            <span className="font-mono text-xs font-normal tabular-nums text-slate-400">
              {rows.length}
            </span>
          </h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            {rows.length === 0 ? (
              <EmptyRow>Nobody has signed up yet.</EmptyRow>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Email</th>
                    <th className="px-4 py-2 font-semibold">Signed up</th>
                    <th className="px-4 py-2 font-semibold">Where</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2 font-mono text-slate-800">
                        {r.email}
                        {r.unsubscribedAt && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 font-sans text-[11px] font-semibold text-slate-500">
                            opted out
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                        {new Date(r.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                      </td>
                      <td className="px-4 py-2 text-slate-500">{r.source}</td>
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
