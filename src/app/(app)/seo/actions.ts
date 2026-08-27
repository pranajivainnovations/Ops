"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { CHECK_BY_ID } from "@/lib/seo/checks"

/**
 * Re-runs the audit and returns focused on one check.
 *
 * There is nothing to persist: every check reads the live site, so "verify" means "fetch it again
 * right now". revalidatePath drops the route's render so the next paint refetches rather than
 * replaying a cached response, and `focus` opens that row's evidence so the answer is visible
 * without a second click.
 */
export async function verifyCheck(formData: FormData) {
  const id = formData.get("id")
  if (typeof id !== "string" || !CHECK_BY_ID.has(id)) {
    redirect("/seo?error=Unknown+check")
  }

  revalidatePath("/seo")
  redirect(`/seo?focus=${encodeURIComponent(id)}#${encodeURIComponent(id)}`)
}

/** Re-runs everything. Same mechanism, no focused row. */
export async function verifyAll() {
  revalidatePath("/seo")
  redirect("/seo")
}
