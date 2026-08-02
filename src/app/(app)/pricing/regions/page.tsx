import Link from "next/link"
import { getDbPool } from "@/lib/db"
import PricingTabs from "../pricing-tabs"
import { addRegion } from "./actions"

export const dynamic = "force-dynamic"

export default async function RegionsPage() {
  const db = getDbPool()
  const regionsRes = await db.query(
    `SELECT r.id, r.key, r.label, r.is_active, COUNT(rp.pincode)::int AS pincode_count
     FROM pricing.regions r
     LEFT JOIN pricing.region_pincodes rp ON rp.region_id = r.id
     GROUP BY r.id
     ORDER BY r.label`
  )

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Pricing</h1>
      </header>
      <PricingTabs />
      <div className="mx-auto max-w-[1600px] px-6 py-6">
      <p className="mb-4 text-xs text-slate-500">
        A pincode belongs to at most one region, so there&apos;s never ambiguity about which
        region&apos;s pricing applies. Click a region below to map pincodes to it and set its price
        overrides.
      </p>

      <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Region</th>
              <th className="px-4 py-2">Pincodes mapped</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {regionsRes.rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-900">
                  <Link href={`/pricing/regions/${r.id}`} className="hover:underline">{r.label}</Link>
                  <p className="text-[11px] font-normal text-slate-400">{r.key}</p>
                </td>
                <td className="px-4 py-2 text-slate-600">{r.pincode_count}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/pricing/regions/${r.id}`} className="text-xs font-semibold text-slate-600 hover:text-slate-900">
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
            {regionsRes.rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">No regions yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-bold text-slate-900">Add a region</h2>
        <form action={addRegion} className="flex flex-wrap items-center gap-2 px-5 py-3">
          <input
            type="text"
            name="key"
            placeholder="Machine key, e.g. delhi_premium"
            required
            className="flex-1 min-w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
          />
          <input
            type="text"
            name="label"
            placeholder="Display label, e.g. Delhi Premium Area"
            required
            className="flex-1 min-w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
            + Add region
          </button>
        </form>
      </section>
      </div>
    </main>
  )
}
