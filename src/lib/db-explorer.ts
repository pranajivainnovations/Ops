/**
 * Read-only database explorer — an OPS diagnostic tool, not a database administration interface.
 *
 * Lives in OPS rather than behind a Medusa API because OPS already owns direct Postgres access
 * (see db.ts) and every other OPS page works this way. It also keeps a schema browser entirely out
 * of the customer-facing commerce backend, which is the safer boundary: there is no HTTP surface to
 * reach this, only an OPS server action behind the existing ops_session cookie.
 *
 * Four independent safety layers, in order of how much they'd have to fail for damage to occur:
 *
 *   1. A dedicated pool pinned to `default_transaction_read_only = on`. A write is refused by
 *      Postgres itself, not by our code — the strongest guarantee available, and it holds even if
 *      everything below has a bug.
 *   2. No SQL ever comes from the browser. Callers pass a schema name and a table name; anything
 *      else is impossible to express through this module's API.
 *   3. Those two identifiers are checked against information_schema before use, so nothing is ever
 *      interpolated that Postgres has not already confirmed exists as a real relation.
 *   4. Sensitive columns are masked in sample output, and every read is bounded by LIMIT.
 *
 * Extensibility: the allowlist names SCHEMAS, never tables. A table added to any allowed schema
 * becomes browsable the moment it is created, with no change here and no new page.
 */

import { Pool } from "pg"

/**
 * Schemas an OPS user may browse. Deliberately excludes pg_catalog and information_schema — those
 * expose role names, and there is no operational reason to read them from here.
 */
export const ALLOWED_SCHEMAS = [
  "public",
  "baker_network",
  "pricing",
  "constraints",
  "ai_studio",
  "research",
] as const

/** Sample rows per table. Small on purpose — this answers "what does this data look like". */
export const SAMPLE_ROW_LIMIT = 20

let readOnlyPool: Pool | null = null

/**
 * Separate from getDbPool() on purpose. Sharing a pool would mean one connection's read-only flag
 * leaking onto unrelated OPS writes, and it would mean this module's guarantee depended on nobody
 * ever resetting that flag elsewhere.
 */
function getReadOnlyPool(): Pool {
  if (readOnlyPool) return readOnlyPool

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  readOnlyPool = new Pool({
    connectionString,
    max: 3,
    // Applied by the server at connection time, so it covers every statement on every connection
    // in this pool — including any that a future refactor forgets to think about.
    options: "-c default_transaction_read_only=on",
  })
  return readOnlyPool
}

/**
 * Columns whose values are masked in sample output.
 *
 * The column still appears — knowing that `password_hash` exists is useful when debugging, seeing
 * its value never is. Matching is on name, so a new secret column added later is covered as long
 * as it is named like one.
 */
const MASKED_COLUMN_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api_key/i,
  /^salt$/i,
  /session/i,
]

/** Tables where ordinary-looking columns are still personal data. */
const MASKED_BY_TABLE: Record<string, RegExp[]> = {
  "public.customer": [/^email$/i, /^phone$/i, /^first_name$/i, /^last_name$/i],
  "public.address": [/^phone$/i, /^address_1$/i, /^address_2$/i],
  "baker_network.ops_users": [/^email$/i],
}

export function isMaskedColumn(schema: string, table: string, column: string): boolean {
  if (MASKED_COLUMN_PATTERNS.some((re) => re.test(column))) return true
  const perTable = MASKED_BY_TABLE[`${schema}.${table}`]
  return perTable ? perTable.some((re) => re.test(column)) : false
}

export interface SchemaSummary {
  schema: string
  tableCount: number
}

export interface TableSummary {
  schema: string
  table: string
  /** Planner estimate from pg_class.reltuples — never COUNT(*), which scans the whole table. */
  estimatedRows: number
  columnCount: number
}

export interface ColumnInfo {
  name: string
  dataType: string
  nullable: boolean
  default: string | null
  isPrimaryKey: boolean
  masked: boolean
}

export interface SampleData {
  columns: string[]
  rows: string[][]
  truncated: boolean
}

function assertAllowedSchema(schema: string): void {
  if (!(ALLOWED_SCHEMAS as readonly string[]).includes(schema)) {
    throw new Error(`Schema "${schema}" is not browsable`)
  }
}

/**
 * Confirms the table really exists in an allowed schema, and returns its identifiers straight from
 * the catalog rather than echoing back what the caller sent. Everything downstream interpolates
 * these catalog-sourced values, never raw input.
 */
async function resolveTable(schema: string, table: string): Promise<{ schema: string; table: string }> {
  assertAllowedSchema(schema)

  const db = getReadOnlyPool()
  const result = await db.query<{ table_schema: string; table_name: string }>(
    `SELECT table_schema, table_name
       FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2 AND table_type = 'BASE TABLE'
      LIMIT 1`,
    [schema, table]
  )

  if (!result.rows.length) {
    throw new Error(`Table "${schema}.${table}" not found`)
  }
  return { schema: result.rows[0].table_schema, table: result.rows[0].table_name }
}

