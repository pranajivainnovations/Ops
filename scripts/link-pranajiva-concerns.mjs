/**
 * Attaches concerns to Knowledge Center entries, once the concern documents are published.
 *
 * Run: node scripts/link-pranajiva-concerns.mjs --dry-run   (prints the plan, writes nothing)
 *      node scripts/link-pranajiva-concerns.mjs             (needs SANITY_WRITE_TOKEN)
 *
 * ── Why this is a separate step rather than part of the seed scripts ───────────────────────────
 * Sanity validates a strong reference when a document is *written*, not when it is published, and
 * refuses one that points at a document which does not exist. A concern seeded as a draft lives at
 * `drafts.concern-sleep`, while a reference has to name the published id `concern-sleep` — so a
 * seed script that set the references would fail its entire transaction.
 *
 * The two alternatives are both worse. Publishing the concerns up front puts descriptions nobody
 * has read on live URLs. Marking the references `_weak` lets the write through but also lets an
 * entry publish carrying a concern chip that resolves to nothing. So concerns get reviewed and
 * published by a person, and then this runs.
 *
 * ── Why it matters more than it sounds ─────────────────────────────────────────────────────────
 * Concerns are the only axis that connects a tea to a breathing practice. Category connects a tea
 * to other teas. Without concerns, "Pairs well with this" has nothing to offer and the section is
 * ten isolated recipes — which is what the site looked like before this script existed: every tea
 * published with `concerns: 0`.
 *
 * ── Why it merges rather than replaces ─────────────────────────────────────────────────────────
 * It takes the union of what an entry already has and what the table below says it should have. A
 * script that touches published content and silently drops an editor's own tagging is a script
 * nobody runs twice.
 *
 * Concerns are resolved by slug, not by id, because the concerns created by hand in the Studio
 * carry Sanity's uuids while the seeded ones carry readable ids. Slug is the stable name.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const PROJECT_ID = "dlrwy20z"
const DATASET = "production"
const API_VERSION = "2024-10-01"

const DRY_RUN = process.argv.includes("--dry-run")

/**
 * Entry slug -> the concern slugs it should carry.
 *
 * Deliberately sparse. An entry appears here only where the connection is one a reader would
 * recognise and the entry's own copy supports — seven of the ten teas carry no concern because
 * their editorial briefs explicitly rule out the immunity and anti-inflammatory claims that
 * Cough & Cold or Immunity would imply. Tagging an entry to win a place on a concern page it has
 * not earned is how a useful taxonomy becomes a decorative one.
 */
const LINKS = {
  /* Teas & Decoctions — the three after-meal seed infusions. */
  "cumin-coriander-fennel-ccf-tea": ["digestion"],
  "ajwain-saunf-digestive-kadha": ["digestion"],
  "pudina-saunf-herbal-tea": ["digestion"],

  /* Pranayama. */
  "dirga-pranayama-three-part-breath": ["stress", "sleep"],
  "anulom-vilom-alternate-nostril-breathing": ["stress", "sleep"],
  "nadi-shodhana-with-retention": ["stress"],
  "ujjayi-pranayama-ocean-breath": ["stress", "sleep"],
  "bhramari-humming-bee-breath": ["stress", "sleep"],
  "kapalbhati-skull-shining-breath": ["energy"],
  "bhastrika-bellows-breath": ["energy"],
  "sheetali-cooling-breath": ["stress"],
  "surya-bhedana-right-nostril-breathing": ["energy"],
  "chandra-bhedana-left-nostril-breathing": ["sleep", "stress"],
}

