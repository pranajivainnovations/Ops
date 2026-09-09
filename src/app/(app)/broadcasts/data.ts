import { getDbPool } from "@/lib/db"

/**
 * Reading the customer push audience and what has been sent to it.
 */

export interface Audience {
  /** Devices that would receive a campaign sent right now. */
  live: number
  /** Subscriptions the push services reported as gone. */
  dead: number
  /** People who switched notifications off themselves. */
  revoked: number
  /** Live subscribers who arrived in the last seven days. */
  recent: number
}

export interface Campaign {
  id: string
  title: string
  body: string
  url: string
  imageUrl: string | null
  status: string
  sentAt: Date | null
  sentCount: number
  failedCount: number
  createdBy: string | null
  createdAt: Date
}

/**
 * The audience, counted four ways in one pass.
 *
 * Separate counts rather than one number, because they answer different questions and only one of
 * them is reassuring. A list that grew to 4,000 and quietly lost 900 to dead endpoints and 300 to
 * people opting out looks identical to one that grew to 2,800 cleanly — until you can see the
 * breakdown, and then it is obviously a different business.
 */
export async function loadAudience(): Promise<Audience> {
  const { rows } = await getDbPool().query<{
    live: number
    dead: number
    revoked: number
    recent: number
  }>(
    `SELECT
        count(*) FILTER (WHERE failed_at IS NULL AND revoked_at IS NULL)::int AS live,
        count(*) FILTER (WHERE failed_at IS NOT NULL)::int                    AS dead,
        count(*) FILTER (WHERE revoked_at IS NOT NULL)::int                   AS revoked,
        count(*) FILTER (WHERE failed_at IS NULL AND revoked_at IS NULL
                           AND created_at > NOW() - INTERVAL '7 days')::int   AS recent
       FROM crossfriend.push_subscribers`
  )

  const row = rows[0]
  return {
    live: row?.live ?? 0,
    dead: row?.dead ?? 0,
    revoked: row?.revoked ?? 0,
    recent: row?.recent ?? 0,
  }
}

/**
 * What has gone out, newest first.
 *
 * A push cannot be recalled, so the single most useful thing this screen can do before somebody
 * presses send is show them what was sent last time. Most duplicate campaigns are not a bug in the
 * software; they are two people who each thought the other had not done it yet.
 */
export async function loadCampaigns(limit = 30): Promise<Campaign[]> {
  const { rows } = await getDbPool().query(
    `SELECT c.id, c.title, c.body, c.url, c.image_url, c.status,
            c.sent_at, c.sent_count, c.failed_count, c.created_at,
            COALESCE(u.name, u.email) AS created_by
       FROM crossfriend.push_campaigns c
       LEFT JOIN baker_network.ops_users u ON u.id = c.created_by
      ORDER BY c.created_at DESC
      LIMIT $1`,
    [limit]
  )

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    url: r.url,
    imageUrl: r.image_url ?? null,
    status: r.status,
    sentAt: r.sent_at,
    sentCount: r.sent_count,
    failedCount: r.failed_count,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
  }))
}
