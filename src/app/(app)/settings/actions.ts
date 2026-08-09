"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getDbPool } from "@/lib/db"
import { getCurrentSession } from "@/lib/auth"
import { FIELD_BY_KEY, SETTING_KEYS, validateSetting } from "./fields"

/**
 * Saves every setting in one transaction.
 *
 * All-or-nothing on purpose: a partial save would leave the public site showing a mix of old and
 * new contact details with no indication which was which. If one field is invalid, nothing is
 * written and the form comes back with the reason.
 */
export async function saveSettings(formData: FormData) {
  const session = await getCurrentSession()

  const updates: { key: string; value: string }[] = []
  const errors: string[] = []

  // Iterating the whitelist, not the form: a crafted request cannot introduce a key that nothing
  // reads, and a field missing from the submission simply keeps its stored value.
  for (const key of SETTING_KEYS) {
    const raw = formData.get(key)
    if (typeof raw !== "string") continue

    const value = raw.trim()
    const field = FIELD_BY_KEY[key]
    const error = validateSetting(field, value)
    if (error) {
      errors.push(error)
      continue
    }
    updates.push({ key, value })
  }

  if (errors.length) {
    redirect(`/settings?error=${encodeURIComponent(errors.join(" "))}`)
  }

  const db = getDbPool()
  const client = await db.connect()
  try {
    await client.query("BEGIN")
    for (const { key, value } of updates) {
      await client.query(
        `INSERT INTO crossfriend.site_settings (key, value, updated_by, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [key, value, session?.userId ?? null]
      )
    }
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }

  revalidatePath("/settings")
  redirect("/settings?saved=1")
}
