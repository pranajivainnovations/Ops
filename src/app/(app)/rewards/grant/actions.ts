"use server"

import { revalidatePath } from "next/cache"

import { getCurrentSession } from "@/lib/auth"

/**
 * Giving a customer credit by hand.
 *
 * ── Why this is separate from every other reward action ────────────────────────────────────────
 * Everything else pays because a rule said so. This pays because a person decided — an apology for a
 * late cake, a goodwill gesture, a customer who should have had a bonus and did not. Those cases are
 * real and unpredictable, and a system with no path for them grows one anyway, badly, in somebody's
 * database client at eleven at night.
 *
 * ── Why the reason is not optional ─────────────────────────────────────────────────────────────
 * Every other entry in the ledger can be explained by replaying a rule. This one can only be
 * explained by the person who made it. A quarter from now, "₹500 to this customer" with nothing
 * beside it is indistinguishable from fraud — so the backend refuses it without a reason and without
 * a named ops user, and this form cannot get around that.
 *
 * Only async functions are exported from this file: a plain constant exported from a "use server"
 * module becomes a server-action reference, which type-checks, builds, and then fails at render.
 */

export interface GrantState {
  ok: boolean
  error: string | null
  message: string | null
}

export async function grantCredit(_prev: GrantState, formData: FormData): Promise<GrantState> {
  const session = await getCurrentSession()
  if (!session?.userId) {
    return { ok: false, error: "Your session expired. Please sign in again.", message: null }
  }

  const url = process.env.MEDUSA_BACKEND_URL?.replace(/\/$/, "")
  const key = process.env.OPS_SERVICE_KEY
  if (!url || !key) {
    return { ok: false, error: "The backend is not configured on this server.", message: null }
  }

  const mobile = String(formData.get("mobile") ?? "").trim()
  const rupees = Number(String(formData.get("amount") ?? "").trim())
  const reason = String(formData.get("reason") ?? "").trim()
  const expiryRaw = String(formData.get("expiryDays") ?? "").trim()
  const brand = String(formData.get("brand") ?? "crossfriend")

  if (!mobile) return { ok: false, error: "Whose wallet? Enter their mobile number.", message: null }
  if (!Number.isFinite(rupees) || rupees <= 0) {
    return { ok: false, error: "Enter an amount in rupees.", message: null }
  }
  if (!reason) {
    return { ok: false, error: "A reason is required — it is the only record of why this was given.", message: null }
  }

  try {
    const res = await fetch(`${url}/ops/wallet/grant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-service-key": key },
      cache: "no-store",
      body: JSON.stringify({
        mobile,
        brand,
        /* Rupees on the screen, paise on the wire — nothing downstream ever sees a fraction. */
        amountPaise: Math.round(rupees * 100),
        reason,
        expiryDays: expiryRaw ? Number(expiryRaw) : null,
        opsUserId: session.userId,
      }),
    })

    const data = (await res.json().catch(() => ({}))) as { error?: string; customerId?: string }

    if (!res.ok) {
      return { ok: false, error: data.error ?? `The backend answered ${res.status}.`, message: null }
    }

    revalidatePath("/rewards/grant")
    revalidatePath("/rewards")

    return {
      ok: true,
      error: null,
      message: `₹${rupees.toLocaleString("en-IN")} is in their wallet now. They will see it as "Credit from our team".`,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The backend is unreachable.",
      message: null,
    }
  }
}
