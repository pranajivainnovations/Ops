import Link from "next/link"
import { notFound } from "next/navigation"
import { getDbPool } from "@/lib/db"
import { onboardPincode, offboardPincode } from "../actions"

export const dynamic = "force-dynamic"

export default async function PincodeDetailPage({
  params,
}: {
  params: Promise<{ pincode: string }>
}) {
  const { pincode } = await params
  const db = getDbPool()

  const [offices, status] = await Promise.all([
    db.query(
      `SELECT circle_name, region_name, division_name, office_name, office_type, delivery_status,
              district, state_name, latitude, longitude
       FROM baker_network.pincode_directory
       WHERE pincode = $1
       ORDER BY office_name`,
      [pincode]
    ),
    db.query(
      `SELECT service_enabled, service_enabled_at, notes FROM baker_network.pincode_service_status WHERE pincode = $1`,
      [pincode]
    ),
  ])

  if (offices.rows.length === 0) notFound()

  const statusRow = status.rows[0]
  const enabled = Boolean(statusRow?.service_enabled)
  const first = offices.rows[0]

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <Link href="/pincodes" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
        ← Back to browse
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h2 className="font-mono text-xl font-bold text-slate-900">{pincode}</h2>
          <p className="text-sm text-slate-600">
            {first.district || "—"}
            {first.state_name ? `, ${first.state_name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {enabled ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
              Onboarded{statusRow?.service_enabled_at ? ` · live since ${new Date(statusRow.service_enabled_at).toLocaleDateString("en-IN")}` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
              Not onboarded
            </span>
          )}
          {enabled ? (
            <form action={offboardPincode.bind(null, pincode)}>
              <button
                type="submit"
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
              >
                Pause service
              </button>
            </form>
          ) : (
            <form action={onboardPincode.bind(null, pincode)}>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Onboard
              </button>
            </form>
          )}
        </div>
      </div>

      <p className="mt-6 mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        Post offices in this pincode ({offices.rows.length})
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Office name</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Delivery</th>
              <th className="px-4 py-2">Circle</th>
              <th className="px-4 py-2">Region</th>
              <th className="px-4 py-2">Division</th>
              <th className="px-4 py-2">Lat, Lng</th>
            </tr>
          </thead>
          <tbody>
            {offices.rows.map((o, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-900">{o.office_name || "—"}</td>
                <td className="px-4 py-2 text-slate-600">{o.office_type || "—"}</td>
                <td className="px-4 py-2 text-slate-600">{o.delivery_status || "—"}</td>
                <td className="px-4 py-2 text-slate-600">{o.circle_name || "—"}</td>
                <td className="px-4 py-2 text-slate-600">{o.region_name || "—"}</td>
                <td className="px-4 py-2 text-slate-600">{o.division_name || "—"}</td>
                <td className="px-4 py-2 font-mono text-[11px] text-slate-500">
                  {o.latitude != null && o.longitude != null ? `${o.latitude}, ${o.longitude}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Lat/lng in this file isn&apos;t from India Post&apos;s own directory (it has none) — some
        values are known to be inaccurate. Trust the other columns; don&apos;t rely on lat/lng for
        real distance calculations yet.
      </p>
    </div>
  )
}
