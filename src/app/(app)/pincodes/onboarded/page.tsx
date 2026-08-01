import Link from "next/link"
import { getDbPool } from "@/lib/db"
import { offboardPincode } from "../actions"

export const dynamic = "force-dynamic"

export default async function OnboardedPincodesPage() {
  const db = getDbPool()
  const result = await db.query(
    `SELECT pss.pincode, pss.service_enabled_at,
            (SELECT MIN(district) FROM baker_network.pincode_directory pd WHERE pd.pincode = pss.pincode) AS district,
            (SELECT MIN(state_name) FROM baker_network.pincode_directory pd WHERE pd.pincode = pss.pincode) AS state_name
     FROM baker_network.pincode_service_status pss
     WHERE pss.service_enabled = true
     ORDER BY pss.service_enabled_at DESC NULLS LAST, pss.pincode`
  )

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      {result.rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          No pincodes are live yet. Go to &quot;Browse all&quot; to onboard the first one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Pincode</th>
                <th className="px-4 py-2">District</th>
                <th className="px-4 py-2">State</th>
                <th className="px-4 py-2">Live since</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.pincode} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-mono font-medium text-slate-900">
                    <Link href={`/pincodes/${r.pincode}`} className="hover:underline">
                      {r.pincode}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.district || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{r.state_name || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.service_enabled_at ? new Date(r.service_enabled_at).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={offboardPincode.bind(null, r.pincode)}>
                      <button type="submit" className="text-xs font-semibold text-amber-600 hover:text-amber-800">
                        Pause
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
