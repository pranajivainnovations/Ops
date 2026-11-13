import { getDbPool } from "@/lib/db"

/**
 * Ritu, the cycle tracker at pranajiva.in/tracker: how it is being used.
 *
 * ── What this deliberately cannot show ──────────────────────────────────────────────────────────
 * The tracker tells every woman "Only you. Our team does not see this data." Her health values
 * are sealed with a key that lives only in the storefront's environment; OPS does not have it and
 * must never be given it. So everything here is counted from row metadata — how many entries of
 * each kind, when they were made — and never from what is inside them. Accounts are listed under
 * anonymous labels: no customer id, phone, email or name reaches this screen, because knowing that
 * a particular person uses a period tracker is itself health information.
 */

export interface TrackerOverview {
  accounts: number
  setUp: number
  active7: number
  active30: number
  remindersOn: number
  fingerprint: number
  entries: { key: EntryKind; total: number; week: number }[]
  /** Last 30 days, oldest first, IST dates: how many accounts logged anything that day. */
  daily: { date: string; people: number; entries: number }[]
  reminders: { kind: string; sent: number }[]
  people: AnonAccount[]
}

export type EntryKind =
  | "period_day"
  | "daily_log"
  | "weekly_log"
  | "hot_flush"
  | "monthly_check"
  | "test_result"
  | "checklist_item"

export const ENTRY_LABEL: Record<EntryKind, string> = {
  period_day: "Period days",
  daily_log: "Daily check-ins",
  weekly_log: "Weekly scores",
  hot_flush: "Hot flushes",
  monthly_check: "Monthly checks",
  test_result: "Test results",
  checklist_item: "Tests ticked off",
}

const KINDS = Object.keys(ENTRY_LABEL) as EntryKind[]

export interface AnonAccount {
  label: string
  joined: string
  setUp: boolean
  lastActive: string | null
  daysLogged: number
  entries: number
  remindersOn: boolean
}

/** True when the tracker schema exists, so the screen can say so instead of throwing a 500. */
export async function trackerReady(): Promise<boolean> {
  try {
    const { rows } = await getDbPool().query<{ t: string | null }>(
      `SELECT to_regclass('tracker.profile')::text AS t`
    )
    return Boolean(rows[0]?.t)
  } catch {
    return false
  }
}

/** Tables added by later migrations may be missing; count them as empty rather than failing. */
async function existing(): Promise<Set<EntryKind>> {
  const { rows } = await getDbPool().query<{ t: string }>(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'tracker'`
  )
  const have = new Set(rows.map((r) => r.t))
  return new Set(KINDS.filter((k) => have.has(k)))
}

const IST = `AT TIME ZONE 'Asia/Kolkata'`

export async function loadTrackerOverview(): Promise<TrackerOverview> {
  const db = getDbPool()
  const kinds = [...(await existing())]

  const head = await db.query(
    `SELECT count(*)::int AS accounts,
            count(*) FILTER (WHERE p.onboarding_done)::int AS set_up,
            count(*) FILTER (WHERE s.last_active_at > now() - interval '7 days')::int AS active7,
            count(*) FILTER (WHERE s.last_active_at > now() - interval '30 days')::int AS active30,
            count(*) FILTER (WHERE s.passkey_enabled)::int AS fingerprint
       FROM tracker.profile p
       LEFT JOIN tracker.settings s ON s.user_id = p.user_id`
  )
  const push = await db.query(`SELECT count(DISTINCT user_id)::int AS n FROM tracker.push_subscription`)

  const entries = await Promise.all(
    kinds.map(async (k) => {
      const { rows } = await db.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS week
           FROM tracker.${k}`
      )
      return { key: k, total: rows[0].total, week: rows[0].week }
    })
  )

  // Every entry row, reduced to (account, IST day). The union is built only from known table names.
  const union = kinds
    .map((k) => `SELECT user_id, (created_at ${IST})::date AS d FROM tracker.${k}`)
    .join(" UNION ALL ")

  const daily = await db.query(
    `WITH e AS (${union})
     SELECT to_char(g.d, 'YYYY-MM-DD') AS date,
            count(DISTINCT e.user_id)::int AS people,
            count(e.user_id)::int AS entries
       FROM generate_series((now() ${IST})::date - 29, (now() ${IST})::date, interval '1 day') AS g(d)
       LEFT JOIN e ON e.d = g.d::date
      GROUP BY g.d
      ORDER BY g.d`
  )

  const reminders = await db.query(
    `SELECT kind, count(*)::int AS sent
       FROM tracker.reminder_log
      WHERE sent_on > (now() ${IST})::date - 30
      GROUP BY kind
      ORDER BY sent DESC`
  )

  // Ordered by join date so the labels stay put as new people arrive: the first account is
  // always "Account 1". user_id is used for the join and dropped before anything leaves here.
  const people = await db.query(
    `WITH e AS (${union})
     SELECT p.created_at, p.onboarding_done, s.last_active_at,
            (SELECT count(DISTINCT d)::int FROM e WHERE e.user_id = p.user_id) AS days_logged,
            (SELECT count(*)::int FROM e WHERE e.user_id = p.user_id) AS entries,
            EXISTS (SELECT 1 FROM tracker.push_subscription ps WHERE ps.user_id = p.user_id) AS push
       FROM tracker.profile p
       LEFT JOIN tracker.settings s ON s.user_id = p.user_id
      ORDER BY p.created_at`
  )

  const h = head.rows[0]
  return {
    accounts: h.accounts,
    setUp: h.set_up,
    active7: h.active7,
    active30: h.active30,
    fingerprint: h.fingerprint,
    remindersOn: push.rows[0].n,
    entries,
    daily: daily.rows,
    reminders: reminders.rows,
    people: people.rows.map((r, i) => ({
      label: `Account ${i + 1}`,
      joined: new Date(r.created_at).toISOString(),
      setUp: r.onboarding_done,
      lastActive: r.last_active_at ? new Date(r.last_active_at).toISOString() : null,
      daysLogged: r.days_logged,
      entries: r.entries,
      remindersOn: r.push,
    })),
  }
}
