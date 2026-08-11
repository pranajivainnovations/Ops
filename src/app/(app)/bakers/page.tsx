import Link from "next/link"
import { getDbPool } from "@/lib/db"
import BakerTabs from "./baker-tabs"

export const dynamic = "force-dynamic"

export default async function BakersPage() {
  const db = getDbPool()
  /**
   * The same facts the discoveries screen shows, because they are the same judgement.
   *
   * Deciding whether a bakery is worth pursuing needs rating, review count, a phone number and
   * whether they have a website — and all of that already exists on this table, carried over when a
   * discovery is promoted. It simply was not selected, so the team had to open each baker one at a
   * time to see what the discoveries list shows at a glance.
   */
  const result = await db.query(
    `SELECT id, name, city, state, pincode, status, is_active, trust_badge, blue_tick,
            phone, website_url, google_rating, google_review_count, confidence, last_contacted_at
     FROM baker_network.bakers
     ORDER BY created_at DESC`
  )

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Bakers</h1>
        <Link
          href="/bakers/new"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          + Add baker
        </Link>
      </header>
      <BakerTabs />

      {/* Wider than it was: the table now carries rating, phone, website and confidence, and 5xl
          forced the new columns into a horizontal scroll on an ordinary laptop. */}
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {result.rows.length === 0 ? (
          <p className="text-sm text-slate-500">No bakers yet. Add the first one.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="hidden px-4 py-2 sm:table-cell">Location</th>
                  <th className="hidden px-4 py-2 lg:table-cell">Rating</th>
                  <th className="hidden px-4 py-2 lg:table-cell">Phone</th>
                  <th className="hidden px-4 py-2 md:table-cell">Website</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="hidden px-4 py-2 lg:table-cell">Confidence</th>
                  <th className="hidden px-4 py-2 sm:table-cell">Badges</th>
                  <th className="hidden px-4 py-2 sm:table-cell">Active</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((b) => {
                  // Same full-cell links as the pincode browser: the whole row is the target, not
                  // just the name. Only the action column stays outside.
                  const href = `/bakers/${b.id}`
                  const cell = "block -mx-4 -my-2 px-4 py-2"
                  return (
                  <tr
                    key={b.id}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2 font-medium text-slate-900">
                      <Link href={href} className={cell}>
                        {b.name}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-2 text-slate-600 sm:table-cell">
                      <Link href={href} className={cell}>
                        {[b.city, b.state].filter(Boolean).join(", ") || "—"}
                        {b.pincode ? ` · ${b.pincode}` : ""}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-2 text-slate-600 lg:table-cell">
                      <Link href={href} className={cell}>
                        {b.google_rating != null
                          ? `⭐ ${b.google_rating}${b.google_review_count != null ? ` (${b.google_review_count})` : ""}`
                          : "—"}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-2 text-slate-600 lg:table-cell">
                      <Link href={href} className={cell}>
                        {b.phone || "—"}
                      </Link>
                    </td>
                    {/* Yes/No at a glance, with the link itself behind the "Yes" — a bakery that
                        already has a website is a different conversation from one that does not,
                        and the team should not have to open a record to find that out. Opens in a
                        new tab and carries noreferrer, since these are third-party sites. */}
                    <td className="hidden px-4 py-2 md:table-cell">
                      {b.website_url ? (
                        <a
                          href={b.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
                          title={b.website_url}
                        >
                          Yes
                        </a>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      <Link href={href} className={cell}>
                        {b.status}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-2 lg:table-cell">
                      <Link href={href} className={cell}>
                        {b.confidence ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              b.confidence === "high"
                                ? "bg-emerald-100 text-emerald-800"
                                : b.confidence === "medium"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {b.confidence}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-2 sm:table-cell">
                      {b.trust_badge && (
                        <span className="mr-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                          Trust
                        </span>
                      )}
                      {b.blue_tick && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          Blue Tick
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-2 sm:table-cell">
                      <Link href={href} className={cell}>
                        {b.is_active ? "Yes" : "No"}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`${href}?tab=edit`}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
