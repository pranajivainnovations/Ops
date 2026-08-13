"use server"

import { revalidatePath } from "next/cache"

import { getCurrentSession } from "@/lib/auth"
import { callBackend } from "@/lib/backend"
import { EMPTY_RESET_STATE, type ResetState } from "./reset-types"

/**
 * Resets a bakery's portal access and/or its catalogue.
 *
 * Calls the backend rather than writing here, for the same reason issuing an invite does: deleting
 * products has to go through Medusa's own services so its hooks, events and search indexing fire,
 * and the account rules (which index frees the owner slot, what an inactive user may still do) are
 * security-sensitive enough that a second copy in OPS would be one implementation too many.
 *
 * Confirmation is by typing the bakery's name, checked here rather than only in the browser. A
 * `window.confirm` is a courtesy; this is the actual gate, and it cannot be skipped by a stale page
 * or a double submit.
 */
export async function resetBakerAction(
  bakerId: string,
  bakerName: string,
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const session = await getCurrentSession()
  if (!session) {
    return { ...EMPTY_RESET_STATE, error: "Your session expired. Please sign in again." }
  }

  const access = formData.get("access") === "on"
  const data = formData.get("data") === "on"

  if (!access && !data) {
    return { ...EMPTY_RESET_STATE, error: "Choose what to reset." }
  }

  // Compared case-insensitively and trimmed — the point is to make someone read the name and mean
  // it, not to test their typing. Anything stricter just gets worked around by copy-paste anyway.
  const typed = String(formData.get("confirm") ?? "").trim()
  if (typed.toLowerCase() !== bakerName.trim().toLowerCase()) {
    return {
      ...EMPTY_RESET_STATE,
      error: `Type the bakery's name exactly — "${bakerName}" — to confirm.`,
    }
  }

  const { data: result, error } = await callBackend<{
    access?: { usersDeactivated: number; activationsRevoked: number }
    data?: { productsDeleted: number }
  }>(`/ops/bakers/${bakerId}/reset`, { access, data, opsUserId: session.userId })

  if (error) {
    return { ...EMPTY_RESET_STATE, error }
  }

  const done: string[] = []
  if (result?.access) {
    done.push(
      `${result.access.usersDeactivated} account(s) deactivated and ${result.access.activationsRevoked} unused invite(s) revoked — this bakery can be invited again`
    )
  }
  if (result?.data) {
    done.push(`${result.data.productsDeleted} product(s) permanently deleted`)
  }

  // The activation badge is derived from whether an active baker_users row exists, so it flips from
  // "Activated" back to "Not invited" on this refresh without anything else being told about it.
  revalidatePath(`/bakers/${bakerId}`)
  revalidatePath("/bakers")

  return { ...EMPTY_RESET_STATE, done }
}
