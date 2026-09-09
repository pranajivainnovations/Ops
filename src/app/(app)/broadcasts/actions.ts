"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth"
import { getDbPool } from "@/lib/db"
import { notifySubscribers } from "@/lib/push"
import { uploadAnnouncementImage } from "@/lib/s3"

/**
 * Sending a notification to everyone who asked for one.
 *
 * This is the most irreversible action in OPS. An announcement can be taken down, a board message
 * deleted, a price corrected — a push that has reached thirty thousand phones is simply gone, and
 * whatever it said is what it said. Everything below exists because of that: the confirmation the
 * form demands, the record written before the first send rather than after the last, and the refusal
 * to re-send a campaign that has already gone.
 */

const MAX_TITLE = 80
const MAX_BODY = 180

function fail(message: string): never {
  redirect(`/broadcasts?error=${encodeURIComponent(message)}`)
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
 * Only http(s), and only absolute or root-relative.
 *
 * A `javascript:` URL behind a notification the whole customer base is about to tap is the one
 * genuinely dangerous thing a free-text field here can produce, so it is rejected rather than hoped
 * away by the service worker.
 */
function validateUrl(value: string): string {
  if (!value) return "/"
  if (value.startsWith("/")) return value
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    fail("The link must be a full URL, or a path starting with /.")
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    fail("The link must be an http or https address.")
  }
  return parsed.toString()
}

export async function sendBroadcast(formData: FormData): Promise<void> {
  const userId = await requireUser()

  const title = str(formData, "title")
  const body = str(formData, "body")
  const url = validateUrl(str(formData, "url"))

  if (!title) fail("Give the notification a headline.")
  if (title.length > MAX_TITLE) fail(`The headline must be under ${MAX_TITLE} characters.`)
  if (!body) fail("Write the message.")
  if (body.length > MAX_BODY) fail(`The message must be under ${MAX_BODY} characters.`)

  /**
   * Typing the word rather than ticking a box.
   *
   * A checkbox beside a button is two taps that can both happen by accident, and on a phone they are
   * three millimetres apart. Typing SEND cannot be done without having read what it is for, which is
   * the only real protection available for an action with no undo.
   */
  if (str(formData, "confirm").toUpperCase() !== "SEND") {
    fail('Type SEND in the confirmation box to send this to everyone.')
  }

  let imageUrl: string | null = null
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

  /**
   * The row is written before anything is sent, as 'sending'.
   *
   * If the container dies halfway through a campaign, this is the difference between a record that
   * says "this went out, at least partly" and no record at all — and the second one leads directly
   * to somebody sending it a second time to find out. A campaign left in 'sending' is a visible
   * question rather than a silent gap.
   */
  const { rows } = await getDbPool().query<{ id: string }>(
    `INSERT INTO crossfriend.push_campaigns (title, body, url, image_url, status, created_by)
     VALUES ($1, $2, $3, $4, 'sending', $5)
     RETURNING id`,
    [title, body, url, imageUrl, userId]
  )
  const campaignId = rows[0].id

  try {
    const result = await notifySubscribers({
      title,
      body,
      url,
      image: imageUrl ?? undefined,
      /* Tagged per campaign, so two different offers both arrive, while a retry of the same one
         replaces rather than stacks. */
      tag: `cf-${campaignId.slice(0, 8)}`,
    })

    await getDbPool().query(
      `UPDATE crossfriend.push_campaigns
          SET status = 'sent', sent_at = NOW(), sent_count = $2, failed_count = $3, updated_at = NOW()
        WHERE id = $1`,
      [campaignId, result.sent, result.failed]
    )
  } catch (error) {
    console.error("[broadcast] send failed", error)
    await getDbPool().query(
      `UPDATE crossfriend.push_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1`,
      [campaignId]
    )
    fail("The send failed. Nothing further was sent — check the campaign list before retrying.")
  }

  revalidatePath("/broadcasts")
}

/**
 * Removes a campaign from the list.
 *
 * Only ever a draft or a failed one. A sent campaign is a record of something that happened to real
 * people and deleting it would leave the team unable to answer "did we already send this" — which is
 * the question this page exists to answer.
 */
export async function deleteCampaign(formData: FormData): Promise<void> {
  await requireUser()
  const id = str(formData, "id")
  if (!id) fail("Missing campaign.")

  await getDbPool().query(
    `DELETE FROM crossfriend.push_campaigns WHERE id = $1 AND status <> 'sent'`,
    [id]
  )
  revalidatePath("/broadcasts")
}
