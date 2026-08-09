"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getDbPool } from "@/lib/db"
import { getCurrentSession } from "@/lib/auth"

/**
 * Everything that happens to a baker between "found on Google" and "onboarded".
 *
 * Two rules hold throughout:
 *   1. Nothing here overwrites history. Contacts retire, appointments resolve, stages transition
 *      — every one of them leaves the previous row intact and readable.
 *   2. Every write records who did it. `bakers.assigned_to` says who owns the relationship;
 *      `created_by` on each row says who actually made this call, which is a different question.
 */

const KINDS = ["note", "call", "whatsapp", "email", "visit", "meeting", "other"] as const
/** Same list minus 'note' — you cannot schedule a note, only a way of reaching someone. */
const CHANNELS = ["call", "whatsapp", "email", "visit", "meeting", "other"] as const
const OUTCOMES = ["positive", "neutral", "negative", "no_response"] as const
const APPOINTMENT_STATES = ["scheduled", "completed", "cancelled", "no_show"] as const
const CONFIDENCE = ["high", "medium", "low"] as const

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  const s = typeof v === "string" ? v.trim() : ""
  return s.length ? s : null
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on"
}

/** Only lets a value through if it is one the database CHECK constraint would also accept. */
function oneOf<T extends readonly string[]>(
  formData: FormData,
  key: string,
  allowed: T
): T[number] | null {
  const v = str(formData, key)
  return v && (allowed as readonly string[]).includes(v) ? (v as T[number]) : null
}

function fail(bakerId: string, message: string): never {
  redirect(`/bakers/${bakerId}?tab=pipeline&error=${encodeURIComponent(message)}`)
}

function refresh(bakerId: string) {
  revalidatePath(`/bakers/${bakerId}`)
  revalidatePath("/bakers")
  revalidatePath("/bakers/pipeline")
}

// ---------------------------------------------------------------------------- contacts

