"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth"
import { getDbPool } from "@/lib/db"

import { TASK_BY_KEY } from "./checklist"
import { FLOW_LIMITS } from "./data"

function fail(message: string): never {
  redirect(`/messaging?error=${encodeURIComponent(message)}`)
}

function str(formData: FormData, key: string): string {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function int(formData: FormData, key: string, bounds: { min: number; max: number }, label: string): number {
  const value = Number(str(formData, key))
  if (!Number.isInteger(value) || value < bounds.min || value > bounds.max) {
    fail(`${label} must be a whole number between ${bounds.min} and ${bounds.max}.`)
  }
  return value
}

/**
 * A DLT sender header is 3–11 characters, letters and digits only.
 *
 * TRAI issues these in a fixed shape and MSG91 rejects anything else at send time — which surfaces
 * as customers not receiving their OTP rather than as an error anyone sees. Validating the shape
 * here turns a silent delivery failure into a form error.
 */
const HEADER_PATTERN = /^[A-Za-z0-9]{3,11}$/

export async function saveTemplate(formData: FormData) {
  const session = await getCurrentSession()

  const id = str(formData, "id")
  const label = str(formData, "label")
  const senderHeader = str(formData, "sender_header").toUpperCase()
  const dltTemplateId = str(formData, "dlt_template_id")
  const providerTemplateId = str(formData, "provider_template_id")
  const bodyPreview = str(formData, "body_preview")
  const isActive = formData.get("is_active") === "on"

  if (!label) fail("Give the template a name so the team can tell them apart.")
  if (!HEADER_PATTERN.test(senderHeader)) {
    fail("Sender header must be 3–11 letters or digits, exactly as DLT approved it.")
  }
  if (!dltTemplateId) fail("The DLT template ID is required.")

  /**
   * The OTP placeholder is checked against the variable name the backend actually sends.
   *
   * MSG91 maps flow variables by name and does not error on a mismatch — it substitutes an empty
   * string and delivers "Your verification code is ." to the customer. That failure is invisible
   * from every dashboard, so the check belongs at the point the template is registered.
   */
  if (bodyPreview && !bodyPreview.includes("##otp##") && !bodyPreview.toLowerCase().includes("{{otp}}")) {
    fail(
      "The message body must contain the OTP placeholder — the backend sends the variable named 'otp'. Use ##otp## as registered with DLT."
    )
  }

  const db = getDbPool()

  try {
    if (id) {
      await db.query(
        `UPDATE crossfriend.sms_templates
            SET label = $2,
                sender_header = $3,
                dlt_template_id = $4,
                provider_template_id = $5,
                body_preview = $6,
                is_active = $7,
                updated_by = $8,
                updated_at = NOW()
          WHERE id = $1`,
        [id, label, senderHeader, dltTemplateId, providerTemplateId, bodyPreview, isActive, session?.userId ?? null]
      )
    } else {
      await db.query(
        `INSERT INTO crossfriend.sms_templates
           (label, sender_header, dlt_template_id, provider_template_id, body_preview, is_active, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [label, senderHeader, dltTemplateId, providerTemplateId, bodyPreview, isActive, session?.userId ?? null]
      )
    }
  } catch (err) {
    // The unique index on dlt_template_id is the likely cause, and "duplicate key value violates…"
    // is not something an operator should have to read.
    if (String(err).includes("sms_templates_dlt_template_id_key")) {
      fail(`A template with DLT ID ${dltTemplateId} already exists.`)
    }
    throw err
  }

  revalidatePath("/messaging")
  redirect("/messaging?saved=1")
}

export async function deleteTemplate(formData: FormData) {
  const id = str(formData, "id")
  if (!id) fail("No template selected.")

  const db = getDbPool()
  try {
    await db.query(`DELETE FROM crossfriend.sms_templates WHERE id = $1`, [id])
  } catch (err) {
    // ON DELETE RESTRICT fires when a flow still points here. That is the intended outcome —
    // deleting it would silently break customer sign-in — so explain rather than force it.
    if (String(err).includes("violates foreign key constraint")) {
      fail("That template is still assigned to a flow. Point the flow at another template first.")
    }
    throw err
  }

  revalidatePath("/messaging")
  redirect("/messaging?saved=1")
}

/**
 * Saves one flow's routing and OTP policy.
 *
 * Enabling a flow requires a template that can actually send. The database cannot express that
 * rule — is_enabled and template_id are independent columns — so it is enforced here, where the
 * operator can be told why. Without it, switching a flow on with no template produces a sign-in
 * page that looks live and sends nothing.
 */
export async function saveFlow(formData: FormData) {
  const session = await getCurrentSession()

  const flowKey = str(formData, "flow_key")
  if (!flowKey) fail("No flow selected.")

  const templateId = str(formData, "template_id")
  const isEnabled = formData.get("is_enabled") === "on"

  const otpLength = int(formData, "otp_length", FLOW_LIMITS.otpLength, "Code length")
  const otpTtlSeconds = int(formData, "otp_ttl_seconds", FLOW_LIMITS.otpTtlSeconds, "Code validity")
  const maxAttempts = int(formData, "max_attempts", FLOW_LIMITS.maxAttempts, "Maximum attempts")
  const resendCooldownSeconds = int(
    formData,
    "resend_cooldown_seconds",
    FLOW_LIMITS.resendCooldownSeconds,
    "Resend cooldown"
  )
  const dailySendLimit = int(formData, "daily_send_limit", FLOW_LIMITS.dailySendLimit, "Daily limit per number")

  const db = getDbPool()

  if (isEnabled) {
    if (!templateId) fail("Assign an SMS template before switching this flow on.")

    const check = await db.query(
      `SELECT is_active, provider_template_id FROM crossfriend.sms_templates WHERE id = $1`,
      [templateId]
    )
    const template = check.rows[0]
    if (!template) fail("That template no longer exists.")
    if (template.is_active !== true) {
      fail("That template is inactive. Activate it, or choose another, before switching the flow on.")
    }
    if (!String(template.provider_template_id ?? "").trim()) {
      fail("That template has no MSG91 template ID, so nothing can be sent through it yet.")
    }
  }

  await db.query(
    `UPDATE crossfriend.message_flows
        SET template_id = $2,
            otp_length = $3,
            otp_ttl_seconds = $4,
            max_attempts = $5,
            resend_cooldown_seconds = $6,
            daily_send_limit = $7,
            is_enabled = $8,
            updated_by = $9,
            updated_at = NOW()
      WHERE flow_key = $1`,
    [
      flowKey,
      templateId || null,
      otpLength,
      otpTtlSeconds,
      maxAttempts,
      resendCooldownSeconds,
      dailySendLimit,
      isEnabled,
      session?.userId ?? null,
    ]
  )

  revalidatePath("/messaging")
  redirect("/messaging?saved=1")
}

/**
 * Ticks or unticks one manual rollout step, and saves its note.
 *
 * Manual steps only. An auto step has no checkbox to submit and is rejected here as well, so a
 * crafted request cannot write a state the page would then display as if it had been measured —
 * which would turn the one part of the checklist that cannot lie into one that can.
 */
export async function saveChecklistTask(formData: FormData) {
  const session = await getCurrentSession()

  // Its own failure path: the shared fail() redirects to /messaging, which would bounce the
  // operator off the checklist and lose which row they were editing.
  const failHere = (message: string): never => {
    redirect(`/messaging/checklist?error=${encodeURIComponent(message)}`)
  }

  const taskKey = str(formData, "task_key")
  const task = TASK_BY_KEY[taskKey]
  if (!task) failHere("Unknown checklist item.")
  if (task.kind !== "manual") failHere("That item is derived from live state and cannot be ticked.")

  const isDone = formData.get("is_done") === "on"
  const note = str(formData, "note").slice(0, 2000)

  const db = getDbPool()
  await db.query(
    `INSERT INTO crossfriend.rollout_task_state (task_key, is_done, note, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (task_key) DO UPDATE
       SET is_done = EXCLUDED.is_done,
           note = EXCLUDED.note,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
    [taskKey, isDone, note, session?.userId ?? null]
  )

  revalidatePath("/messaging/checklist")
  redirect("/messaging/checklist?saved=1")
}
