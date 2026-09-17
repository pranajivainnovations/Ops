"use server"

import { revalidatePath } from "next/cache"

import { getCurrentSession } from "@/lib/auth"

import { assignBaker } from "../bakers/assignments/actions"

/**
 * Assign a baker to an unassigned cake, from the order it belongs to.
 *
 * The same operation as the assignment queue, reached from a different place. The queue answers
 * "what is waiting?" across every order; this answers "who should make THIS one?" while you are
 * already looking at the order, the address and what else is in it — which is the context the
 * decision actually needs, and is exactly what a queue of loose line items strips away.
 *
 * Delegates to the existing action rather than repeating the update: the metadata merge (keeping
 * design details and the price breakdown intact while flipping needsBakerAssignment) is the fiddly
 * part, and a second copy of it would drift.
 */
export async function assignBakerFromOrder(formData: FormData) {
  const lineItemId = String(formData.get("lineItemId") || "")
  const bakerId = String(formData.get("bakerId") || "")

  if (!lineItemId || !bakerId) return

  await assignBaker(lineItemId, bakerId)

  // The order moves out of "Needs a baker" and into that baker's portal on the next read — nothing
  // is copied anywhere, because order membership is derived from this metadata every time.
  revalidatePath("/orders")
  revalidatePath("/bakers/assignments")
}

/**
 * Move an order's fulfilment state from ops.
 *
 * ── Why ops can do this at all ─────────────────────────────────────────────────────────────────
 * Bakers are independent businesses, and until now only a baker could mark an order delivered.
 * Delivery is not decorative — referral rewards are owed from it — so the answer to "when does a
 * referrer get paid" was really "whenever the bakery gets round to tapping a button". Ops knows when
 * an order landed and can now say so.
 *
 * ── Why the ops user is sent with it ───────────────────────────────────────────────────────────
 * This overrides a partner's own record of their order. The backend refuses the call without a named
 * ops user, and the row keeps that name — so a baker disputing a delivery mark months later gets an
 * answer instead of a shrug.
 */
export async function setOrderStatus(formData: FormData) {
  const orderId = String(formData.get("orderId") || "")
  const bakerId = String(formData.get("bakerId") || "")
  const status = String(formData.get("status") || "")

  if (!orderId || !bakerId || !status) return

  const session = await getCurrentSession()
  if (!session?.userId) return

  const url = process.env.MEDUSA_BACKEND_URL?.replace(/\/$/, "")
  const key = process.env.OPS_SERVICE_KEY
  if (!url || !key) return

  try {
    await fetch(`${url}/ops/orders/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-service-key": key },
      cache: "no-store",
      body: JSON.stringify({ orderId, bakerId, status, opsUserId: session.userId }),
    })
  } catch {
    /* Swallowed the way the assignment action above is: the page re-reads the real state on the
       next render, so a failed call shows as "nothing changed" rather than a dead screen. */
  }

  revalidatePath("/orders")
  /* The rewards panels read from delivery dates, so a correction here changes what they show. */
  revalidatePath("/rewards")
}
