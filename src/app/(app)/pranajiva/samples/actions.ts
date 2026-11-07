"use server"

import { revalidatePath } from "next/cache"

import { getCurrentSession } from "@/lib/auth"
import { setSampleStatus, type SampleStatus } from "@/lib/pranajiva/sample-requests"

/**
 * Moving a sample request.
 *
 * ── Why this writes the database directly when orders go through the backend ──────────────────
 * The orders screen routes its transitions through the backend because PranaJiva's status rules
 * live there, it appends the event the customer's own order page reads, it settles COD cash, and it
 * fires the SMS. A sachet has none of that: no customer-facing page, no money, no message. The only
 * rule is that whoever moved it is recorded, which an UPDATE does. A backend route here would be
 * indirection with nothing behind it.
 *
 * ── Why the result comes back instead of throwing ─────────────────────────────────────────────
 * "Your session has expired" is a sentence the operator needs to read. A thrown error is a Next.js
 * error page, which loses both the message and the screen they were working on.
 */

export interface SampleMoveResult {
  error?: string
  ok?: string
}

const VALID: SampleStatus[] = ["new", "approved", "dispatched", "rejected"]

const SAID: Record<SampleStatus, string> = {
  new: "put back in the queue",
  approved: "marked for the next batch",
  dispatched: "marked as posted",
  rejected: "declined",
}

export async function moveSampleRequest(
  id: string,
  next: string,
  note?: string
): Promise<SampleMoveResult> {
  const session = await getCurrentSession()
  if (!session?.userId) return { error: "Your session has expired. Sign in again." }

  if (!id) return { error: "Nothing to move." }

  const status = VALID.find((s) => s === next)
  if (!status) return { error: "That is not a status this screen knows." }

  /* Declining somebody's free sample without saying why leaves the next person to open the row
     with no idea what happened, and no way to answer them if they ask. */
  if (status === "rejected" && !note?.trim()) {
    return { error: "Add a short note saying why, so this is answerable later." }
  }

  try {
    await setSampleStatus(id, status, session.userId, note)
  } catch (error) {
    console.error("[pranajiva/samples] could not move request:", error)
    return { error: "That did not save. Try again, and tell someone if it keeps happening." }
  }

  revalidatePath("/pranajiva/samples")
  return { ok: `Request ${SAID[status]}.` }
}
