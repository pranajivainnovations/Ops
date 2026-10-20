"use server"

import { revalidatePath } from "next/cache"

import { getCurrentSession } from "@/lib/auth"
import { callBackend } from "@/lib/backend"

/**
 * Moving a PranaJiva order.
 *
 * ── Why this goes through the backend when the screen reads the database ──────────────────────
 * The same split every OPS screen keeps, and here it earns its keep three times over. The backend
 * holds the transition rules — PranaJiva's are its own, and shorter than CrossFriend's — it writes
 * the append-only event the customer's own order page reads, it collects the cash on a COD order in
 * the same statement that marks it delivered, and it is what fires the SMS. A raw UPDATE from here
 * would move the status and do none of the other four, leaving an order that looks delivered on this
 * screen, unpaid in the ledger, and silent to the customer.
 *
 * ── Why the message comes back instead of throwing ───────────────────────────────────────────
 * "Somebody else moved that order" is a sentence the operator needs to read, and a thrown error is
 * a Next.js error page. The backend already phrases every refusal for a person; this hands that
 * phrasing to the screen unchanged.
 */

export interface MoveResult {
  error?: string
  ok?: string
}

const LABEL: Record<string, string> = {
  out_for_delivery: "on the way",
  delivered: "delivered",
  cancelled: "cancelled",
}

export async function moveOrder(orderId: string, next: string): Promise<MoveResult> {
  const session = await getCurrentSession()
  if (!session?.userId) return { error: "Your session has expired. Sign in again." }

  if (!orderId || !next) return { error: "Nothing to move." }

  const { error } = await callBackend("/ops/orders/move", {
    orderId,
    status: next,
    opsUserId: session.userId,
  })

  if (error) return { error }

  revalidatePath("/pranajiva/orders")
  revalidatePath(`/pranajiva/orders/${orderId}`)
  /* Delivery is the moment a referral reward is owed, and cancelling is the moment it is taken
     back — both change what the rewards screens show. */
  if (next === "delivered" || next === "cancelled") revalidatePath("/rewards")

  return { ok: `Marked ${LABEL[next] ?? next}.` }
}
