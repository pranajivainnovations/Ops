"use server"

import { getCurrentSession } from "@/lib/auth"
import { getDbPool } from "@/lib/db"

/**
 * Storing and removing a browser's push subscription.
 *
 * Separate from actions.ts because these are called from the client with JSON rather than from a
 * form, and none of them revalidate the page — subscribing should not reload the board underneath
 * somebody who has just clicked a button.
 */

export interface SubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}

export async function saveSubscription(input: SubscriptionInput): Promise<{ ok: boolean }> {
  const session = await getCurrentSession()
  if (!session?.userId) return { ok: false }
  if (!input?.endpoint || !input.p256dh || !input.auth) return { ok: false }

  /**
   * Upsert on the endpoint, not on the user.
   *
   * Re-subscribing the same browser returns the same endpoint, so without this a person clicking
   * Enable twice would be stored twice and receive every notification twice. The user_id is updated
   * too, which handles the real case of a shared machine: whoever most recently granted permission
   * in that browser profile is who it belongs to.
   */
  await getDbPool().query(
    `INSERT INTO crossfriend.team_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE
        SET user_id    = EXCLUDED.user_id,
            p256dh     = EXCLUDED.p256dh,
            auth       = EXCLUDED.auth,
            user_agent = EXCLUDED.user_agent,
            /* Clearing the failure marks a previously dead endpoint alive again, which is exactly
               what re-granting permission means. */
            failed_at  = NULL,
            failure_count = 0`,
    [session.userId, input.endpoint, input.p256dh, input.auth, (input.userAgent ?? "").slice(0, 300)]
  )

  return { ok: true }
}

export async function removeSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const session = await getCurrentSession()
  if (!session?.userId) return { ok: false }
  if (!endpoint) return { ok: false }

  // Scoped to the caller: an endpoint is not a secret, and nobody should be able to unsubscribe
  // somebody else's device by guessing one.
  await getDbPool().query(
    `DELETE FROM crossfriend.team_push_subscriptions
      WHERE endpoint = $1 AND user_id = $2`,
    [endpoint, session.userId]
  )

  return { ok: true }
}
