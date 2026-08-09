import Link from "next/link"
import { getDbPool } from "@/lib/db"
import { onboardPincode, offboardPincode } from "./actions"

export const dynamic = "force-dynamic"

interface Row {
  pincode: string
  district: string | null
  state_name: string | null
  division_name: string | null
  offices: string | null
  office_count: number
  service_enabled: boolean
  baker_count: number
  candidate_count: number
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
    const result = await db.query<Row>(
      /**
       * Two stages on purpose. The old query filtered post-office rows and then counted them, so
       * searching "Crossings" reported that 201016 has ONE office — the count was of matching
       * offices, not of the pincode. `matched` narrows to pincodes; the aggregate then sees every
       * office in each of them.
       *
       * initcap because the directory stores district and state shouted ("GHAZIABAD",
       * "UTTAR PRADESH"), which reads as an error in a table full of sentence case.
       */
      `WITH matched AS (
         SELECT DISTINCT pincode
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
         ORDER BY pincode
         LIMIT 50
       )
       SELECT
         pd.pincode,
         initcap(min(pd.district))     AS district,
         initcap(min(pd.state_name))   AS state_name,
         min(pd.division_name)         AS division_name,
         count(*)::int                 AS office_count,
         string_agg(DISTINCT pd.office_name, ' · ' ORDER BY pd.office_name) AS offices,
         COALESCE(bool_or(pss.service_enabled), false) AS service_enabled,
         -- A baker "covers" a pincode either by sitting in it or by listing it as serviceable.
         (SELECT count(*)::int FROM baker_network.bakers b
           WHERE b.pincode = pd.pincode OR pd.pincode = ANY(b.serviceable_pincodes)) AS baker_count,
         -- Untriaged Google Places candidates, so an empty area is visibly empty rather than
         -- looking identical to one nobody has swept yet.
         (SELECT count(*)::int FROM baker_network.baker_discoveries d
           WHERE COALESCE(d.postal_code, d.search_pincode) = pd.pincode) AS candidate_count
       FROM baker_network.pincode_directory pd
       JOIN matched m ON m.pincode = pd.pincode
       LEFT JOIN baker_network.pincode_service_status pss ON pss.pincode = pd.pincode
       GROUP BY pd.pincode
       ORDER BY pd.pincode`,
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
          placeholder="Search pincode, area, district, state, circle, region, division, office type, or delivery status..."
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
          Search by pincode, area, district, state, circle, region, division, office type, or
          delivery status — 19,586 distinct pincodes is too many to list at once. Open a pincode to
          see every post office in it and the bakeries found there.
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
                <th className="px-4 py-2">Area</th>
                <th className="hidden px-4 py-2 lg:table-cell">District</th>
                <th className="hidden px-4 py-2 xl:table-cell">Division</th>
                <th className="px-4 py-2 text-right">Bakers</th>
                <th className="px-4 py-2 text-right">Candidates</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const href = `/pincodes/${r.pincode}`
                /**
                 * Every cell except the action column wraps its content in a full-height link, so
                 * clicking anywhere on the row opens the pincode. Previously only the six digits
                 * themselves were clickable and the rest of the row was dead space — you had to aim.
                 *
                 * Real links rather than an onClick on the row: middle-click, open-in-new-tab,
                 * keyboard focus and the status-bar URL preview all keep working, and the page stays
                 * a server component.
                 */
                const cell = "block -mx-4 -my-2 px-4 py-2"
                return (
                  <tr
                    key={r.pincode}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2 font-mono font-medium text-slate-900">
                      <Link href={href} className={cell}>
                        {r.pincode}
                      </Link>
                    </td>

                    <td className="max-w-xs px-4 py-2 text-slate-700">
                      <Link href={href} className={cell}>
                        <span className="line-clamp-2">{r.offices || "—"}</span>
                        <span className="text-[11px] text-slate-400">
                          {r.office_count} office{r.office_count === 1 ? "" : "s"}
                          <span className="lg:hidden">
                            {r.district ? ` · ${r.district}` : ""}
                            {r.state_name ? `, ${r.state_name}` : ""}
                          </span>
                        </span>
                      </Link>
                    </td>

                    <td className="hidden px-4 py-2 text-slate-600 lg:table-cell">
                      <Link href={href} className={cell}>
                        {r.district || "—"}
                        <span className="block text-[11px] text-slate-400">
                          {r.state_name || ""}
                        </span>
                      </Link>
                    </td>

                    <td className="hidden px-4 py-2 text-slate-600 xl:table-cell">
                      <Link href={href} className={cell}>
                        {r.division_name || "—"}
                      </Link>
                    </td>

                    <td className="px-4 py-2 text-right tabular-nums">
                      <Link href={href} className={cell}>
                        <span
                          className={
                            r.baker_count > 0 ? "font-semibold text-slate-900" : "text-slate-300"
                          }
                        >
                          {r.baker_count}
                        </span>
                      </Link>
                    </td>

                    <td className="px-4 py-2 text-right tabular-nums">
                      <Link href={href} className={cell}>
                        <span
                          className={
                            r.candidate_count > 0 ? "text-slate-700" : "text-slate-300"
                          }
                        >
                          {r.candidate_count}
                        </span>
                      </Link>
                    </td>

                    <td className="px-4 py-2">
                      <Link href={href} className={cell}>
                        {r.service_enabled ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                            Onboarded
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            Not onboarded
                          </span>
                        )}
                      </Link>
                    </td>

                    {/* Deliberately NOT wrapped in the row link — these submit, they don't navigate. */}
                    <td className="px-4 py-2 text-right">
                      {r.service_enabled ? (
                        <form action={offboardPincode.bind(null, r.pincode)}>
                          <button
                            type="submit"
                            className="text-xs font-semibold text-amber-600 hover:text-amber-800"
                          >
                            Pause
                          </button>
                        </form>
                      ) : (
                        <form action={onboardPincode.bind(null, r.pincode)}>
                          <button
                            type="submit"
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                          >
                            Onboard
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                )
              })}
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
