/**
 * One-time (or repeatable) helper to create/update an ops_user account.
 * Run locally: node scripts/seed-admin.js you@crossfriend.in "your password" "Your Name"
 *
 * Deliberately a plain script, not a UI — this is the stopgap for "how do we
 * get our own first login" before there's any UI to do it from. Re-running
 * with the same email updates the password/name instead of erroring, so it
 * doubles as a password-reset tool for now.
 */
require("dotenv").config({ path: ".env.local" })
const { Client } = require("pg")
const bcrypt = require("bcryptjs")

async function main() {
  const [, , email, password, name] = process.argv

  if (!email || !password) {
    console.error('Usage: node scripts/seed-admin.js <email> <password> ["Name"]')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.")
    process.exit(1)
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error("DATABASE_URL is not set (check .env.local).")
    process.exit(1)
  }

  const client = new Client({ connectionString })
  await client.connect()

  const passwordHash = await bcrypt.hash(password, 12)

  await client.query(
    `INSERT INTO baker_network.ops_users (email, password_hash, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = COALESCE($3, baker_network.ops_users.name)`,
    [email.trim().toLowerCase(), passwordHash, name || null]
  )

  console.log(`Ops account ready for ${email}.`)
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
