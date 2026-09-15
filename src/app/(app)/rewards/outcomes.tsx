import { getPincodeOutcomes } from "./data"
import { isError, MECHANIC_LABEL, rupees, type Brand } from "./types"

/**
 * What the rewards in this pincode have done.
 *
 * ── Why this sits above the settings rather than below them ────────────────────────────────────
 * Settings without outcomes is half a panel. The rates being edited underneath only mean something
 * next to what the last set of them cost and returned, and putting the cost first means nobody
 * changes a number without having just read what the previous number did.
 *
 * ── Why what is missing is printed ─────────────────────────────────────────────────────────────
 * Contribution margin and 90-day repeat are the figures the whole plan is judged on, and neither
 * can be computed until orders exist. A panel that quietly omitted them would read as though
 * incentive spend were the whole picture — which is exactly the reading that makes a cheap offer
 * look like a good one.
 */
export default async function PincodeOutcomesPanel({
  brand,
  pincode,
}: {
  brand: Brand
  pincode: string
}) {
  const outcomes = await getPincodeOutcomes(brand, pincode)

  if (isError(outcomes)) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
        Outcomes unavailable: {outcomes.error}
      </p>
    )
  }

  const { totals } = outcomes
  const nothingYet = totals.issuedPaise === 0

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
        What this has cost and returned
      </h3>

      {nothingYet ? (
        <p className="mt-2 text-xs text-slate-500">
          No credit has been issued in {pincode} yet, so there is nothing to measure. The figures
          below fill in as rewards are granted.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
          <Stat label="Issued" value={rupees(totals.issuedPaise)} />
          <Stat
            label="Came back as orders"
            value={rupees(totals.redeemedPaise)}
            sub={`${Math.round((totals.redeemedPaise / totals.issuedPaise) * 100)}% of issued`}
          />
          <Stat label="Still owed" value={rupees(totals.outstandingPaise)} />
          <Stat
            label="Expired unused"
            value={rupees(totals.expiredPaise)}
            sub={totals.expiredPaise > 0 ? "credit nobody wanted" : undefined}
          />
          <Stat label="Customers reached" value={String(totals.customers)} />
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 pr-4 font-semibold">Reward</th>
              <th className="py-1 pr-4 font-semibold">State</th>
              <th className="py-1 pr-4 text-right font-semibold">Grants</th>
              <th className="py-1 pr-4 text-right font-semibold">Budget used</th>
              <th className="py-1 pr-4 text-right font-semibold">Issued</th>
              <th className="py-1 pr-4 text-right font-semibold">Redeemed</th>
              <th className="py-1 text-right font-semibold">Per customer</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {outcomes.mechanics.map((m) => (
              <tr key={m.mechanic} className="border-t border-slate-200">
                <td className="py-1.5 pr-4 font-medium">{MECHANIC_LABEL[m.mechanic]}</td>
                <td className="py-1.5 pr-4">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      m.stateKind === "allowed"
                        ? "bg-emerald-50 text-emerald-700"
                        : m.stateKind === "stopped"
                          ? "bg-slate-200 text-slate-600"
                          : m.stateKind === "paused"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-400"
                    }`}
                    title={m.explanation ?? undefined}
                  >
                    {m.state.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  {m.grants}
                  {m.maxGrants !== null && (
                    <span className="text-slate-400"> / {m.maxGrants}</span>
                  )}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  {m.budgetPaise === null ? (
                    <span className="text-slate-400">no budget</span>
                  ) : (
                    <>
                      {rupees(m.budgetPaise - (m.budgetRemainingPaise ?? 0))}
                      <span className="text-slate-400"> / {rupees(m.budgetPaise)}</span>
                    </>
                  )}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">{rupees(m.issuedPaise)}</td>
                <td className="py-1.5 pr-4 text-right tabular-nums">{rupees(m.redeemedPaise)}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {m.costPerCustomerPaise === null ? "—" : rupees(m.costPerCustomerPaise)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] font-semibold text-slate-500">
          Not shown here, and why ({outcomes.unavailable.length})
        </summary>
        <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-slate-500">
          {outcomes.unavailable.map((u) => (
            <li key={u}>· {u}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-bold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  )
}
