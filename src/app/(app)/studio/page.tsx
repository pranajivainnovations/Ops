import Link from "next/link"

import { getDbPool } from "@/lib/db"
import StudioGrantForm from "./grant-form"

export const dynamic = "force-dynamic"

/**
 * Who is running out of Studio generations, and the form that gives them more.
 *
 * ── Why the list is ordered by who has least left ──────────────────────────────────────────────
 * Somebody at zero is the most interesting person on the platform: they have described nine or ten
 * cakes to us and not ordered one. They are either about to, or they have been using us as a free
 * image generator — and a phone call is the only thing that distinguishes those. Ranking by what is
 * left puts that conversation at the top of the screen; ranking by volume would bury it under people
 * who are simply active.
 *
 * ── Why the form and the list share a page ─────────────────────────────────────────────────────
 * Same reason as the wallet grant screen. What bounds a discretionary give-away is not a budget —
 * there cannot be one, that is what makes it discretionary — but that the last few are visible
 * directly above the form making the next.
 *
 * ── Why the numbers are computed here and not fetched ──────────────────────────────────────────
 * OPS reads the database directly for everything it displays; the backend route exists for the
 * write, where attribution and the append-only rule live. The arithmetic below has to match the
 * backend's — base allowance plus grants, minus generations that count — so both are checked against
 * each other in the harness rather than trusted to stay in step.
 */

interface UsageRow {
  customer_id: string
  email: string | null
  phone: string | null
  used: number
  granted: number
  last_at: string
}

interface GrantRow {
  customer_id: string
  amount: number
  reason: string
  created_at: string
  given_by: string
  email: string | null
}

/** Falls back to the same default the backend uses when nothing has been configured. */
const DEFAULT_FREE = 10

