"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getDbPool } from "@/lib/db"
import {
  verifyPassword,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
} from "@/lib/auth"

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const password = String(formData.get("password") || "")
  const next = String(formData.get("next") || "/bakers")

  if (!email || !password) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`)
  }

  const db = getDbPool()
  const result = await db.query(
    `SELECT id, email, password_hash, is_active FROM baker_network.ops_users WHERE email = $1`,
    [email]
  )
  const user = result.rows[0]

  if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`)
  }

  const token = await createSessionToken({ userId: user.id, email: user.email })
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  })

  await db.query(`UPDATE baker_network.ops_users SET last_login_at = NOW() WHERE id = $1`, [user.id])

  redirect(next || "/bakers")
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  redirect("/login")
}
