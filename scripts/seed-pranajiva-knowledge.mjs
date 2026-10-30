/**
 * Seeds the Pranajiva Knowledge Center taxonomy — the sections entries are filed in, and the
 * concerns that connect them to each other.
 *
 * Run: node scripts/seed-pranajiva-knowledge.mjs            (needs SANITY_WRITE_TOKEN)
 *      node scripts/seed-pranajiva-knowledge.mjs --dry-run  (prints the plan, writes nothing)
 *
 * The token is a Sanity API token with Editor rights on project dlrwy20z, created at
 * sanity.io/manage → Pranajiva → API → Tokens. It is needed only to run this script; the storefront
 * reads the dataset without one. Put it in .env.local as SANITY_WRITE_TOKEN, or pass it inline.
 *
 * ── Why this exists rather than a note saying "create twelve categories" ───────────────────────
 * Every remedy and practice requires a Section before it can be published, so the taxonomy is the
 * gate in front of the first article rather than a tidying job after it. Twelve categories and ten
 * concerns is half an hour of clicking through the same form, and the kind of half hour where one
 * slug ends up misspelt and is then referenced by six documents.
 *
 * ── Why categories are published and concerns are not ──────────────────────────────────────────
 * A category is a neutral label — "Teas & Decoctions" asserts nothing and needs nobody's approval,
 * so these go in live and are immediately usable.
 *
 * A concern carries a description, and that description is health copy: it says what the concern
 * covers and how Ayurveda frames it, on a page about what to do when you are unwell. The copy below
 * is a serviceable first draft and it is not PranaJiva's considered wording. So concerns are written
 * as Sanity drafts — present in the Studio, editable, and invisible to the public API until someone
 * reads them and presses Publish. Nothing here puts an unreviewed health claim on the live site.
 *
 * ── Why createIfNotExists rather than createOrReplace ──────────────────────────────────────────
 * So that running this twice is safe. The second run leaves every edit made in the Studio alone
 * instead of quietly reverting it to the text in this file — which is the failure that makes people
 * distrust seed scripts and stop running them.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const PROJECT_ID = "dlrwy20z"
const DATASET = "production"
const API_VERSION = "2024-10-01"

const DRY_RUN = process.argv.includes("--dry-run")

/**
 * Sections, as the editor files things.
 *
 * Deliberately finer-grained than the three headings on the index — those come from the document
 * type (Remedies, Practices, Understanding), so a category called "Remedies" would print the same
 * word twice on every card. These are the level below that.
 *
 * `parent` is left unset on all of them. One level is enough until a section genuinely outgrows
 * itself, and the schema supports exactly one level when it does.
 */
const CATEGORIES = [
  ["teas-and-decoctions", "Teas & Decoctions", "Kadhas, herbal teas and simmered drinks."],
  ["morning-rituals", "Morning Rituals", "What to drink and do on waking, before anything else."],
  ["foods-and-kitchen", "Foods & Kitchen Remedies", "Everyday food used deliberately — what to eat, and when."],
  ["oils-and-external", "Oils & External Application", "Abhyanga, medicated oils, pastes and anything applied rather than taken."],
  ["steam-and-inhalation", "Steam & Inhalation", "Steam, nasya and anything worked through the breath."],
  ["pranayama", "Pranayama", "Breathing practices, with their counts and their cautions."],
  ["asana-and-movement", "Asana & Movement", "Postures, stretches and mobility."],
  ["meditation", "Meditation", "Sitting practices, mantra and attention."],
  ["daily-routine", "Daily Routine (Dinacharya)", "The shape of a day — waking, eating, sleeping and the order they belong in."],
  ["doshas", "Doshas & Constitution", "Vata, Pitta and Kapha, and how to read your own balance."],
  ["chakras", "Chakras", "The seven centres, what each governs, and the signs they are unsettled."],
  ["core-concepts", "Core Concepts", "Agni, Ojas, Ama, Rasa — the vocabulary the rest of this rests on."],
]

/**
 * Concerns, in the order they appear on the index.
 *
 * The order is reader-first rather than alphabetical: the complaints people actually arrive with go
 * at the front. Descriptions are a first draft — see the note at the top of this file.
 */
