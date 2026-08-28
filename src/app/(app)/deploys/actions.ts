"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

/**
 * Re-probes every service.
 *
 * Nothing is stored, so "re-check" simply means dropping this route's render and letting the next
 * paint ask all four again. The page is already force-dynamic; revalidatePath is what stops a
 * cached RSC payload being replayed instead.
 */
export async function recheck() {
  revalidatePath("/deploys")
  redirect("/deploys")
}