export async function addContact(bakerId: string, formData: FormData) {
  const name = str(formData, "name")
  if (!name) fail(bakerId, "A contact needs a name.")

  const phone = str(formData, "phone")
  const whatsapp = str(formData, "whatsapp_number")
  const email = str(formData, "email")
  if (!phone && !whatsapp && !email) {
    fail(bakerId, `No way to reach ${name} — add a phone, WhatsApp number or email.`)
  }

  const session = await getCurrentSession()
  const db = getDbPool()
  const wantsPrimary = bool(formData, "is_primary")

  const client = await db.connect()
  try {
    await client.query("BEGIN")
    // One primary per baker is a partial unique index, so demote the incumbent inside the same
    // transaction rather than letting the insert fail on a constraint the user never saw.
    if (wantsPrimary) {
      await client.query(
        `UPDATE baker_network.baker_contacts SET is_primary = false, updated_at = NOW()
         WHERE baker_id = $1 AND is_primary`,
        [bakerId]
      )
    }
    await client.query(
      `INSERT INTO baker_network.baker_contacts
         (baker_id, name, role, phone, whatsapp_number, email, notes, is_primary, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        bakerId,
        name,
        str(formData, "role"),
        phone,
        whatsapp,
        email,
        str(formData, "notes"),
        wantsPrimary,
        session?.userId ?? null,
      ]
    )
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }

  refresh(bakerId)
}

export async function updateContact(bakerId: string, contactId: string, formData: FormData) {
  const name = str(formData, "name")
  if (!name) fail(bakerId, "A contact needs a name.")

  const db = getDbPool()
  await db.query(
    `UPDATE baker_network.baker_contacts
       SET name=$3, role=$4, phone=$5, whatsapp_number=$6, email=$7, notes=$8, updated_at=NOW()
     WHERE id=$2 AND baker_id=$1`,
    [
      bakerId,
      contactId,
      name,
      str(formData, "role"),
      str(formData, "phone"),
      str(formData, "whatsapp_number"),
      str(formData, "email"),
      str(formData, "notes"),
    ]
  )
  refresh(bakerId)
}

export async function setPrimaryContact(bakerId: string, contactId: string) {
  const db = getDbPool()
  const client = await db.connect()
  try {
    await client.query("BEGIN")
    await client.query(
      `UPDATE baker_network.baker_contacts SET is_primary = false, updated_at = NOW()
       WHERE baker_id = $1 AND is_primary`,
      [bakerId]
    )
    await client.query(
      `UPDATE baker_network.baker_contacts SET is_primary = true, is_active = true, updated_at = NOW()
       WHERE id = $2 AND baker_id = $1`,
      [bakerId, contactId]
    )
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
  refresh(bakerId)
}

/**
 * Retires a contact rather than deleting them. Past conversations keep pointing at the person who
 * had them — a deleted contact would silently blank the "spoke to" line on months of history.
 */
export async function setContactActive(bakerId: string, contactId: string, isActive: boolean) {
  const db = getDbPool()
  await db.query(
    `UPDATE baker_network.baker_contacts
       SET is_active = $3, is_primary = CASE WHEN $3 THEN is_primary ELSE false END, updated_at = NOW()
     WHERE id = $2 AND baker_id = $1`,
    [bakerId, contactId, isActive]
  )
  refresh(bakerId)
}

// ------------------------------------------------------------------------ interactions

export async function logInteraction(bakerId: string, formData: FormData) {
  const summary = str(formData, "summary")
  if (!summary) fail(bakerId, "Write down what was discussed — an empty entry helps nobody later.")

  const kind = oneOf(formData, "kind", KINDS) ?? "note"
  const outcome = oneOf(formData, "outcome", OUTCOMES)
  const contactId = str(formData, "contact_id")
  const occurredRaw = str(formData, "occurred_at")

  const session = await getCurrentSession()
  const db = getDbPool()

  const stageRow = await db.query(
    `SELECT status FROM baker_network.bakers WHERE id = $1`,
    [bakerId]
  )
  if (!stageRow.rows[0]) fail(bakerId, "That baker no longer exists.")
  const stageAtTime: string = stageRow.rows[0].status

  const client = await db.connect()
  try {
    await client.query("BEGIN")
    const inserted = await client.query(
      `INSERT INTO baker_network.baker_interactions
         (baker_id, kind, stage_at_time, occurred_at, summary, outcome, contact_id, created_by)
       VALUES ($1,$2,$3,COALESCE($4::timestamptz, NOW()),$5,$6,$7,$8)
       RETURNING id, occurred_at`,
      [bakerId, kind, stageAtTime, occurredRaw, summary, outcome, contactId, session?.userId ?? null]
    )

    // A standalone note is not contact. Only a real exchange resets the staleness clock, otherwise
    // "last contacted" would be defeated by someone jotting a reminder to themselves.
    if (kind !== "note") {
      await client.query(
        `UPDATE baker_network.bakers
           SET last_contacted_at = GREATEST(COALESCE(last_contacted_at, $2::timestamptz), $2::timestamptz),
               updated_at = NOW()
         WHERE id = $1`,
        [bakerId, inserted.rows[0].occurred_at]
      )
    }
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }

  refresh(bakerId)
}

// ------------------------------------------------------------------------ appointments

export async function scheduleAppointment(bakerId: string, formData: FormData) {
  const scheduledFor = str(formData, "scheduled_for")
  const purpose = str(formData, "purpose")
  if (!scheduledFor) fail(bakerId, "An appointment needs a date and time.")
  if (!purpose) fail(bakerId, "Say what the appointment is for.")

  const session = await getCurrentSession()
  const db = getDbPool()
  await db.query(
    `INSERT INTO baker_network.baker_appointments
       (baker_id, contact_id, scheduled_for, channel, purpose, location, assigned_to, created_by)
     VALUES ($1,$2,$3::timestamptz,$4,$5,$6,$7,$8)`,
    [
      bakerId,
      str(formData, "contact_id"),
      scheduledFor,
      oneOf(formData, "channel", CHANNELS) ?? "call",
      purpose,
      str(formData, "location"),
      str(formData, "assigned_to") ?? session?.userId ?? null,
      session?.userId ?? null,
    ]
  )
  refresh(bakerId)
}

/**
 * Resolving an appointment. 'completed' additionally writes the interaction describing how it went
 * and links the two, so a finished meeting can never sit in the record without a word about it.
 */
export async function resolveAppointment(bakerId: string, appointmentId: string, formData: FormData) {
  const status = oneOf(formData, "status", APPOINTMENT_STATES)
  if (!status || status === "scheduled") fail(bakerId, "Choose how the appointment ended.")

  const summary = str(formData, "summary")
  if (status === "completed" && !summary) {
    fail(bakerId, "Note what came out of the meeting before marking it done.")
  }

  const session = await getCurrentSession()
  const db = getDbPool()

  const apptRow = await db.query(
    `SELECT a.channel, a.contact_id, a.purpose, b.status AS stage
       FROM baker_network.baker_appointments a
       JOIN baker_network.bakers b ON b.id = a.baker_id
      WHERE a.id = $2 AND a.baker_id = $1`,
    [bakerId, appointmentId]
  )
  const appt = apptRow.rows[0]
  if (!appt) fail(bakerId, "That appointment no longer exists.")

  const client = await db.connect()
  try {
    await client.query("BEGIN")

    let interactionId: string | null = null
    if (summary) {
      const outcome =
        oneOf(formData, "outcome", OUTCOMES) ?? (status === "no_show" ? "no_response" : null)
      const inserted = await client.query(
        `INSERT INTO baker_network.baker_interactions
           (baker_id, kind, stage_at_time, occurred_at, summary, outcome, contact_id, created_by)
         VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7)
         RETURNING id`,
        [
          bakerId,
          appt.channel,
          appt.stage,
          summary,
          outcome,
          appt.contact_id,
          session?.userId ?? null,
        ]
      )
      interactionId = inserted.rows[0].id

      if (status === "completed") {
        await client.query(
          `UPDATE baker_network.bakers SET last_contacted_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [bakerId]
        )
      }
    }

    await client.query(
      `UPDATE baker_network.baker_appointments
         SET status = $3, outcome_interaction_id = COALESCE($4, outcome_interaction_id), updated_at = NOW()
       WHERE id = $2 AND baker_id = $1`,
      [bakerId, appointmentId, status, interactionId]
    )
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }

  refresh(bakerId)
}

