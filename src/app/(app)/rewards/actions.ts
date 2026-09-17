"use server"

import { revalidatePath } from "next/cache"

import { getCurrentSession } from "@/lib/auth"
import { EMPTY_SAVE_STATE, type SaveState } from "./action-types"

/**
 * Writes go to the backend, never straight to the database.
 *
 * Everything that decides whether a reward change is allowed — the guardrails, the version
 * numbering, the field catalogue, the rule that a stop is never refused — lives on the backend's
 * write path. Reaching past it to write a row here would put a second, quieter way to change money
 * settings next to the one that checks them, and the quiet one always wins eventually.
 */


type Backend = { url: string; key: string }

/* Names the one that is actually missing, so the fix is obvious from the message rather than
   requiring somebody to check both. */
function backend(): Backend | { error: string } {
  const url = process.env.MEDUSA_BACKEND_URL?.replace(/\/$/, "")
  if (!url) return { error: "MEDUSA_BACKEND_URL is not set on this server." }
  const key = process.env.OPS_SERVICE_KEY
  if (!key) return { error: "OPS_SERVICE_KEY is not set on this server." }
  return { url, key }
}

/** Reads a rupee amount from the form and returns paise, or null when the field is left blank. */
function paiseFrom(form: FormData, name: string): number | null {
  const raw = String(form.get(name) ?? "").trim()
  if (!raw) return null
  const rupees = Number(raw)
  if (!Number.isFinite(rupees)) return null
  return Math.round(rupees * 100)
}

/** Reads a percentage and returns basis points, so nothing downstream ever sees a float. */
function bpsFrom(form: FormData, name: string): number | null {
  const raw = String(form.get(name) ?? "").trim()
  if (!raw) return null
  const pct = Number(raw)
  if (!Number.isFinite(pct)) return null
  return Math.round(pct * 100)
}

function intFrom(form: FormData, name: string): number | null {
  const raw = String(form.get(name) ?? "").trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? Math.round(n) : null
}

/**
 * Saves one mechanic's configuration as a new version.
 *
 * The form posts display units — rupees and percentages, because that is what an operator thinks
 * in — and they are converted here to paise and basis points, which is what everything downstream
 * stores. Doing it at the boundary means no float ever reaches the database, and the conversion
 * exists in one place rather than in every field.
 */