const CONCERNS = [
  [
    "cough-and-cold",
    "Cough & Cold",
    "🤧",
    10,
    "Seasonal coughs, blocked noses and the heaviness that comes with them. Ayurveda reads most of these as Kapha accumulating in the chest and sinuses, often with weakened Agni behind it — which is why the usual approach is warming, drying and light rather than rich or cooling. What helps is usually a combination: something warm to drink, steam to shift what has settled, and a lighter diet while it clears.",
  ],
  [
    "digestion",
    "Digestion & Bloating",
    "🌿",
    20,
    "Bloating, heaviness after eating, irregularity and the sense that food is sitting rather than moving. Ayurveda treats digestion as the centre of health rather than one system among many: Agni, the digestive fire, is what turns food into something the body can use, and most of what follows here is about tending it — the timing of meals as much as their contents.",
  ],
  [
    "sleep",
    "Sleep",
    "🌙",
    30,
    "Difficulty falling asleep, waking in the small hours, and sleep that leaves you unrested. Ayurveda usually reads disturbed sleep as Vata — movement and dryness in the nervous system — and the remedies reflect that: warmth, oil, weight, routine, and an evening that slows down rather than stops abruptly. Timing matters more here than any single ingredient.",
  ],
  [
    "energy",
    "Low Energy & Fatigue",
    "☀️",
    40,
    "Tiredness that sleep does not fix, afternoon slumps, and effort that costs more than it used to. Ayurveda looks first at digestion and at Ojas — the reserve built from food that has been properly digested — rather than at stimulation. Most of what helps here is unglamorous: eating in a way the body can actually use, and a daily rhythm it can rely on.",
  ],
  [
    "stress",
    "Stress & Anxiety",
    "🪷",
    50,
    "Restlessness, a mind that will not settle, and the physical residue of carrying both. These are read as aggravated Vata, sometimes with Pitta behind the irritability, and the practices here work on the breath and the nervous system rather than on the thoughts. Breathing practices do most of the work; what you eat and when you sleep decide whether they hold.",
  ],
  [
    "immunity",
    "Immunity",
    "🛡️",
    60,
    "Catching everything going round, slow recovery, and the run-down stretches between. Ayurveda frames resistance as Ojas and strong Agni rather than as something added from outside, so this section is mostly about building rather than fighting — which means it is the one place where consistency over weeks matters more than anything you can do today.",
  ],
  [
    "skin-and-hair",
    "Skin & Hair",
    "✨",
    70,
    "Dryness, breakouts, dullness, thinning and scalp trouble. Ayurveda reads the skin as a report on digestion and on which dosha is running high — dry and flaking tends to Vata, hot and inflamed to Pitta, congested to Kapha — so the remedies here work from the inside as often as from the outside, and the external ones are chosen to match.",
  ],
  [
    "joints",
    "Joint & Muscle Pain",
    "🦴",
    80,
    "Stiffness in the morning, aching joints, and pain that moves with the weather. Vata and Ama — the residue of incomplete digestion — are the usual reading, which is why warmth, oil and gentle movement appear here more often than rest. Severe, swollen or sudden joint pain is a reason to see a doctor rather than to start with a remedy.",
  ],
  [
    "intimate-health",
    "Intimate & Reproductive Health",
    "🤍",
    90,
    "Cycle irregularity, discomfort, libido and fertility, treated as ordinary health rather than as something to be coy about. Ayurveda approaches this through Shukra and Artava dhatu, which are built from well-digested food and sound sleep, so much of what helps is the same foundation as everything else here — with specifics layered on top.",
  ],
  [
    "metabolism",
    "Weight & Metabolism",
    "⚖️",
    100,
    "Weight that will not move, sluggishness after meals, and cravings that run the day. Ayurveda reads this as Kapha with weak Agni rather than as a question of quantity alone, so the emphasis falls on when and how you eat as much as on what — and on warmth and movement over restriction.",
  ],
]

function loadToken() {
  if (process.env.SANITY_WRITE_TOKEN) return process.env.SANITY_WRITE_TOKEN

  /* Read .env.local directly rather than pulling in dotenv — this is the only variable needed and
     the file sits next to the script. */
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

function buildMutations() {
  const mutations = []

  for (const [slug, title, description] of CATEGORIES) {
    mutations.push({
      createIfNotExists: {
        _id: `category-${slug}`,
        _type: "category",
        title,
        description,
        slug: { _type: "slug", current: slug },
      },
    })
  }

  for (const [slug, title, icon, order, description] of CONCERNS) {
    mutations.push({
      createIfNotExists: {
        /* The drafts. prefix is what keeps these out of the public API until someone publishes
           them. It is Sanity's own convention, not a flag of ours. */
        _id: `drafts.concern-${slug}`,
        _type: "concern",
        title,
        icon,
        order,
        description,
        slug: { _type: "slug", current: slug },
      },
    })
  }

  return mutations
}

async function main() {
  const mutations = buildMutations()

  console.log(
    `Pranajiva Knowledge Center taxonomy\n` +
      `  project ${PROJECT_ID} / ${DATASET}\n` +
      `  ${CATEGORIES.length} categories  (published, usable immediately)\n` +
      `  ${CONCERNS.length} concerns    (drafts — review the wording, then publish)\n`
  )

  if (DRY_RUN) {
    for (const m of mutations) {
      const doc = m.createIfNotExists
      console.log(`  would create  ${doc._id.padEnd(34)} ${doc.title}`)
    }
    console.log(`\nDry run — nothing was written.`)
    return
  }

  const token = loadToken()
  if (!token) {
    console.error(
      `No token.\n\n` +
        `Create one at sanity.io/manage → Pranajiva → API → Tokens (Editor rights), then either\n` +
        `add SANITY_WRITE_TOKEN=... to crossfriend-ops/.env.local, or run:\n\n` +
        `  SANITY_WRITE_TOKEN=sk... node scripts/seed-pranajiva-knowledge.mjs\n`
    )
    process.exit(1)
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

  /* `results` reports every document touched; createIfNotExists on an existing id is a no-op and
     comes back as unchanged, which is what makes the second run readable rather than alarming. */
  const created = (body.results ?? []).filter((r) => r.operation === "create").length
  const left = (body.results ?? []).length - created

  console.log(`Done.  ${created} created, ${left} already existed and were left untouched.`)
  console.log(
    `\nNext: open OPS → Pranajiva → Knowledge, read the ten Concern drafts, and publish the ones\n` +
      `whose wording you are happy with. Nothing appears on pranajiva.in until you do.`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
