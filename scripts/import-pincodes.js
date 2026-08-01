/**
 * One-time (or repeatable) bulk import of the official India Post Pincode
 * Directory into baker_network.pincode_directory, then derives the distinct
 * list of pincodes into baker_network.pincode_service_status (inserted as
 * service_enabled=false if not already present — never overwrites an
 * existing status row, so re-running this after ops has already enabled
 * areas is safe).
 *
 * Run: node scripts/import-pincodes.js "Data/pincode/Pin_Code_List.csv"
 *
 * Wipes and reloads pincode_directory each run (it's disposable reference
 * data) but is careful never to touch pincode_service_status rows that
 * already exist — that's where the actual operational decisions live.
 */
require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { parse } = require("csv-parse/sync")
const { Client } = require("pg")

const BATCH_SIZE = 1000

function toNullableFloat(v) {
  if (!v || v.trim() === "" || v.trim().toUpperCase() === "NA") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toNullableText(v) {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

function isValidPincode(v) {
  return /^\d{6}$/.test(String(v || "").trim())
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error("Usage: node scripts/import-pincodes.js <path-to-csv>")
    process.exit(1)
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error("DATABASE_URL is not set (check .env.local).")
    process.exit(1)
  }

  const absPath = path.resolve(csvPath)
  console.log(`Reading ${absPath} ...`)
  const raw = fs.readFileSync(absPath, "utf8")

  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })
  console.log(`Parsed ${records.length} rows.`)

  const rows = []
  let skipped = 0
  for (const r of records) {
    if (!isValidPincode(r.pincode)) {
      skipped++
      continue
    }
    rows.push([
      toNullableText(r.circlename),
      toNullableText(r.regionname),
      toNullableText(r.divisionname),
      toNullableText(r.officename),
      String(r.pincode).trim(),
      toNullableText(r.officetype),
      toNullableText(r.delivery),
      toNullableText(r.district),
      toNullableText(r.statename),
      toNullableFloat(r.latitude),
      toNullableFloat(r.longitude),
    ])
  }
  console.log(`${rows.length} valid rows, ${skipped} skipped (bad/missing pincode).`)

  const client = new Client({ connectionString })
  await client.connect()

  try {
    await client.query("BEGIN")

    console.log("Clearing existing pincode_directory (disposable reference data)...")
    await client.query("TRUNCATE TABLE baker_network.pincode_directory RESTART IDENTITY")

    console.log("Inserting rows in batches...")
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const values = []
      const placeholders = batch
        .map((row, bi) => {
          const base = bi * 11
          values.push(...row)
          return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11})`
        })
        .join(",")

      await client.query(
        `INSERT INTO baker_network.pincode_directory
           (circle_name, region_name, division_name, office_name, pincode,
            office_type, delivery_status, district, state_name, latitude, longitude)
         VALUES ${placeholders}`,
        values
      )
      process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`)
    }
    console.log("")

    console.log("Deriving distinct pincodes into pincode_service_status (never overwrites existing rows)...")
    const upsertResult = await client.query(`
      INSERT INTO baker_network.pincode_service_status (pincode)
      SELECT DISTINCT pincode FROM baker_network.pincode_directory
      ON CONFLICT (pincode) DO NOTHING
    `)
    console.log(`  ${upsertResult.rowCount} new pincode_service_status rows added.`)

    await client.query("COMMIT")
    console.log("Done.")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
