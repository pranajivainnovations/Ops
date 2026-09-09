"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth"
import { getDbPool } from "@/lib/db"
import { uploadAnnouncementImage } from "@/lib/s3"

import { isTheme } from "./themes"

/**
 * Writing announcements.
 *
 * These are the only records in OPS that are published, unedited, to every visitor on the public
 * site. So validation here is not about protecting the database — it is the last point at which a
 * mistake is cheap. After publish it is on every page.
 */

const MAX_TITLE = 120
const MAX_BODY = 600

function fail(message: string): never {
  redirect(`/announcements?error=${encodeURIComponent(message)}`)
}

function str(formData: FormData, key: string): string {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

async function requireUser(): Promise<string> {
  const session = await getCurrentSession()
  if (!session?.userId) fail("Your session has expired — please sign in again.")
  return session.userId
}

/**
 * Only http(s), and only absolute.
 *
 * A `javascript:` URL on a button rendered for every visitor is the one genuinely dangerous thing a
 * structured composer can still let through, so it is rejected here rather than hoped away in the
 * renderer. Relative paths are allowed because most links point back into the site.
 */
function validateCtaUrl(value: string): string {
  if (value.startsWith("/")) return value
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    fail("The button link must be a full URL, or a path starting with /.")
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    fail("The button link must be an http or https address.")
  }
  return parsed.toString()
}

/**
 * Interprets what somebody typed as India time, always.
 *
 * ── The bug this fixes ─────────────────────────────────────────────────────────────────────────
 * A datetime-local input carries no timezone — the browser hands over "2026-09-09T23:00" and nothing
 * else. `new Date()` on that string resolves it against whatever zone the *server* runs in, which
 * here is UTC. So an announcement set to start at 11pm was stored as 23:00 UTC and scheduled for
 * 4:30am IST the next morning: published, correct by its own data, and invisible for five hours with
 * nothing on any screen to explain why.
 *
 * ── Why IST rather than the browser's offset ───────────────────────────────────────────────────
 * The offset could be sent from the client, and it would be the wrong answer. This banner is shown
 * to customers in India; "start it at 9am" means 9am where the customers are, not where the person
 * scheduling it happens to be sitting. Pinning it to Asia/Kolkata makes the field mean the same
 * thing from a laptop in Delhi and a phone in another country.
 *
 * +05:30 is hardcoded rather than computed because India has no daylight saving and has not changed
 * its offset since 1945 — a lookup here would be machinery guarding against nothing.
 */
const IST_OFFSET = "+05:30"

function optionalDate(value: string, label: string): string | null {
  if (!value) return null
  // "2026-09-09T23:00" → "2026-09-09T23:00:00+05:30", an unambiguous instant.
  const withSeconds = value.length === 16 ? `${value}:00` : value
  const parsed = new Date(`${withSeconds}${IST_OFFSET}`)
  if (Number.isNaN(parsed.getTime())) fail(`${label} is not a valid date.`)
  return parsed.toISOString()
}

export async function saveAnnouncement(formData: FormData): Promise<void> {
  const userId = await requireUser()

  const id = str(formData, "id")
  const title = str(formData, "title")
  const body = str(formData, "body")
  const theme = str(formData, "theme") || "purple"
  const ctaLabel = str(formData, "cta_label")
  const ctaUrlRaw = str(formData, "cta_url")

  if (!title) fail("Give the announcement a headline.")
  if (title.length > MAX_TITLE) fail(`The headline must be under ${MAX_TITLE} characters.`)
  if (body.length > MAX_BODY) fail(`The message must be under ${MAX_BODY} characters.`)
  if (!isTheme(theme)) fail("Pick one of the available colours.")

  // The database enforces this too. Checked here so the person gets a sentence rather than a
  // constraint violation.
  if (Boolean(ctaLabel) !== Boolean(ctaUrlRaw)) {
    fail("A button needs both a label and a link, or neither.")
  }
  const ctaUrl = ctaUrlRaw ? validateCtaUrl(ctaUrlRaw) : null

  const startsAt = optionalDate(str(formData, "starts_at"), "The start date")
  const endsAt = optionalDate(str(formData, "ends_at"), "The end date")
  if (startsAt && endsAt && startsAt >= endsAt) fail("The end must come after the start.")

  /**
   * The image is uploaded to our own bucket rather than stored as a pasted URL.
   *
   * A remote image on every page load is somebody else's uptime, somebody else's analytics on our
   * visitors, and a layout that changes the day they replace the file. Ours cannot do any of that.
   */
  let imageUrl: string | null = str(formData, "existing_image_url") || null
  const file = formData.get("image")
  if (file instanceof File && file.size > 0) {
    try {
      const uploaded = await uploadAnnouncementImage(
        Buffer.from(await file.arrayBuffer()),
        file.type
      )
      imageUrl = uploaded.url
    } catch (error) {
      fail(error instanceof Error ? error.message : "Could not upload that image.")
    }
  }
  if (formData.get("remove_image") === "on") imageUrl = null

  if (id) {
    await getDbPool().query(
      `UPDATE crossfriend.announcements
          SET title = $2, body = $3, image_url = $4, theme = $5,
              cta_label = $6, cta_url = $7, starts_at = $8::timestamptz,
              ends_at = $9::timestamptz, updated_at = NOW()
        WHERE id = $1`,
      [id, title, body, imageUrl, theme, ctaLabel || null, ctaUrl, startsAt, endsAt]
    )
  } else {
    await getDbPool().query(
      `INSERT INTO crossfriend.announcements
         (title, body, image_url, theme, cta_label, cta_url, starts_at, ends_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9)`,
      [title, body, imageUrl, theme, ctaLabel || null, ctaUrl, startsAt, endsAt, userId]
    )
  }

  revalidatePath("/announcements")
}

/**
 * The one switch that decides whether customers see it.
 *
 * Publishing another announcement retires the current one rather than stacking. There is a single
 * banner slot on the site, and two "live" announcements would mean the storefront quietly picking a
 * winner — a decision better made here, visibly, by the person pressing the button.
 */
export async function setPublished(formData: FormData): Promise<void> {
  await requireUser()
  const id = str(formData, "id")
  const publish = formData.get("publish") === "on"
  if (!id) fail("Missing announcement.")

  const client = await getDbPool().connect()
  try {
    await client.query("BEGIN")
    if (publish) {
      await client.query(
        `UPDATE crossfriend.announcements SET is_published = FALSE, updated_at = NOW()
          WHERE is_published AND id <> $1`,
        [id]
      )
    }
    await client.query(
      `UPDATE crossfriend.announcements SET is_published = $2, updated_at = NOW() WHERE id = $1`,
      [id, publish]
    )
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  revalidatePath("/announcements")
}

export async function deleteAnnouncement(formData: FormData): Promise<void> {
  await requireUser()
  const id = str(formData, "id")
  if (!id) fail("Missing announcement.")

  // A hard delete, unlike the team board. Nobody replies to an announcement, so removing one leaves
  // nothing dangling — and keeping expired marketing copy forever is clutter, not history.
  await getDbPool().query(`DELETE FROM crossfriend.announcements WHERE id = $1`, [id])
  revalidatePath("/announcements")
}
