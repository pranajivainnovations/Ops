"use server"

import { revalidatePath } from "next/cache"

import { getCurrentSession } from "@/lib/auth"
// A "use server" module may only EXPORT async functions, so the state shape and its empty value
// live in their own file. Importing them here is fine; re-exporting them would not be.
import { EMPTY_INVITE_STATE, type InviteState } from "./invite-types"

/**
 * Issues a baker activation invite.
 *
 * Calls the backend rather than writing the token here. That logic — hashing, revoking the previous
 * invite, refusing an already-claimed bakery — is security-sensitive and already exists; a second
 * copy in OPS would be two implementations drifting apart, and the one nobody looks at is the one
 * that goes wrong.
 *
 * The activation URL is returned through form STATE, not a redirect query parameter. A token in a
 * query string ends up in browser history, the server's access log, and any referrer header the
 * page emits — for a credential that grants control of a bakery account, that is three places too
 * many. Returned this way it lives only in the rendered response.
 *
 * There is no "show it again" path by design: only the hash is stored. If the link is lost, the
 * answer is to re-issue, which revokes the old one.
 */
export async function issueInviteAction(
  bakerId: string,
  _prev: InviteState,
  _formData: FormData
): Promise<InviteState> {
  const session = await getCurrentSession()
  if (!session) {
    return { ...EMPTY_INVITE_STATE, error: "Your session expired. Please sign in again." }
  }

  const backendUrl = process.env.MEDUSA_BACKEND_URL
  const serviceKey = process.env.OPS_SERVICE_KEY
  const portalUrl = process.env.BAKER_PORTAL_URL

  if (!backendUrl || !serviceKey || !portalUrl) {
    // Named explicitly — a generic "something went wrong" here would send someone hunting through
    // application code for what is a five-second environment fix.
    return {
      ...EMPTY_INVITE_STATE,
      error:
        "This OPS instance is missing MEDUSA_BACKEND_URL, OPS_SERVICE_KEY or BAKER_PORTAL_URL.",
    }
  }

  let res: Response
  try {
    res = await fetch(`${backendUrl}/ops/bakers/${bakerId}/activation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ops-service-key": serviceKey,
      },
      body: JSON.stringify({ opsUserId: session.userId }),
      cache: "no-store",
    })
  } catch {
    return { ...EMPTY_INVITE_STATE, error: "Couldn't reach the CrossFriend backend." }
  }

  const data = await res.json().catch(() => null)

  if (!res.ok || !data?.token) {
    return {
      ...EMPTY_INVITE_STATE,
      error: data?.error ?? "Couldn't create the invite. Please try again.",
    }
  }

  // Refresh the page's activation-state badge (Not invited -> Invited).
  revalidatePath(`/bakers/${bakerId}`)

  return {
    activationUrl: `${portalUrl.replace(/\/+$/, "")}/activate?token=${encodeURIComponent(data.token)}`,
    expiresAt: data.expiresAt ?? null,
    error: null,
  }
}
