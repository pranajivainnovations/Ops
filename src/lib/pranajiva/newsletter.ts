import { getDbPool } from "@/lib/db"

/**
 * Email addresses left in the "hear when something new is ready" box in the pranajiva.in footer.
 *
 * Read-only on purpose. Nothing in this stack can send email, so the job this list serves is
 * copying the addresses out when there is news — a screen that reads, with no buttons.
 */

export interface SubscriberRow {
  id: string
  email: string
  source: string
  createdAt: string
  unsubscribedAt: string | null
}

/** True when the table exists, so the screen can say so instead of throwing a 500. */
export async function newsletterReady(): Promise<boolean> {
  try {
    const { rows } = await getDbPool().query<{ t: string | null }>(
      `SELECT to_regclass('support.newsletter_subscribers')::text AS t`
    )
    return Boolean(rows[0]?.t)
  } catch {
    return false
  }
}

export async function listSubscribers(limit = 2000): Promise<SubscriberRow[]> {
  const { rows } = await getDbPool().query(
    `SELECT id, email, source, created_at, unsubscribed_at
       FROM support.newsletter_subscribers
      WHERE brand = 'pranajiva'
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit]
  )

  return rows.map((r) => ({
    id: String(r.id),
    email: r.email,
    source: r.source,
    createdAt: new Date(r.created_at).toISOString(),
    unsubscribedAt: r.unsubscribed_at ? new Date(r.unsubscribed_at).toISOString() : null,
  }))
}
