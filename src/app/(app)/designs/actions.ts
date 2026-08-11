"use server"

import { revalidatePath } from "next/cache"
import { getDbPool } from "@/lib/db"

/**
 * Move a design in or out of the public gallery, from the ops side.
 *
 * Deliberately different from the customer-facing route
 * (/store/ai-studio/designs/:id/visibility), which scopes its UPDATE to `customer_id` so one
 * customer cannot touch another's design. This one has no such clause on purpose: the whole reason
 * the team needs it is to take down something the customer themselves published and will not remove.
 *
 * The reverse direction — putting a design back in the gallery — is allowed too. A design pulled by
 * mistake should be restorable without a database session.
 */
export async function setDesignVisibility(designId: string, isPublic: boolean) {
  const db = getDbPool()

  await db.query(
    `UPDATE ai_studio.cake_designs
        SET is_public = $1::boolean, updated_at = NOW()
      WHERE id = $2::uuid`,
    [isPublic, designId]
  )

  revalidatePath("/designs")
}
