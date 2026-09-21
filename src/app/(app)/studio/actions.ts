"use server"

import { revalidatePath } from "next/cache"

import { getCurrentSession } from "@/lib/auth"

/**
 * Giving a customer more Studio generations.
 *
 * ── Why this is a conversation and not a price ─────────────────────────────────────────────────
 * The spec originally charged ₹10 once the free allowance was gone. That is parked until there is a
 * decision about how a pack is actually sold, and what stands in for it is this: when somebody runs
 * out, ops can see it and top them up after talking to them.
 *
 * It does not scale, and for now that is the point. The customer who has used all ten generations is
 * either the best prospect on the platform or the most expensive visitor on it, and a phone call is
 * the only thing that tells you which.
 *
 * ── Why the reason is required ─────────────────────────────────────────────────────────────────
 * Every other allowance in the system can be explained by replaying a rule: the config said ten, so
 * they got ten. This one can only be explained by the person who gave it. The backend and the
 * database both refuse it without a reason and a named ops user, and this form cannot get around
 * that.
 *
 * Only async functions are exported from this file: a plain constant exported from a "use server"
 * module becomes a server-action reference, which type-checks, builds, and then fails at render.
 */

export interface StudioGrantState {
  ok: boolean
  error: string | null
  message: string | null
}

export async function grantStudioGenerations(
  _prev: StudioGrantState,
  formData: FormData
): Promise<StudioGrantState> {
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
  const amount = Number(String(formData.get("amount") ?? "").trim())
  const reason = String(formData.get("reason") ?? "").trim()

  if (!mobile) {
    return { ok: false, error: "Whose account? Enter their mobile number.", message: null }
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "How many generations? Enter a whole number.", message: null }
  }
  if (reason.length < 3) {
    return {
      ok: false,
      error: "A reason is required — it is the only record of why these were given.",
      message: null,
    }
  }

  try {
    const res = await fetch(`${url}/ops/ai-studio/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-service-key": key },
      cache: "no-store",
      body: JSON.stringify({
        mobile,
        amount: Math.round(amount),
        reason,
        opsUserId: session.userId,
      }),
    })

    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      allowance?: { remaining: number; total: number }
    }

    if (!res.ok) {
      return { ok: false, error: data.error ?? `The backend answered ${res.status}.`, message: null }
    }

    revalidatePath("/studio")

    const remaining = data.allowance?.remaining
    return {
      ok: true,
      error: null,
      message:
        remaining === undefined
          ? `${amount} more generations added.`
          : `${amount} added — they have ${remaining} to use now. It takes effect on their next design.`,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The backend is unreachable.",
      message: null,
    }
  }
}