export default async function StudioPage() {
  const db = getDbPool()

  const { rows: cfgRows } = await db.query(
    `SELECT params, is_enabled
       FROM wallet.reward_config
      WHERE brand = 'crossfriend' AND mechanic = 'studio'
      ORDER BY version DESC
      LIMIT 1`
  )

  const params = (cfgRows[0]?.params ?? {}) as Record<string, unknown>
  const configured = cfgRows.length > 0
  const freeSignedIn = Number.isFinite(Number(params.free_signed_in))
    ? Number(params.free_signed_in)
    : DEFAULT_FREE
  const chargeFailed = params.charge_failed === true
  const unitCostPaise = Number(params.unit_cost_paise ?? 0)

  /**
   * Usage and grants read separately, and the grants half allowed to fail.
   *
   * The grants table arrives in a migration, and between this page shipping and that migration
   * running it does not exist. Joined into one statement, a missing table takes the whole screen
   * down — including the usage list, which needs nothing from it. Read apart, the worst case is that
   * top-ups are missing from a page whose other half still answers the question it is open for.
   * The backend's allowance service is split for exactly the same reason.
   */
  const { rows: rawUsage } = await db.query<Omit<UsageRow, "granted">>(
    `SELECT c.id AS customer_id, c.email, c.phone,
            u.n AS used, u.last_at
       FROM (
         SELECT customer_id, COUNT(*)::int n, MAX(created_at) last_at
           FROM ai_studio.generations
          WHERE status = 'completed' OR ($1::boolean AND status = 'failed')
          GROUP BY customer_id
       ) u
       JOIN public.customer c ON c.id = u.customer_id AND c.deleted_at IS NULL
      ORDER BY u.n DESC
      LIMIT 50`,
    [chargeFailed]
  )

  const grantedBy = new Map<string, number>()
  let grants: GrantRow[] = []
  let grantsUnavailable = false

  try {
    const { rows } = await db.query<{ customer_id: string; n: number }>(
      `SELECT customer_id, COALESCE(SUM(amount), 0)::int n
         FROM ai_studio.generation_grants
        GROUP BY customer_id`
    )
    for (const r of rows) grantedBy.set(r.customer_id, r.n)

    const recent = await db.query<GrantRow>(
      `SELECT gg.customer_id, gg.amount, gg.reason, gg.created_at,
              COALESCE(o.name, o.email, '—') AS given_by,
              c.email
         FROM ai_studio.generation_grants gg
         LEFT JOIN baker_network.ops_users o ON o.id = gg.created_by
         LEFT JOIN public.customer c ON c.id = gg.customer_id
        ORDER BY gg.created_at DESC
        LIMIT 25`
    )
    grants = recent.rows
  } catch {
    /* Almost certainly the migration has not run on this database yet. */
    grantsUnavailable = true
  }

  /* Sorted here rather than in SQL, now that the grant totals arrive separately. Emptiest first. */
  const usage: UsageRow[] = rawUsage
    .map((r) => ({ ...r, granted: grantedBy.get(r.customer_id) ?? 0 }))
    .sort(
      (a, b) =>
        freeSignedIn + a.granted - a.used - (freeSignedIn + b.granted - b.used) ||
        b.used - a.used
    )

  const exhausted = usage.filter((r) => freeSignedIn + r.granted - r.used <= 0)
  const mobileOf = (r: UsageRow) => r.phone || (r.email || "").split("@")[0] || "—"

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-lg font-semibold text-slate-900">AI Studio generations</h1>
          <p className="mt-1 text-sm text-slate-600">
            Everyone who has generated a design, emptiest account first. When somebody runs out they
            cannot generate again until you add more — so this list is a call sheet, not a report.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            The allowance itself is set in{" "}
            <Link href="/rewards" className="font-medium text-slate-700 underline">
              Rewards → AI Studio
            </Link>
            .
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Free per customer"
            value={configured ? String(freeSignedIn) : `${DEFAULT_FREE} (default)`}
            note={configured ? "From the Studio config" : "Nothing configured yet — the backend falls back to this"}
          />
          <Stat
            label="Out of generations"
            value={String(exhausted.length)}
            note={exhausted.length ? "Waiting on a conversation" : "Nobody is blocked right now"}
          />
          <Stat
            label="Failed generations"
            value={chargeFailed ? "Use up an allowance" : "Do not count"}
            note={
              chargeFailed
                ? "A provider failure costs the customer an attempt"
                : "A provider failure costs us compute, not them"
            }
          />
        </section>

        {grantsUnavailable && (
          <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            Top-ups are not available on this database yet — the migration that creates them has not
            run. Usage below is correct; anything already granted is not counted in it.
          </p>
        )}

        <h2 className="mt-8 text-sm font-semibold text-slate-900">Give someone more</h2>
        <div className="mt-3">
          <StudioGrantForm />
        </div>

        <h2 className="mt-8 text-sm font-semibold text-slate-900">Usage</h2>
        {usage.length === 0 ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            Nobody has generated a design yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Customer</th>
                  <th className="px-4 py-2 text-right font-semibold">Used</th>
                  <th className="px-4 py-2 text-right font-semibold">Given</th>
                  <th className="px-4 py-2 text-right font-semibold">Left</th>
                  <th className="px-4 py-2 text-right font-semibold">Cost to us</th>
                  <th className="px-4 py-2 font-semibold">Last design</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((r) => {
                  const left = Math.max(0, freeSignedIn + r.granted - r.used)
                  return (
                    <tr key={r.customer_id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2">
                        <span className="font-medium tabular-nums text-slate-900">{mobileOf(r)}</span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-700">{r.used}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                        {r.granted ? `+${r.granted}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span
                          className={
                            left === 0
                              ? "rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800 ring-1 ring-amber-200"
                              : "text-sm tabular-nums text-slate-700"
                          }
                        >
                          {left === 0 ? "none left" : left}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                        {unitCostPaise > 0
                          ? `₹${((r.used * unitCostPaise) / 100).toLocaleString("en-IN")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {new Date(r.last_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="mt-8 text-sm font-semibold text-slate-900">Recently given</h2>
        {grants.length === 0 ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            Nothing has been given by hand yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {grants.map((g, i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900">
                    +{g.amount} to{" "}
                    <span className="tabular-nums">
                      {(g.email || "").split("@")[0] || g.customer_id}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {g.given_by} ·{" "}
                    {new Date(g.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{g.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-slate-500">{note}</div>
    </div>
  )
}