/** Every browsable schema with its table count — one query, no per-schema round trip. */
export async function listSchemas(): Promise<SchemaSummary[]> {
  const db = getReadOnlyPool()
  const result = await db.query<{ table_schema: string; count: string }>(
    `SELECT table_schema, COUNT(*)::TEXT AS count
       FROM information_schema.tables
      WHERE table_schema = ANY($1) AND table_type = 'BASE TABLE'
      GROUP BY table_schema
      ORDER BY table_schema`,
    [ALLOWED_SCHEMAS as readonly string[]]
  )

  return result.rows.map((r) => ({
    schema: r.table_schema,
    tableCount: parseInt(r.count, 10),
  }))
}

/**
 * Tables in one schema, with row estimates and column counts.
 *
 * reltuples is the planner's estimate, maintained by ANALYZE. It can be stale or -1 on a
 * never-analysed table, which is why it is reported as "~" in the UI. That inaccuracy is worth it:
 * COUNT(*) across every table in `public` would scan the entire database on page load, and at
 * ~54ms per round trip to this database that is the difference between a usable page and a
 * broken one.
 */
export async function listTables(schema: string): Promise<TableSummary[]> {
  assertAllowedSchema(schema)

  const db = getReadOnlyPool()
  const result = await db.query<{ table_name: string; estimate: string; columns: string }>(
    `SELECT c.relname AS table_name,
            GREATEST(c.reltuples, 0)::BIGINT::TEXT AS estimate,
            (SELECT COUNT(*)::TEXT FROM information_schema.columns col
              WHERE col.table_schema = n.nspname AND col.table_name = c.relname) AS columns
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind = 'r'
      ORDER BY c.relname`,
    [schema]
  )

  return result.rows.map((r) => ({
    schema,
    table: r.table_name,
    estimatedRows: parseInt(r.estimate, 10),
    columnCount: parseInt(r.columns, 10),
  }))
}

/** Column metadata for one table. Cheap — catalog only, no table data is read. */
export async function describeTable(schema: string, table: string): Promise<ColumnInfo[]> {
  const t = await resolveTable(schema, table)

  const db = getReadOnlyPool()
  const result = await db.query<{
    column_name: string
    data_type: string
    is_nullable: string
    column_default: string | null
    is_pk: boolean
  }>(
    `SELECT col.column_name,
            col.data_type,
            col.is_nullable,
            col.column_default,
            COALESCE(pk.is_pk, false) AS is_pk
       FROM information_schema.columns col
       LEFT JOIN (
         SELECT a.attname, true AS is_pk
           FROM pg_index i
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = ($1 || '.' || $2)::regclass AND i.indisprimary
       ) pk ON pk.attname = col.column_name
      WHERE col.table_schema = $3 AND col.table_name = $4
      ORDER BY col.ordinal_position`,
    [quoteIdent(t.schema), quoteIdent(t.table), t.schema, t.table]
  )

  return result.rows.map((r) => ({
    name: r.column_name,
    dataType: r.data_type,
    nullable: r.is_nullable === "YES",
    default: r.column_default,
    isPrimaryKey: r.is_pk,
    masked: isMaskedColumn(t.schema, t.table, r.column_name),
  }))
}

/**
 * A bounded sample of rows. Loaded on demand when a table is opened — never as part of listing
 * schemas or tables, so opening the explorer costs two catalog queries and reads no table data
 * at all.
 *
 * Values are stringified here rather than in the UI so that masking is applied at the point the
 * data leaves the database layer. A masked column cannot reach a React component at all.
 */
export async function sampleTable(
  schema: string,
  table: string,
  limit: number = SAMPLE_ROW_LIMIT
): Promise<SampleData> {
  const t = await resolveTable(schema, table)
  const columns = await describeTable(t.schema, t.table)

  // Bounded regardless of what a caller passes.
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || SAMPLE_ROW_LIMIT, 1), SAMPLE_ROW_LIMIT)

  const db = getReadOnlyPool()
  // Identifiers come from the catalog (resolveTable), not from the caller, and are quoted. The
  // limit is a bound parameter. There is no path for caller input to reach this string.
  const result = await db.query(
    `SELECT * FROM ${quoteIdent(t.schema)}.${quoteIdent(t.table)} LIMIT $1`,
    [safeLimit]
  )

  const names = columns.map((c) => c.name)
  const maskedSet = new Set(columns.filter((c) => c.masked).map((c) => c.name))

  const rows = result.rows.map((row: Record<string, unknown>) =>
    names.map((name) => (maskedSet.has(name) ? "••••••" : formatValue(row[name])))
  )

  return { columns: names, rows, truncated: rows.length === safeLimit }
}

/** Double-quote an SQL identifier, escaping any embedded quotes. */
function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

/** Render a value for a table cell — compact, never throwing on exotic types. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL"
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return `\\x${value.toString("hex").slice(0, 32)}…`
  if (typeof value === "object") {
    const json = JSON.stringify(value)
    return json.length > 200 ? `${json.slice(0, 200)}…` : json
  }
  const text = String(value)
  return text.length > 200 ? `${text.slice(0, 200)}…` : text
}
