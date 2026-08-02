import Link from "next/link"
import { getDbPool } from "@/lib/db"
import { onboardPincode, offboardPincode } from "./actions"

export const dynamic = "force-dynamic"

interface Row {
  pincode: string
  district: string | null
  state_name: string | null
  sample_office: string | null
  office_count: number
  service_enabled: boolean
}

export default async function PincodesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = (q || "").trim()

  let rows: Row[] = []
  if (query) {
    const db = getDbPool()
    const like = `%${query}%`
    const result = await db.query(
      `SELECT pd.pincode, pd.district, pd.state_name, pd.sample_office, pd.office_count,
              COALESCE(pss.service_enabled, false) AS service_enabled
       FROM (
         SELECT DISTINCT ON (pincode)
                pincode, district, state_name,
                office_name AS sample_office,
                COUNT(*) OVER (PARTITION BY pincode) AS office_count
         FROM baker_network.pincode_directory
         WHERE pincode ILIKE $1
            OR district ILIKE $1
            OR state_name ILIKE $1
            OR circle_name ILIKE $1
            OR region_name ILIKE $1
            OR division_name ILIKE $1
            OR office_name ILIKE $1
            OR office_type ILIKE $1
            OR delivery_status ILIKE $1
         ORDER BY pincode, office_name
       ) pd
       LEFT JOIN baker_network.pincode_service_status pss ON pss.pincode = pd.pincode
       ORDER BY pd.pincode
       LIMIT 50`,
      [like]
    )
    rows = result.rows
  }

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      <form method="GET" className="mb-4 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search pincode, district, state, circle, region, division, office name, office type, or delivery status..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Search
        </button>
      </form>

      {!query && (
        <p className="text-sm text-slate-500">
          Search by pincode, district, state, circle, region, division, office name, office type, or
          delivery status — 19,586 distinct pincodes is too many to list at once. Open a pincode to
          see every post office in it (name, type, delivery status, circle/region/division, lat/lng).
        </p>
      )}

      {query && rows.length === 0 && (
        <p className="text-sm text-slate-500">No pincodes matched &quot;{query}&quot;.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Pincode</th>
                <th className="hidden px-4 py-2 sm:table-cell">District</th>
                <th className="hidden px-4 py-2 sm:table-cell">State</th>
                <th className="hidden px-4 py-2 md:table-cell">Sample office</th>
                <th className="hidden px-4 py-2 sm:table-cell">Offices</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pincode} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-mono font-medium text-slate-900">
                    <Link href={`/pincodes/${r.pincode}`} className="hover:underline">
                      {r.pincode}
                    </Link>
                    <p className="text-[11px] font-normal text-slate-400 sm:hidden">
                      {[r.district, r.state_name].filter(Boolean).join(", ") || "—"}
                    </p>
                  </td>
                  <td className="hidden px-4 py-2 text-slate-600 sm:table-cell">{r.district || "—"}</td>
                  <td className="hidden px-4 py-2 text-slate-600 sm:table-cell">{r.state_name || "—"}</td>
                  <td className="hidden px-4 py-2 text-slate-600 md:table-cell">{r.sample_office || "—"}</td>
                  <td className="hidden px-4 py-2 text-slate-600 sm:table-cell">
                    <Link href={`/pincodes/${r.pincode}`} className="hover:underline">
                      {r.office_count}{r.office_count > 1 ? " — view all" : ""}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {r.service_enabled ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                        Onboarded
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        Not onboarded
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.service_enabled ? (
                      <form action={offboardPincode.bind(null, r.pincode)}>
                        <button type="submit" className="text-xs font-semibold text-amber-600 hover:text-amber-800">
                          Pause
                        </button>
                      </form>
                    ) : (
                      <form action={onboardPincode.bind(null, r.pincode)}>
                        <button type="submit" className="text-xs font-semibold text-emerald-600 hover:text-emerald-800">
                          Onboard
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 50 && (
            <p className="px-4 py-2 text-[11px] text-slate-400">
              Showing first 50 matches — refine your search for more specific results.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