export async function saveRewardConfig(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const session = await getCurrentSession()
  if (!session) {
    return { ...EMPTY_SAVE_STATE, error: "Your session expired. Please sign in again." }
  }

  const cfg = backend()
  if ("error" in cfg) return { ...EMPTY_SAVE_STATE, error: cfg.error }

  const brand = String(formData.get("brand") ?? "")
  const mechanic = String(formData.get("mechanic") ?? "")
  const pincode = String(formData.get("pincode") ?? "").trim() || null
  const note = String(formData.get("note") ?? "").trim()

  if (!note) {
    return { ...EMPTY_SAVE_STATE, error: "Add a note saying why this is changing." }
  }

  /**
   * Built per mechanic rather than by sweeping the form.
   *
   * A form can be crafted, and a key nothing reads is worse than a rejected save: it looks like a
   * control that works. The backend refuses unknown keys too — this is the same rule stated on the
   * near side so a mistake shows up as a missing field rather than a 422.
   */
  const params: Record<string, number | boolean> = {}

  if (mechanic === "economics") {
    const margin = bpsFrom(formData, "gross_margin_bps")
    const cap = bpsFrom(formData, "promo_redemption_cap_bps")
    const aov = paiseFrom(formData, "assumed_aov_paise")
    if (margin !== null) params.gross_margin_bps = margin
    if (cap !== null) params.promo_redemption_cap_bps = cap
    if (aov !== null) params.assumed_aov_paise = aov
  } else if (mechanic === "joining_cash") {
    const g1 = paiseFrom(formData, "grant_1_paise")
    const g2 = paiseFrom(formData, "grant_2_paise")
    const exp = intFrom(formData, "grant_2_expiry_days")
    const min = paiseFrom(formData, "min_order_paise")
    if (g1 !== null) params.grant_1_paise = g1
    if (g2 !== null) params.grant_2_paise = g2
    if (exp !== null) params.grant_2_expiry_days = exp
    if (min !== null) params.min_order_paise = min
    if (formData.get("prepaid_only") !== null) {
      params.prepaid_only = formData.get("prepaid_only") === "on"
    }
  } else if (mechanic === "referral") {
    const rate = bpsFrom(formData, "rate_bps")
    const cap = paiseFrom(formData, "per_order_cap_paise")
    const window = intFrom(formData, "window_orders")
    const hold = intFrom(formData, "hold_days")
    if (rate !== null) params.rate_bps = rate
    if (cap !== null) params.per_order_cap_paise = cap
    if (window !== null) params.window_orders = window
    if (hold !== null) params.hold_days = hold
  } else if (mechanic === "cashback") {
    const rate = bpsFrom(formData, "rate_bps")
    const hold = intFrom(formData, "hold_days")
    if (rate !== null) params.rate_bps = rate
    if (hold !== null) params.hold_days = hold
    if (formData.get("suppress_on_discounted_order") !== null) {
      params.suppress_on_discounted_order =
        formData.get("suppress_on_discounted_order") === "on"
    }
  }

  const startsAt = String(formData.get("startsAt") ?? "").trim() || null
  const endsAt = String(formData.get("endsAt") ?? "").trim() || null

  try {
    const res = await fetch(`${cfg.url}/ops/wallet/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-service-key": cfg.key },
      cache: "no-store",
      body: JSON.stringify({
        brand,
        pincode,
        mechanic,
        isEnabled: formData.get("isEnabled") === "on",
        startsAt,
        endsAt,
        maxGrants: intFrom(formData, "maxGrants"),
        budgetPaise: paiseFrom(formData, "budgetPaise"),
        /**
         * Sent only when the form actually carried a scope — which is brand scope on a serving
         * mechanic, and nowhere else. Undefined means "unchanged" to the backend, so a pincode
         * override save cannot alter the brand's list, and an edit from a screen without the picker
         * cannot silently widen an offer.
         *
         * getAll rather than get: the picker is a set of checkboxes sharing one name, and get()
         * would take the first ticked box and quietly drop the rest.
         */
        ...(formData.get("scopeMode")
          ? {
              scopeMode: String(formData.get("scopeMode")),
              scopePincodes: formData.getAll("scopePincodes").map(String),
            }
          : {}),
        params,
        note,
        opsUserId: session.userId ?? null,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (res.status === 422) {
      return { ok: false, error: null, blocks: data.blocks ?? [], warnings: data.warnings ?? [] }
    }
    if (!res.ok) {
      return { ...EMPTY_SAVE_STATE, error: data.error ?? `The backend answered ${res.status}.` }
    }

    revalidatePath("/rewards")
    if (pincode) revalidatePath(`/pincodes/${pincode}`)

    /* Warnings survive a successful save, because they describe what was accepted rather than why
       it was not. "Saved, and this now costs ₹40 an order" is one message, not two screens. */
    return { ok: true, error: null, blocks: [], warnings: data.warnings ?? [] }
  } catch (error) {
    return {
      ...EMPTY_SAVE_STATE,
      error: error instanceof Error ? error.message : "The backend is unreachable.",
    }
  }
}

/**
 * The global stop.
 *
 * Separate from the configuration save on purpose: it must work when that path does not, so it
 * shares none of its validation and none of its resolution.
 */
export async function setGlobalSwitch(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const session = await getCurrentSession()
  if (!session) {
    return { ...EMPTY_SAVE_STATE, error: "Your session expired. Please sign in again." }
  }

  const cfg = backend()
  if ("error" in cfg) return { ...EMPTY_SAVE_STATE, error: cfg.error }

  const reason = String(formData.get("reason") ?? "").trim()
  if (!reason) {
    return { ...EMPTY_SAVE_STATE, error: "Say why, so the trail explains itself later." }
  }

  try {
    const res = await fetch(`${cfg.url}/ops/wallet/switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-service-key": cfg.key },
      cache: "no-store",
      body: JSON.stringify({
        enabled: String(formData.get("enabled")) === "true",
        reason,
        opsUserId: session.userId ?? null,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ...EMPTY_SAVE_STATE, error: data.error ?? `The backend answered ${res.status}.` }
    }

    revalidatePath("/rewards")
    return { ok: true, error: null, blocks: [], warnings: [] }
  } catch (error) {
    return {
      ...EMPTY_SAVE_STATE,
      error: error instanceof Error ? error.message : "The backend is unreachable.",
    }
  }
}
