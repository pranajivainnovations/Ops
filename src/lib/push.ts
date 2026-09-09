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

/**
 * The customer audience.
 *
 * ── Why this is a separate function and not notifyTeam with a flag ─────────────────────────────
 * They share the transport and nothing else. The team send excludes the person who caused it, is
 * triggered automatically by something happening, and reaches five known accounts. This one is
 * triggered by a person deciding to press send, reaches an unbounded list of strangers, and has to
 * report what it did — because a campaign that half-sent and said nothing is indistinguishable from
 * one that worked. A shared function with a flag would be two functions sharing a name.
 */

/**
 * How many pushes are in flight at once.
 *
 * Everything at once would be one line of code and would open thousands of simultaneous TLS
 * connections from a small container, which is how a send takes the site down with it. Batched, a
 * campaign to thirty thousand devices is three hundred rounds of a hundred — a few seconds, and
 * flat memory.
 */
const SEND_BATCH = 100

export interface BroadcastResult {
  sent: number
  failed: number
  /** Subscriptions the push service reported as gone, and which are now retired. */
  retired: number
}

/**
 * Send one campaign to every live subscriber.
 *
 * Unlike notifyTeam this reports rather than swallowing, because the caller is a person watching a
 * screen who needs to know what happened. It still never throws for a delivery failure — dead
 * endpoints are the normal state of a push list, not an error.
 */
export async function notifySubscribers(payload: PushPayload & { image?: string }): Promise<BroadcastResult> {
  const config = pushConfig()
  if (!config) return { sent: 0, failed: 0, retired: 0 }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)

  const { rows } = await getDbPool().query(
    `SELECT id, endpoint, p256dh, auth
       FROM crossfriend.push_subscribers
      WHERE failed_at IS NULL AND revoked_at IS NULL`
  )

  if (rows.length === 0) return { sent: 0, failed: 0, retired: 0 }

  const body = JSON.stringify(payload)
  const delivered: string[] = []
  const dead: string[] = []
  let failed = 0

  for (let start = 0; start < rows.length; start += SEND_BATCH) {
    const batch = rows.slice(start, start + SEND_BATCH)

    const results = await Promise.allSettled(
      batch.map((row) =>
        webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body,
          /* Two days. A team notification is worthless once the moment passes, but an offer is still
             an offer when somebody opens their laptop on Monday. */
          { TTL: 60 * 60 * 48 }
        )
      )
    )

    results.forEach((result, index) => {
      const id = batch[index].id
      if (result.status === "fulfilled") {
        delivered.push(id)
        return
      }
      failed += 1
      // 404 and 410 are the push protocol's "this subscription no longer exists". Anything else — a
      // timeout, a 500 from the push service — is transient and must not retire a live device.
      const status = (result.reason as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) dead.push(id)
    })
  }

  /* Recorded after the whole send rather than per batch: two statements instead of six hundred, and
     a crash mid-campaign leaves the list untouched rather than half-annotated. */
  if (delivered.length > 0) {
    await getDbPool().query(
      `UPDATE crossfriend.push_subscribers SET last_sent_at = NOW() WHERE id = ANY($1::uuid[])`,
      [delivered]
    )
  }
  if (dead.length > 0) {
    await getDbPool().query(
      `UPDATE crossfriend.push_subscribers
          SET failed_at = NOW(), failure_count = failure_count + 1
        WHERE id = ANY($1::uuid[])`,
      [dead]
    )
  }

  return { sent: delivered.length, failed, retired: dead.length }
}

/** True when the customer push tables exist, so the page can say so instead of erroring. */
export async function broadcastSchemaReady(): Promise<boolean> {
  const { rows } = await getDbPool().query<{ ready: boolean }>(
    `SELECT to_regclass('crossfriend.push_subscribers') IS NOT NULL AS ready`
  )
  return Boolean(rows[0]?.ready)
}
