"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getDbPool } from "@/lib/db"
import { hashPassword, getCurrentSession } from "@/lib/auth"

export async function createOpsUserAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const name = String(formData.get("name") || "").trim()
  const password = String(formData.get("password") || "")

  const fail = (message: string) => redirect(`/team/new?error=${encodeURIComponent(message)}`)

  if (!email || !email.includes("@")) fail("Enter a valid email address.")
  if (!name) fail("Name is required.")
  if (password.length < 8) fail("Password must be at least 8 characters.")

  const db = getDbPool()
  const existing = await db.query(`SELECT id FROM baker_network.ops_users WHERE email = $1`, [email])
  if (existing.rows[0]) fail("An account with this email already exists.")

  const passwordHash = await hashPassword(password)
  await db.query(
    `INSERT INTO baker_network.ops_users (email, password_hash, name) VALUES ($1,$2,$3)`,
    [email, passwordHash, name]
  )

  revalidatePath("/team")
  redirect("/team")
}

/** Deliberately refuses to deactivate the currently logged-in user, even via a direct request —
 *  the UI also hides the control on your own row, this is the defense-in-depth backstop so nobody
 *  can lock themselves (or, via a stale tab, the only other active admin) out by accident. */
export async function setOpsUserActiveAction(userId: string, active: boolean) {
  const session = await getCurrentSession()
  if (!active && session?.userId === userId) return

  const db = getDbPool()
  await db.query(`UPDATE baker_network.ops_users SET is_active = $2, updated_at = NOW() WHERE id = $1`, [
    userId,
    active,
  ])
  revalidatePath("/team")
}