function loadToken() {
  if (process.env.SANITY_WRITE_TOKEN) return process.env.SANITY_WRITE_TOKEN
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const text = readFileSync(join(here, "..", ".env.local"), "utf8")
    const match = text.match(/^\s*SANITY_WRITE_TOKEN\s*=\s*(.+?)\s*$/m)
    if (match) return match[1].replace(/^["']|["']$/g, "")
  } catch {
    /* No .env.local, which is normal. */
  }
  return null
}

const token = loadToken()
if (!token) {
  console.error(`No token. Add SANITY_WRITE_TOKEN to crossfriend-ops/.env.local.`)
  process.exit(1)
}

async function query(groq) {
  const res = await fetch(
    `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}?query=${encodeURIComponent(groq)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const body = await res.json()
  if (!res.ok) {
    console.error(`Query failed (${res.status}):`, JSON.stringify(body))
    process.exit(1)
  }
  return body.result
}

async function main() {
  /* Published concerns only. A draft cannot be referenced, which is the whole reason for this
     script, so a concern still in draft is reported and skipped rather than silently dropped. */
  const concerns = await query(
    `*[_type == "concern" && !(_id in path("drafts.**")) && defined(slug.current)]{_id, title, "slug": slug.current}`
  )
  const bySlug = new Map(concerns.map((c) => [c.slug, c]))

  console.log(`Published concerns available: ${concerns.length}`)
  for (const c of concerns) console.log(`  ${c.slug.padEnd(14)} ${c.title}`)

  /* Every version of every target — a tea may exist as a published document and a draft at once,
     and patching only one of them means the other overwrites it the next time it is published. */
  const slugs = Object.keys(LINKS)
  const entries = await query(
    `*[_type in ["remedy","practice","article"] && slug.current in ${JSON.stringify(slugs)}]{
      _id, _type, title, "slug": slug.current, "has": concerns[]->slug.current
    }`
  )

  const mutations = []
  const skipped = new Set()
  const plan = []

  for (const entry of entries) {
    const wanted = LINKS[entry.slug] ?? []
    const have = (entry.has ?? []).filter(Boolean)

    const resolvable = []
    const waiting = []
    for (const slug of wanted) {
      if (bySlug.has(slug)) resolvable.push(slug)
      else {
        waiting.push(slug)
        skipped.add(slug)
      }
    }

    /* Union, so an editor's own tagging in the Studio survives a re-run. */
    const union = [...new Set([...have, ...resolvable])]
    if (union.length === have.length && union.every((s) => have.includes(s))) {
      plan.push({ entry, union, changed: false, waiting })
      continue
    }

    mutations.push({
      patch: {
        id: entry._id,
        set: {
          concerns: union.map((slug, n) => ({
            _key: `con${n}`,
            _type: "reference",
            _ref: bySlug.get(slug)._id,
          })),
        },
      },
    })
    plan.push({
      entry,
      union,
      changed: true,
      waiting,
      added: union.filter((s) => !have.includes(s)),
    })
  }

  console.log(`\nPlan:`)
  for (const p of plan) {
    const state = p.entry._id.startsWith("drafts.") ? "draft    " : "published"
    const parts = []
    if (p.changed) parts.push(`+ ${p.added.join(", ")}`)
    if (p.waiting.length) parts.push(`waiting on ${p.waiting.join(", ")}`)
    const note = parts.length ? parts.join("  ·  ") : "already correct"
    console.log(`  ${state}  ${p.entry._type.padEnd(9)} ${String(p.entry.slug).padEnd(42)} ${note}`)
  }

  const missingEntries = slugs.filter((s) => !entries.some((e) => e.slug === s))
  if (missingEntries.length) {
    console.log(`\n  Not found in the dataset (nothing to patch):`)
    for (const s of missingEntries) console.log(`    ${s}`)
  }

  if (skipped.size) {
    console.log(
      `\n  Concerns still unpublished, so references to them were skipped:\n` +
        [...skipped].map((s) => `    ${s}`).join("\n") +
        `\n  Publish them in the Studio and run this again — it is safe to re-run.`
    )
  }

  if (!mutations.length) {
    console.log(`\nNothing to change.`)
    return
  }

  if (DRY_RUN) {
    console.log(`\nDry run — ${mutations.length} patch(es) not sent.`)
    return
  }

  const res = await fetch(
    `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/mutate/${DATASET}?returnIds=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mutations }),
    }
  )
  const body = await res.json()
  if (!res.ok) {
    console.error(`Sanity refused the write (${res.status}):`)
    console.error(JSON.stringify(body, null, 2))
    process.exit(1)
  }

  console.log(`\nDone. ${(body.results ?? []).length} document(s) patched.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