export async function rescheduleAppointment(bakerId: string, appointmentId: string, formData: FormData) {
  const scheduledFor = str(formData, "scheduled_for")
  if (!scheduledFor) fail(bakerId, "Pick the new date and time.")

  const db = getDbPool()
  await db.query(
    `UPDATE baker_network.baker_appointments
       SET scheduled_for = $3::timestamptz, updated_at = NOW()
     WHERE id = $2 AND baker_id = $1 AND status = 'scheduled'`,
    [bakerId, appointmentId, scheduledFor]
  )
  refresh(bakerId)
}

// ------------------------------------------------------------------- stage & confidence

/**
 * The only place the pipeline stage should ever change. Writes the transition to history and moves
 * the baker in one transaction, so `bakers.status` and the history can never disagree.
 */
export async function changeStage(bakerId: string, formData: FormData) {
  const toStage = str(formData, "to_stage")
  if (!toStage) fail(bakerId, "Choose a stage.")

  const session = await getCurrentSession()
  const db = getDbPool()

  const current = await db.query(`SELECT status FROM baker_network.bakers WHERE id = $1`, [bakerId])
  if (!current.rows[0]) fail(bakerId, "That baker no longer exists.")
  const fromStage: string = current.rows[0].status
  if (fromStage === toStage) fail(bakerId, `Already at ${toStage}.`)

  const reason = str(formData, "reason")
  // Losing a prospect is the most useful thing in the whole table to be able to read back.
  if ((toStage === "declined" || toStage === "inactive") && !reason) {
    fail(bakerId, "Say why — a lost prospect with no reason teaches us nothing.")
  }

  const client = await db.connect()
  try {
    await client.query("BEGIN")
    await client.query(
      `UPDATE baker_network.bakers SET status = $2, status_updated_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [bakerId, toStage]
    )
    await client.query(
      `INSERT INTO baker_network.baker_stage_history (baker_id, from_stage, to_stage, reason, changed_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [bakerId, fromStage, toStage, reason, session?.userId ?? null]
    )
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }

  refresh(bakerId)
}

export async function setConfidence(bakerId: string, formData: FormData) {
  const confidence = oneOf(formData, "confidence", CONFIDENCE)
  const db = getDbPool()
  await db.query(
    `UPDATE baker_network.bakers SET confidence = $2, updated_at = NOW() WHERE id = $1`,
    [bakerId, confidence]
  )
  refresh(bakerId)
}
