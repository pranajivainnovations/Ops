import { getGlobalSwitch, getLiability, getRewardScope, getScopeCandidates } from "./data"
import { isError, rupees, MECHANIC_LABEL, type Brand, type Mechanic } from "./types"
import MechanicCard from "./mechanic-card"
import RewardHistory from "./history"
import GlobalSwitchPanel from "./global-switch"

export const dynamic = "force-dynamic"

const MECHANICS: Mechanic[] = [
  "economics",
  /* Paid on joining rather than on ordering, so it is brand-wide by nature: a customer has no
     pincode until their first order, and the database refuses a scope on this one. */
  "signup_bonus",
  "joining_cash",
  "referral",
  "cashback",
]
const BRANDS: Brand[] = ["crossfriend", "pranajiva"]

const BUCKET_LABEL: Record<string, string> = {
  awaiting_sweep: "Expired, not yet written off",
  within_7_days: "Within 7 days",
  within_30_days: "Within 30 days",
  within_90_days: "Within 90 days",
  later: "Later",
  never: "Never expires",
}

/**
 * Brand-level reward settings, what they currently cost, and the switch that stops everything.
 *
 * ── Why the money owed sits at the top ─────────────────────────────────────────────────────────
 * Rates are the thing being edited and liability is the thing they produce. Putting the outstanding
 * figure above the forms means nobody changes a rate without having just seen what the last change
 * is still costing — which is the number that decides whether a rate should move at all.
 */
export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>
}) {
  const { brand: brandParam } = await searchParams
  const brand: Brand = brandParam === "pranajiva" ? "pranajiva" : "crossfriend"

  const [scope, liability, globalSwitch, scopeCandidates] = await Promise.all([
    getRewardScope(brand, null),
    getLiability(),
    getGlobalSwitch(),
    /* Never fails the page: a picker with no candidates still renders, and losing the list of
       pincodes is not a reason to lose the screen that stops an offer. */
    getScopeCandidates().catch(() => []),
  ])

  return (
    <div className="p-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-900">Rewards</h1>
          {/* The one payment no rule on this page covers, kept one click away from the rules. */}
          <a
            href="/rewards/grant"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Give a customer credit →
          </a>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
          Brand defaults for every reward. A pincode inherits these unless it overrides them, so one
          edit here moves everywhere that has not been given its own answer. Nothing is overwritten —
          each save is a new version, and the one it replaced stays readable so a reward paid last
          month can still explain itself.
        </p>
      </header>

      <GlobalSwitchPanel state={globalSwitch} />

      <LiabilityStrip liability={liability} />

      <div className="mt-6 flex gap-1 border-b border-slate-200">
        {BRANDS.map((b) => (
          <a
            key={b}
            href={`/rewards?brand=${b}`}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium capitalize transition ${
              b === brand
                ? "border-b-2 border-slate-900 text-slate-900"
                : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {b}
          </a>
        ))}
      </div>

      {isError(scope) ? (
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          {scope.error}
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          {MECHANICS.map((mechanic) => (
            <MechanicCard
              key={mechanic}
              brand={brand}
              pincode={null}
              scopeCandidates={scopeCandidates}
              mechanic={mechanic}
              config={scope.config[mechanic]}
              fields={scope.fields[mechanic]}
              history={
                <RewardHistory
                  brand={brand}
                  pincode={null}
                  mechanic={mechanic}
                  fields={scope.fields[mechanic]}
                />
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LiabilityStrip({
  liability,
}: {
  liability: Awaited<ReturnType<typeof getLiability>>
}) {
  if (isError(liability)) {
    return (
      <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
        Credit owed could not be read: {liability.error}
      </p>
    )
  }

  const byBrand = new Map<string, number>()
  for (const row of liability.byBucket) {
    if (row.bucket === "awaiting_sweep") continue
    byBrand.set(row.brand, (byBrand.get(row.brand) ?? 0) + row.paise)
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Credit customers can spend
          </p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {rupees(liability.outstandingPaise)}
          </p>
        </div>
        {[...byBrand].map(([b, paise]) => (
          <div key={b}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {b}
            </p>
            <p className="text-lg font-semibold tabular-nums text-slate-700">{rupees(paise)}</p>
          </div>
        ))}
        {liability.awaitingSweepPaise > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Expired, not yet written off
            </p>
            <p className="text-lg font-semibold tabular-nums text-slate-500">
              {rupees(liability.awaitingSweepPaise)}
            </p>
          </div>
        )}
      </div>

      {liability.byBucket.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          No credit has been issued yet, so nothing is owed.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-4 font-semibold">Brand</th>
                <th className="py-1 pr-4 font-semibold">Reward</th>
                <th className="py-1 pr-4 font-semibold">Falls due</th>
                <th className="py-1 pr-4 text-right font-semibold">Amount</th>
                <th className="py-1 text-right font-semibold">Customers</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {liability.byBucket.map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-1.5 pr-4 capitalize">{row.brand}</td>
                  <td className="py-1.5 pr-4">
                    {MECHANIC_LABEL[entryTypeToMechanic(row.entryType)] ?? row.entryType}
                  </td>
                  <td className="py-1.5 pr-4">{BUCKET_LABEL[row.bucket] ?? row.bucket}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{rupees(row.paise)}</td>
                  <td className="py-1.5 text-right tabular-nums">{row.customers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** The ledger names entries by what they are; this page names them by the lever that made them. */
function entryTypeToMechanic(entryType: string): Mechanic {
  if (entryType === "promo_grant") return "joining_cash"
  if (entryType === "referral_earn") return "referral"
  if (entryType === "cashback_earn") return "cashback"
  return "economics"
}
