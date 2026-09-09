import "server-only"

import webpush from "web-push"

import { getDbPool } from "./db"

/**
 * Sending browser notifications to the ops team.
 *
 * ── Why the public key is passed through props, not NEXT_PUBLIC_ ───────────────────────────────
 * The browser needs the VAPID public key to subscribe, which makes reaching for a `NEXT_PUBLIC_`
 * variable the obvious move. It is a trap in this codebase: `NEXT_PUBLIC_*` is inlined at *build*
 * time, inside the Docker builder stage, so the value has to exist as a build argument rather than
 * on the server — and a missing one produces a page that builds cleanly and fails silently at
 * runtime. That mistake has already cost two deploys here.
 *
 * So the key is read on the server like any other secret and handed to the client component as a
 * prop. Runtime only, one place to set it, and an absent key is visible immediately.
 *
 * ── Failure is expected and must never break the caller ────────────────────────────────────────
 * Push endpoints die constantly: browsers are uninstalled, permissions revoked, profiles wiped. A
 * notification that cannot be delivered is not a reason to fail the thing that triggered it — nobody
 * should lose a posted message because a colleague's old laptop no longer exists. Every send is
 * wrapped, and dead subscriptions are retired on the specific status codes that mean "gone".
 */

export interface PushConfig {
  publicKey: string
  privateKey: string
  subject: string
}

export function pushConfig(): PushConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return null

  return {
    publicKey,
    privateKey,
    // VAPID requires a contact the push service can reach if something goes wrong with our sending.
    subject: process.env.VAPID_SUBJECT?.trim() || "mailto:ops@crossfriend.in",
  }
}

export function isPushConfigured(): boolean {
  return pushConfig() !== null
}

export interface PushPayload {
  title: string
  body: string
  /** Where clicking the notification should land. */
  url: string
  /**
   * Collapses notifications that supersede each other.
   *
   * Three messages posted while somebody is at lunch should not produce three banners they have to
   * dismiss one at a time — the same tag replaces rather than stacks.
   */
  tag?: string
}

/**
 * Notify everyone except the person who caused it.
 *
 * Excluding the actor is not politeness, it is the difference between a useful notification and an
 * echo. Nothing is more certain to get a feature muted than being told about your own typing.
 */
export async function notifyTeam(
  payload: PushPayload,
  options: { exceptUserId?: string; onlyUserId?: string } = {}
): Promise<void> {
  const config = pushConfig()
  if (!config) return

  try {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)

    const conditions: string[] = ["failed_at IS NULL"]
    const params: unknown[] = []

    if (options.onlyUserId) {
      params.push(options.onlyUserId)
      conditions.push(`user_id = $${params.length}`)
    }
    if (options.exceptUserId) {
      params.push(options.exceptUserId)
      conditions.push(`user_id <> $${params.length}`)
    }

    const { rows } = await getDbPool().query(
      `SELECT id, endpoint, p256dh, auth
         FROM crossfriend.team_push_subscriptions
        WHERE ${conditions.join(" AND ")}`,
      params
    )

    if (rows.length === 0) return

    const body = JSON.stringify(payload)

    // In parallel, and settled rather than raced — one dead endpoint must not stop the rest.
    const results = await Promise.allSettled(
      rows.map((row) =>
        webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body,
          { TTL: 60 * 60 * 12 }
        )
      )
    )

    const dead: string[] = []
    const delivered: string[] = []

    results.forEach((result, index) => {
      const id = rows[index].id
      if (result.status === "fulfilled") {
        delivered.push(id)
        return
      }
      // 404 and 410 are the push protocol's "this subscription no longer exists". Anything else —
      // a timeout, a 500 from the push service — is transient and must not retire a live device.
      const status = (result.reason as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) dead.push(id)
    })

    if (delivered.length > 0) {
      await getDbPool().query(
        `UPDATE crossfriend.team_push_subscriptions
            SET last_sent_at = NOW(), failure_count = 0
          WHERE id = ANY($1::uuid[])`,
        [delivered]
      )
    }

    if (dead.length > 0) {
      await getDbPool().query(
        `UPDATE crossfriend.team_push_subscriptions
            SET failed_at = NOW(), failure_count = failure_count + 1
          WHERE id = ANY($1::uuid[])`,
        [dead]
      )
    }
  } catch (error) {
    // Logged, never thrown. See the note above: the caller's work already succeeded.
    console.error("[push] could not notify", error)
  }
}
