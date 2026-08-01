/**
 * Shared Postgres pool — same database as the Medusa backend and the
 * storefront's ai_studio pipeline, just this app only ever touches the
 * baker_network schema. Schema changes (new tables/columns) are still
 * authored as migrations in the Backend repo, which already has a working
 * migration runner — this app is purely a consumer.
 */

import { Pool } from "pg"

let pool: Pool | null = null

export function getDbPool(): Pool {
  if (pool) return pool

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  pool = new Pool({ connectionString, max: 5 })
  return pool
}
