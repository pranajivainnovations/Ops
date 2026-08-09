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

  // Names the variable that is actually missing, rather than listing all three and leaving whoever
  // is on the server to check each one. Note these are compared falsy, not undefined: docker
  // compose substitutes an absent `${VAR}` with an EMPTY STRING and still sets the variable, so a
  // container can have all three "present" and none of them usable — which looks identical to this
  // check and is the common cause in a deployed instance.
  // The `||` form is kept because it is what narrows the three to non-empty strings for the rest
  // of this function; building the list separately and testing its length does not.
  if (!backendUrl || !serviceKey || !portalUrl) {
    const missing = [
      !backendUrl && "MEDUSA_BACKEND_URL",
      !serviceKey && "OPS_SERVICE_KEY",
      !portalUrl && "BAKER_PORTAL_URL",
    ].filter((name): name is string => Boolean(name))

    return {
      ...EMPTY_INVITE_STATE,
      error: `This OPS instance is missing ${missing.join(" and ")}. Set ${
        missing.length > 1 ? "them" : "it"
      } in the server's .env next to docker-compose.yml, then run: docker compose up -d`,
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
