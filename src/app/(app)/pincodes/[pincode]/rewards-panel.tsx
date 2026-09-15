import Link from "next/link"

import { getRewardScope } from "../../rewards/data"
import {
  isError,
  MECHANIC_LABEL,
  type Brand,
  type Mechanic,
} from "../../rewards/types"
import MechanicCard from "../../rewards/mechanic-card"
import RewardHistory from "../../rewards/history"
import PincodeOutcomesPanel from "../../rewards/outcomes"

const MECHANICS: Mechanic[] = ["economics", "joining_cash", "referral", "cashback"]

/**
 * What this pincode is offering, editable here.
 *
 * ── Why it is on the pincode page at all ───────────────────────────────────────────────────────
 * Because the decision to change an offer is made while looking at a place — its bakers, its
 * orders, whether anything is actually being delivered there. Sending somebody to a separate
 * section to act on what they just read is how a launch ends up configured from memory.
 *
 * Every field shows whether it is this pincode's own or inherited from the brand, so the common
 * case — a local budget over a brand-wide rate — is legible at a glance rather than requiring two
 * screens to compare.
 */
export default async function RewardsPanel({
  pincode,
  brand = "crossfriend",
}: {
  pincode: string
  brand?: Brand
}) {
  const scope = await getRewardScope(brand, pincode)

  if (isError(scope)) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-sm font-bold text-slate-900">Rewards</h2>
        <p className="mt-1 text-xs text-amber-800">{scope.error}</p>
      </section>
    )
  }

  const live = MECHANICS.filter((m) => scope.config[m]?.isEnabled && m !== "economics")

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Rewards in {pincode}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Anything left blank is inherited from the brand default, so a launch normally sets only a
            budget, a cap and an end date here. Rewards do not serve a pincode until three bakers are
            live there with published products, whatever these settings say. Stopping anything here
            halts new grants only — credit already given stays spendable and already-promised second
            grants still arrive.
          </p>
        </div>
        <Link
          href={`/rewards?brand=${brand}`}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Brand defaults →
        </Link>
      </div>

      <p className="mt-3 text-xs text-slate-600">
        {live.length === 0 ? (
          <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-600">
            Nothing running here
          </span>
        ) : (
          <>
            Running:{" "}
            {live.map((m) => (
              <span
                key={m}
                className="mr-1 rounded bg-emerald-50 px-2 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200"
              >
                {MECHANIC_LABEL[m]}
              </span>
            ))}
          </>
        )}
      </p>

      {/* Above the settings, so the cost of the last configuration is read before the next one is
          typed. */}
      <div className="mt-4">
        <PincodeOutcomesPanel brand={brand} pincode={pincode} />
      </div>

      <div className="mt-5 flex flex-col gap-5">
        {MECHANICS.map((mechanic) => (
          <MechanicCard
            key={mechanic}
            brand={brand}
            pincode={pincode}
            mechanic={mechanic}
            config={scope.config[mechanic]}
            fields={scope.fields[mechanic]}
            history={
              <RewardHistory
                brand={brand}
                pincode={pincode}
                mechanic={mechanic}
                fields={scope.fields[mechanic]}
              />
            }
          />
        ))}
      </div>
    </section>
  )
}
