"use server"

import { revalidatePath } from "next/cache"

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
