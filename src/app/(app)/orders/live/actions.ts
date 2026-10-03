"use server"

import { revalidatePath } from "next/cache"

import { getCurrentSession } from "@/lib/auth"

/**
 * Running an order on the new pipeline.
 *
 * ── Why these go through the backend when the page reads the database ──────────────────────────
 * Same split as every other OPS screen. Reading is OPS's own business and it queries directly.
 * Writing is not: the backend holds the rules — a baker must be onboarded, an order cannot skip a
 * step, accepting needs somebody actually making it — and it writes the append-only event that the
 * CUSTOMER's confirmation page reads. A write issued from here would be a second copy of those
 * rules, and the first time the two disagreed the customer would be the one told something untrue.
 *
 * ── Why failures come back as text rather than disappearing ────────────────────────────────────
 * The older orders screen swallows them, on the reasoning that the next render shows the real state.
 * That works for a toggle and is wrong here: "assign a baker before accepting" is a sentence ops
 * needs to read, and a silent no-op looks like a broken button.
 */

type Result = { error: string | null }

async function callBackend(path: string, body: Record<string, unknown>): Promise<Result> {
  const session = await getCurrentSession()
  if (!session?.userId) return { error: "Your session has expired. Sign in again." }

  const url = process.env.MEDUSA_BACKEND_URL?.replace(/\/$/, "")
  const key = process.env.OPS_SERVICE_KEY
  if (!url || !key) return { error: "This OPS instance is not configured to reach the backend." }

  try {
    const res = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-service-key": key },
      cache: "no-store",
      body: JSON.stringify({ ...body, opsUserId: session.userId }),
    })
    const payload = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) return { error: payload.error ?? "That did not work. Please try again." }
    return { error: null }
  } catch {
    return { error: "Could not reach the backend just now." }
  }
}

export async function assignOrderToBaker(orderId: string, bakerId: string): Promise<Result> {
  if (!orderId || !bakerId) return { error: "Pick a baker first." }

  /* No itemIds: every item on the order goes to this baker, which is the normal case. The backend
     supports splitting an order between kitchens; nothing on this screen asks for it yet. */
  const result = await callBackend("/ops/orders/assign", { orderId, bakerId })

  revalidatePath("/orders/live")
  return result
}

export async function moveOrder(orderId: string, status: string): Promise<Result> {
  if (!orderId || !status) return { error: "Nothing to do." }

  const result = await callBackend("/ops/orders/move", { orderId, status })

  revalidatePath("/orders/live")
  /* Delivery is what referral rewards are owed from, so the rewards screens change with it. */
  if (status === "delivered") revalidatePath("/rewards")
  return result
}
