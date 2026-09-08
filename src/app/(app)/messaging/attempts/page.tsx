import Link from "next/link"

import { getDbPool } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * Who tried to sign in, and where it went wrong.
 *
 * These people are invisible everywhere else in OPS: someone who never completed sign-in has no
 * account, no order, and appears in no funnel beyond an anonymous page view. If the SMS failed or
 * the code arrived late, this screen is the only place that fact exists.
 *
 * ── Read the "stuck" column before the totals ──────────────────────────────────────────────────
 * A high send count is not a problem; a high count of sends that never became verifications is.
 * The summary leads with that number for the same reason the SEO screen leads with failures — a
 * dashboard that opens on a reassuring total invites nobody to look further.
 */

const fmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
})

interface Row {
  id: string
  mobile: string
  status: string
  provider_error: string | null
  sender_header: string | null
  verify_attempts: number
  last_failure_kind: string | null
  requested_at: string
  verified_at: string | null
}

const STATUS_STYLE: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  sent: "bg-amber-50 text-amber-700 ring-amber-200",
  send_failed: "bg-rose-50 text-rose-700 ring-rose-200",
  verify_failed: "bg-rose-50 text-rose-700 ring-rose-200",
  requested: "bg-slate-100 text-slate-600 ring-slate-200",
}

const STATUS_LABEL: Record<string, string> = {
  verified: "Signed in",
  // "Sent" alone reads like success. It is the opposite: the code went out and nobody came back.
  sent: "No code entered",
  send_failed: "SMS failed",
  verify_failed: "Wrong / expired code",
  requested: "Requested",
}

export default async function AttemptsPage({
  searchParams,
}: {
  searchParams: Promise<{ mobile?: string; status?: string }>
}) {
  const { mobile, status } = await searchParams
  const db = getDbPool()

  const filters: string[] = []
  const params: unknown[] = []
  if (mobile && /^\d{4,10}$/.test(mobile)) {
    params.push(`%${mobile}%`)
    filters.push(`mobile LIKE $${params.length}`)
  }
  if (status && STATUS_LABEL[status]) {
    params.push(status)
    filters.push(`status = $${params.length}`)
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : ""

  const [rows, summary] = await Promise.all([
    db.query<Row>(
      `SELECT id, mobile, status, provider_error, sender_header, verify_attempts,
              last_failure_kind, requested_at, verified_at
         FROM crossfriend.otp_attempts
         ${where}
        ORDER BY requested_at DESC
        LIMIT 200`,
      params
    ),
    db.query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE status = 'verified')::int AS verified,
         count(*) FILTER (WHERE status IN ('sent','verify_failed'))::int AS stuck,
         count(*) FILTER (WHERE status = 'send_failed')::int AS send_failed,
         count(DISTINCT mobile)::int AS numbers
       FROM crossfriend.otp_attempts
       WHERE requested_at > NOW() - INTERVAL '7 days'`
    ),
  ])

  const s = summary.rows[0]

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Sign-in attempts</h1>
        <p className="mt-1 text-xs text-slate-500">
          Every OTP request and what became of it.{" "}
          <Link href="/messaging" className="underline underline-offset-2">
            Messaging settings
          </Link>
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Needs follow-up" value={s.stuck} tone="warn" />
          <Stat label="SMS failed" value={s.send_failed} tone={s.send_failed > 0 ? "bad" : "plain"} />
          <Stat label="Signed in" value={s.verified} tone="good" />
          <Stat label="Distinct numbers" value={s.numbers} tone="plain" />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Last 7 days · {s.total} attempts total.</p>

        <form className="mt-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="mobile">
              Mobile contains
            </label>
            <input
              id="mobile"
              name="mobile"
              defaultValue={mobile ?? ""}
              placeholder="last 4 digits is enough"
              className="w-52 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ""}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="">All</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Filter
          </button>
          {(mobile || status) && (
            <Link href="/messaging/attempts" className="text-xs text-slate-500 underline">
              Clear
            </Link>
          )}
        </form>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-4 py-2 font-semibold">When</th>
                <th className="px-4 py-2 font-semibold">Mobile</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Tries</th>
                <th className="px-4 py-2 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    No attempts recorded yet.
                  </td>
                </tr>
              )}
              {rows.rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-600">
                    {fmt.format(new Date(r.requested_at))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-slate-900">
                    +91 {r.mobile}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                        STATUS_STYLE[r.status] ?? STATUS_STYLE.requested
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center text-xs tabular-nums text-slate-600">
                    {r.verify_attempts || "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {/*
                      The provider's own words. These are hidden from the customer on purpose —
                      "temporarily unavailable" gives an attacker nothing — which is exactly why
                      they have to surface somewhere an operator can read them.
                    */}
                    {r.provider_error ? (
                      <span className="font-mono text-rose-700">{r.provider_error.slice(0, 120)}</span>
                    ) : r.last_failure_kind ? (
                      <span className="text-slate-500">{r.last_failure_kind}</span>
                    ) : r.verified_at ? (
                      <span className="text-emerald-700">
                        verified {fmt.format(new Date(r.verified_at))}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/*
          Stated on the screen rather than only in a policy document, because the person who will
          act on these numbers is the person reading this page.
        */}
        <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
          <strong>These are mostly not customers.</strong> Most rows are people who never completed
          sign-in, so there is no account and no consent beyond having typed a number into a form.
          Rows are deleted automatically after 90 days. Contacting someone here to help with a failed
          sign-in is support; contacting them about offers is marketing, which needs consent under
          TRAI&rsquo;s unsolicited-communication rules. No OTP code is stored, ever.
        </p>
      </div>
    </main>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "good" | "warn" | "bad" | "plain"
}) {
  const ring =
    tone === "good"
      ? "ring-emerald-200 bg-emerald-50"
      : tone === "warn"
        ? "ring-amber-200 bg-amber-50"
        : tone === "bad"
          ? "ring-rose-200 bg-rose-50"
          : "ring-slate-200 bg-white"

  return (
    <div className={`rounded-xl p-4 ring-1 ${ring}`}>
      <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-600">{label}</p>
    </div>
  )
}
