"use server"

import { revalidatePath } from "next/cache"
import { getDbPool } from "@/lib/db"

/**
 * Assigns a partner baker to an "Order via CrossFriend" order — the storefront creates these with
 * `needsBakerAssignment: true` and no bakerId when the customer let CrossFriend pick instead of
 * choosing a specific partner. This is today's manual version of that matching step; when automated
 * matching gets built later, it plugs in right here instead of a human picking from this queue.
 *
 * Merges into the existing line_item.metadata rather than overwriting it, so nothing else stored
 * there (design details, price breakdown, etc.) gets clobbered.
 */
export async function assignBaker(
  lineItemId: string,
  bakerId: string
): Promise<{ error: string } | { success: true }> {
  if (!lineItemId || !bakerId) {
    return { error: "Missing line item or baker." }
  }

  const db = getDbPool()
  try {
    await db.query(
      `UPDATE line_item
       SET metadata = metadata || jsonb_build_object(
         'bakerId', $1::text,
         'needsBakerAssignment', false,
         'assignedAt', now()::text,
         'assignedBy', 'ops'
       )
       WHERE id = $2`,
      [bakerId, lineItemId]
    )
  } catch (error) {
    console.error("[baker assignment] Failed to assign baker", error)
    return { error: "Could not save this assignment. Please try again." }
  }

  revalidatePath("/bakers/assignments")
  return { success: true }
}
