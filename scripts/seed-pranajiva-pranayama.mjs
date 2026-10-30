/**
 * Seeds the Pranayama section — ten breathing practices — into the Pranajiva Knowledge Center.
 *
 * Run: node scripts/seed-pranajiva-pranayama.mjs --dry-run   (validates, writes nothing)
 *      node scripts/seed-pranajiva-pranayama.mjs             (needs SANITY_WRITE_TOKEN)
 *
 * ── Why pranayama is the right second section ──────────────────────────────────────────────────
 * Not because breathing is more important than tea, but because every entry on the site is
 * currently a remedy. The "Pairs well with this" rail prefers an entry of a *different* type, so
 * with only remedies live it can offer a reader looking at a tea nothing but more teas — which is
 * exactly the recommendation the design set out to avoid. Ten practices make that rail work for the
 * first time in both directions.
 *
 * ── What is a practice and not a remedy ────────────────────────────────────────────────────────
 * Anything the reader does rather than makes. No ingredients, no dosage, no yield; rounds, a
 * duration and a required difficulty instead. The difficulty field is required precisely because
 * the harm in this section is someone attempting Bhastrika on week one.
 *
 * ── On the safety fields in here ───────────────────────────────────────────────────────────────
 * These are not decorative. Kapalbhati and Bhastrika are forceful practices with real
 * contraindications — uncontrolled blood pressure, heart disease, hernia, ulcers, glaucoma,
 * epilepsy, pregnancy, recent abdominal surgery — and they are widely taught online with none of
 * them mentioned. The retention in Nadi Shodhana carries its own. Where a practice is genuinely
 * unsuitable for someone, `avoidIf` says so in the words that person would recognise about
 * themselves, rather than in a hedge.
 *
 * Images and product handles are left unset, as in the teas batch.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const PROJECT_ID = "dlrwy20z"
const DATASET = "production"
const API_VERSION = "2024-10-01"

const DRY_RUN = process.argv.includes("--dry-run")

/* Read off the live dataset. The sole surviving author after the duplicate was merged. */
const AUTHOR = "2b1332fa-bee2-4596-85b9-8fecc47e4e84"

/**
 * The Pranayama section, created here and published immediately.
 *
 * A category is a neutral label: "Pranayama" asserts nothing, needs nobody's review, and every
 * practice below requires one before it can be published. Publishing it is what makes the ten
 * drafts usable without a second round trip. This is the same call the teas batch made for
 * Teas & Decoctions, which the Studio already holds.
 */
const CATEGORY = {
  _id: "category-pranayama",
  _type: "category",
  title: "Pranayama",
  slug: { _type: "slug", current: "pranayama" },
  description: "Breathing practices, with their counts and their cautions.",
}

/**
 * The three concerns this section needs, as drafts.
 *
 * Same constraint as the teas batch: Sanity validates a strong reference when the document is
 * written, so a practice cannot point at a concern that exists only as a draft. These are seeded
 * unreferenced, and `link-pranajiva-concerns.mjs` attaches them to both the practices and the teas
 * once they have been read and published. That script is the one to run second.
 */
const CONCERNS = [
  {
    _id: "drafts.concern-stress",
    _type: "concern",
    title: "Stress & Anxiety",
    icon: "🪷",
    order: 50,
    slug: { _type: "slug", current: "stress" },
    description:
      "Restlessness, a mind that will not settle, and the physical residue of carrying both. Ayurveda reads these as aggravated Vata, sometimes with Pitta behind the irritability, and the practices here work on the breath and the nervous system rather than on the thoughts. Breathing does most of the work; what you eat and when you sleep decide whether it holds.",
  },
  {
    _id: "drafts.concern-sleep",
    _type: "concern",
    title: "Sleep",
    icon: "🌙",
    order: 30,
    slug: { _type: "slug", current: "sleep" },
    description:
      "Difficulty falling asleep, waking in the small hours, and sleep that leaves you unrested. Disturbed sleep is usually read as Vata — movement and dryness in the nervous system — and the remedies reflect that: warmth, oil, weight, routine, and an evening that slows down rather than stops abruptly. Timing matters more here than any single ingredient or practice.",
  },
  {
    _id: "drafts.concern-energy",
    _type: "concern",
    title: "Low Energy & Fatigue",
    icon: "☀️",
    order: 40,
    slug: { _type: "slug", current: "energy" },
    description:
      "Tiredness that sleep does not fix, afternoon slumps, and effort that costs more than it used to. Ayurveda looks first at digestion and at Ojas — the reserve built from food that has been properly digested — rather than at stimulation. Most of what helps here is unglamorous: eating in a way the body can use, and a daily rhythm it can rely on.",
  },
]

const BEST_TIME_VALUES = [
  "early-morning", "morning", "midday", "afternoon", "evening",
  "before-bed", "empty-stomach", "with-food", "after-food", "anytime",
]
const DOSHA_VALUES = ["vata", "pitta", "kapha"]
const DIFFICULTIES = ["beginner", "intermediate", "advanced"]

function step(text, duration) {
  return { text, duration }
}

function body(blocks) {
  return blocks.map(([style, text], i) => ({
    _key: `b${i}`,
    _type: "block",
    style,
    markDefs: [],
    children: [{ _key: `b${i}s0`, _type: "span", marks: [], text }],
  }))
}

/**
 * Always in the past, newest first, so the first entry here is the first on the index.
 *
 * Computed from the clock rather than hardcoded: a future `publishedAt` leaves an entry invisible
 * even after Publish, which is a confusing way for a page to go missing.
 */
const publishedAt = (i) => new Date(Date.now() - 60_000 - i * 4 * 60_000).toISOString()

const PRACTICES = [
  {
    slug: "dirga-pranayama-three-part-breath",
    title: "Dirga Pranayama (Three-Part Breath)",
    excerpt:
      "The foundation practice: breathing into the belly, the ribs and the chest in sequence. Learn this one before any of the others.",
    difficulty: "beginner",
    durationMinutes: 5,
    repetitions: "Ten to twelve breaths to begin with, building up to five minutes",
    bestTime: ["morning", "before-bed", "anytime"],
    concerns: ["concern-stress", "concern-sleep"],
    benefits: [
      "Uses the whole lung rather than the top third, which is where most adults breathe at rest",
      "Slows the breath without you having to count anything",
      "Settles the body enough that the other practices here become possible",
    ],
    doshas: [],
    steps: [
      step("Sit upright, with your back against a wall if that helps, or lie down. Rest one hand on your belly and the other on your lower ribs."),
      step("Breathe out slowly and completely through the nose, and let the belly fall under your lower hand."),
      step("Breathe in and let the belly rise first. The lower hand should move before the upper one does."),
      step("Keep drawing the same breath in, and feel the ribs widen sideways under the upper hand."),
      step("Finish by letting the upper chest fill, then breathe out in reverse — chest, ribs, belly — slowly."),
      step("Carry on for ten to twelve breaths. If anything strains, the breath is too big: make it smaller.", "About 2 minutes"),
    ],
    cautions: [
      "Light-headedness or tingling in the hands or lips means the breath is too large or too fast. Stop, breathe normally until it passes, and begin again smaller.",
      "Classical teaching is emphatic that pranayama is never practised to strain. A breath taken to absolute capacity is the wrong breath, however deep it feels.",
    ],
    avoidIf: [
      "You have a chest infection or an asthma flare-up that makes slow deep breathing uncomfortable",
    ],
    pregnancyAndChildren:
      "Widely taught in antenatal classes and generally considered safe in pregnancy, but ask your doctor or midwife first. Fine for children over about seven, as a game rather than a discipline.",
    maxDuration:
      "No limit. This is the one practice in this section that can be done every day, indefinitely, without a break.",
    body: body([
      ["h2", "Why this comes first"],
      [
        "normal",
        "Most adults at rest breathe with the top of the chest only, in short breaths, and have done for years. Every other practice in this section assumes you can already take a slow, full breath without effort — so starting anywhere else means learning a technique on top of a habit that works against it.",
      ],
      [
        "normal",
        "Dirga simply means long. There is no counting, no holding and no nostril work: the whole practice is noticing that the breath can fill the belly, then the ribs, then the chest, and that it empties in the opposite order. The two hands are the entire teaching method — they tell you what is actually moving, which is almost always less than you think.",
      ],
      ["h2", "The one rule"],
      [
        "normal",
        "Never to strain. If you finish a breath feeling like you fought for it, it was too big. This is not modesty — forcing the breath tightens the very muscles the practice is meant to release, and reliably produces the light-headedness people then take as a sign something is working.",
      ],
    ]),
    seoTitle: "Dirga Pranayama — Three-Part Breath, Step by Step",
    metaDescription:
      "Learn the three-part breath: belly, ribs and chest in sequence. Step-by-step method, how long to practise, and when not to.",
  },

  {
    slug: "anulom-vilom-alternate-nostril-breathing",
    title: "Anulom Vilom (Alternate Nostril Breathing)",
    excerpt:
      "Alternate nostril breathing without any holding of the breath — the calming, balancing practice most people mean when they say Nadi Shodhana.",
    difficulty: "beginner",
    durationMinutes: 5,
    repetitions: "Nine to twelve rounds, building up to five minutes",
    bestTime: ["early-morning", "morning", "before-bed", "empty-stomach"],
    concerns: ["concern-stress", "concern-sleep"],
    benefits: [
      "Noticeably steadies a scattered or racing mind within a few minutes",
      "Evens out breathing that has become shallow and uneven without you noticing",
      "The usual way to settle before sitting to meditate",
    ],
    doshas: ["vata", "pitta"],
    steps: [
      step("Sit upright and comfortably. Rest the left hand in your lap."),
      step("Fold the index and middle fingers of the right hand into the palm, leaving the thumb, ring and little fingers free. The thumb will work the right nostril and the ring finger the left."),
      step("Close the right nostril with the thumb and breathe out fully through the left."),
      step("Breathe in through the left nostril, slowly and without strain.", "About 4 seconds"),
      step("Close the left nostril with the ring finger, release the thumb, and breathe out through the right.", "About 4 seconds"),
      step("Breathe in through the right nostril."),
      step("Close the right, release the left, and breathe out through the left. That is one complete round."),
      step("Carry on for nine to twelve rounds, always finishing on an exhale through the left nostril.", "About 3 minutes"),
    ],
    cautions: [
      "No holding of the breath in this practice. If you find yourself pausing at the top of the inhale, you have drifted into Nadi Shodhana, which carries its own cautions.",
      "Never force air through a blocked nostril. If one side will not pass air, practise something else today.",
      "Keep the fingers light on the nose. Pressing hard is a common habit and it makes the breath laboured.",
      "Stop if you feel light-headed, and breathe normally until it passes.",
    ],
    avoidIf: [
      "Your nose is completely blocked by a cold, sinus infection or allergy",
      "You have had nasal or sinus surgery recently, or have a significantly deviated septum that makes one side unusable",
    ],
    pregnancyAndChildren:
      "Generally considered safe in pregnancy because there is no retention and no force, but ask your doctor first. Suitable for children over about eight.",
    maxDuration:
      "Can be practised daily without a limit. Build the length gradually rather than in jumps.",
    body: body([
      ["h2", "Anulom Vilom or Nadi Shodhana?"],
      [
        "normal",
        "The two names are used interchangeably almost everywhere, and they are not the same practice. Anulom Vilom is alternate nostril breathing with no retention: in through one side, out through the other, continuously. Nadi Shodhana adds kumbhaka — holding the breath in — and that single addition is what brings the blood-pressure and heart cautions with it.",
      ],
      [
        "normal",
        "Which matters, because the version taught in most videos is this one, under the other name. If you have been told to hold the breath, you are being taught the more advanced practice, and it is worth knowing that rather than discovering it.",
      ],
      ["h2", "What the tradition says it is doing"],
      [
        "normal",
        "Ayurveda and yoga describe the breath as running through nadis, with the left and right nostrils associated with the chandra and surya channels — cooling and heating, receptive and active. Alternating them is held to balance the two. That is the traditional account, and it is a good description of what the practice feels like; it is not a physiological mechanism that has been demonstrated.",
      ],
      [
        "normal",
        "What is uncontroversial is simpler. Breathing this way is slow, it is regular, and it requires just enough attention that you cannot do it and continue an anxious train of thought at the same time.",
      ],
    ]),
    seoTitle: "Anulom Vilom — Alternate Nostril Breathing, Step by Step",
    metaDescription:
      "How to practise Anulom Vilom correctly, how it differs from Nadi Shodhana, how many rounds to do, and who should avoid it.",
  },

  {
    slug: "nadi-shodhana-with-retention",
    title: "Nadi Shodhana (Alternate Nostril with Retention)",
    excerpt:
      "Anulom Vilom with the breath held in — a deeper practice, and the point at which alternate nostril breathing acquires real contraindications.",
    difficulty: "intermediate",
    durationMinutes: 8,
    repetitions: "Start at six rounds with an even count; add rounds before you add length",
    bestTime: ["early-morning", "empty-stomach"],
    concerns: ["concern-stress"],
    benefits: [
      "A markedly deeper settling than the same practice without retention",
      "Builds a slow, even breath you can keep hold of under stress",
      "The traditional preparation for longer sitting practice",
    ],
    doshas: ["vata", "pitta"],
    steps: [
      step("Sit upright. Settle into Anulom Vilom for a minute or two first, with no holding at all.", "1–2 minutes"),
      step("Close the right nostril with the thumb and breathe in through the left to a count of four.", "4 counts"),
      step("Close both nostrils and hold the breath in, comfortably, for the same count of four.", "4 counts"),
      step("Release the thumb and breathe out through the right nostril to a count of four.", "4 counts"),
      step("Breathe in through the right to four, hold for four, and breathe out through the left to four. That is one round.", "12 counts"),
      step("Six rounds to begin with. Return to normal breathing the moment the hold stops being comfortable.", "About 3 minutes"),
    ],
    cautions: [
      "The hold must stay comfortable. If the exhale afterwards comes out in a rush, the hold was too long — shorten it rather than pushing through.",
      "Begin with an even count. The classical 1:4:2 ratio is an advanced practice and is not something to work towards on your own.",
      "Never hold the breath out at this stage. Retention after the exhale is a separate practice with separate cautions.",
      "Stop at any light-headedness, chest tightness, or a pounding in the ears or head.",
      "Learn this from a teacher if you can. Retention is the point in pranayama where written instructions stop being sufficient.",
    ],
    avoidIf: [
      "You have high blood pressure that is not well controlled",
      "You have heart disease, or have had a heart attack or stroke",
      "You have glaucoma or any condition raising pressure inside the eye",
      "You have epilepsy",
      "You are pregnant — breath retention is avoided throughout pregnancy",
      "You have a detached retina or have had recent eye surgery",
    ],
    pregnancyAndChildren:
      "Not for use in pregnancy: breath retention is avoided throughout, and Anulom Vilom without retention is the practice to use instead. Not for children — retention is not taught to them.",
    maxDuration:
      "Practise daily if it suits you, but do not extend the retention week on week without a teacher watching. Growth here is in steadiness, not in length.",
    body: body([
      ["h2", "What the hold changes"],
      [
        "normal",
        "Holding the breath in raises pressure inside the chest, and that has consequences that reach further than the lungs: it alters the return of blood to the heart, it raises pressure inside the skull and the eye, and it briefly affects blood pressure. For a healthy person practising gently this is unremarkable. For someone with uncontrolled hypertension, heart disease, glaucoma or epilepsy it is the reason this practice is on their avoid list and the unretained version is not.",
      ],
      [
        "normal",
        "This is also why the distinction from Anulom Vilom is worth being pedantic about. Nobody is harmed by the version without retention. The version with it is a genuine practice with genuine limits, and the people most likely to meet those limits are the ones least likely to have been told.",
      ],
      ["h2", "Why the count starts even"],
      [
        "normal",
        "The ratio everyone quotes is 1:4:2 — inhale four, hold sixteen, exhale eight. That belongs to a traditional progression under supervision, often after years. Starting even, at 4:4:4, gives you the shape of the practice with none of the risk, and almost everyone who hurries past it ends up with a strained, gasping exhale that undoes the whole point.",
      ],
    ]),
    seoTitle: "Nadi Shodhana with Retention — Method & Cautions",
    metaDescription:
      "Alternate nostril breathing with kumbhaka: the counts, how to build it safely, and the conditions that rule it out entirely.",
  },

  {
    slug: "ujjayi-pranayama-ocean-breath",
    title: "Ujjayi (Ocean Breath)",
    excerpt:
      "A soft narrowing at the throat that gives the breath an audible, surf-like sound — the breath used throughout a yoga practice.",
    difficulty: "beginner",
    durationMinutes: 5,
    repetitions: "Twelve breaths to learn it; then use it through whatever else you are doing",
    bestTime: ["morning", "anytime"],
    concerns: ["concern-stress", "concern-sleep"],
    benefits: [
      "Lengthens the breath without you having to count it",
      "Gives attention something to rest on, which is why it holds through movement",
      "Makes it immediately audible when your breathing becomes ragged",
    ],
    doshas: ["vata"],
    steps: [
      step("Sit upright and breathe normally through the nose for a few breaths."),
      step("Open your mouth and breathe out as though fogging a window — that soft haaah at the back of the throat is the sensation you are after."),
      step("Do it again, and notice where the narrowing happens. It is at the throat, not the nose and not the chest."),
      step("Now close the mouth and make the same narrowing while breathing out through the nose. There should be a quiet, steady sound."),
      step("Add the same narrowing to the inhale, so both directions have it."),
      step("Keep it for twelve breaths. The sound should stay soft and even — a distant wave, not a snore.", "About 2 minutes"),
    ],
    cautions: [
      "Soft is the whole skill. A rasping, straining or grinding sound means the throat is too tight, and practising that way leaves it sore.",
      "The sound comes from the throat. If you are making it in the nose, you are doing something else.",
      "Let it go if it starts making you want to cough.",
    ],
    avoidIf: [
      "You have a sore throat, laryngitis or a throat infection",
      "You have had recent throat or neck surgery",
    ],
    pregnancyAndChildren:
      "Safe in pregnancy and commonly taught in it, since there is no retention and no force. Easily picked up by children over about eight, who generally enjoy the sound.",
    maxDuration:
      "No limit. It is designed to be used continuously through a practice rather than done as a set.",
    body: body([
      ["h2", "Why there is a sound at all"],
      [
        "normal",
        "The narrowing at the throat makes the air pass through a smaller opening, which slows it down. That is the entire mechanism: a breath that would have taken three seconds now takes six, without you deciding to make it longer. The sound is a by-product, and it happens to be the most useful by-product in pranayama — it tells you instantly when your breath has gone short, which is something you cannot otherwise notice while concentrating on something else.",
      ],
      [
        "normal",
        "Ujjayi is usually translated as victorious, and the fogging-a-window instruction is the shortcut every teacher reaches for because the throat position is almost impossible to describe and immediately obvious to feel.",
      ],
      ["h2", "The common mistake"],
      [
        "normal",
        "Making it loud. A room full of people doing audible Ujjayi should sound like distant surf, not like snoring. The loud version tightens the throat, tires it, and shortens the breath it was meant to lengthen — the opposite of the practice, performed with conviction.",
      ],
    ]),
    seoTitle: "Ujjayi Breath — How to Do Ocean Breath Properly",
    metaDescription:
      "Learn Ujjayi pranayama: where the narrowing happens, how to find it, how soft the sound should be, and when to skip it.",
  },

  {
    slug: "bhramari-humming-bee-breath",
    title: "Bhramari (Humming Bee Breath)",
    excerpt:
      "A long hum on each exhale, often with the ears closed — the most immediately calming practice here, and the one to use at night.",
    difficulty: "beginner",
    durationMinutes: 5,
    repetitions: "Five to seven hums to begin with, building to eleven",
    bestTime: ["evening", "before-bed"],
    concerns: ["concern-stress", "concern-sleep"],
    benefits: [
      "Calms faster than anything else in this section, usually within a few hums",
      "The vibration is strongly felt in the head and face, which gives a busy mind something physical to follow",
      "Lengthens the exhale naturally, since a hum cannot be rushed",
    ],
    doshas: ["vata", "pitta"],
    steps: [
      step("Sit upright somewhere quiet. Let the face and jaw go slack."),
      step("Breathe in slowly through the nose."),
      step("With the mouth closed, breathe out while humming — a low, steady mmmm, for as long as the exhale lasts.", "6–8 seconds"),
      step("Let the next inhale come on its own, then hum again."),
      step("Once that is comfortable, rest your thumbs gently over the ear openings — gently, just resting, not pressing in — and keep the other fingers loose on the face. The hum becomes much louder inside the head."),
      step("Five to seven hums, then sit still for a few breaths before getting up.", "About 2 minutes"),
    ],
    cautions: [
      "Rest the thumbs on the ears. Never push anything into the ear canal, and never press hard.",
      "Keep the hum low and easy. Straining for volume or pitch defeats it and leaves the throat tired.",
      "Sit for a moment afterwards rather than standing straight up — this one leaves most people quite settled.",
    ],
    avoidIf: [
      "You have an ear infection, a perforated eardrum, or any discharge from the ear — and do not close the ears at all in that case",
      "You have had recent ear surgery",
      "Lying flat on the back in late pregnancy — sit up for it instead",
    ],
    pregnancyAndChildren:
      "Safe and often recommended in pregnancy; sit upright rather than lying flat. Children take to this one readily — the humming is the appeal.",
    maxDuration:
      "No limit, and it can be used nightly. It is one of the few practices here with a genuine use at the moment you need it rather than on a schedule.",
    body: body([
      ["h2", "Why humming, specifically"],
      [
        "normal",
        "Bhramari is named for the bee, and the practice is the hum. Two things happen at once. A hum makes the exhale long and even, because it is physically impossible to hum quickly — so the breath lengthens without any counting. And the vibration carries through the bones of the face and skull, which is a strong, pleasant and slightly surprising sensation that is very difficult to ignore.",
      ],
      [
        "normal",
        "That second part is the reason this works at night when nothing else does. A racing mind does not stop because you tell it to; it stops because something else has its attention, and a hum you can feel in your cheekbones is unusually good at taking it.",
      ],
      ["h2", "On closing the ears"],
      [
        "normal",
        "Closing the ears cuts out the room and makes the hum enormous inside the head, which is why it is traditionally included. It is also entirely optional. The instruction is to rest the thumbs over the openings — resting, not plugging, not pressing. Anyone with an ear complaint should leave the hands in the lap and simply hum, which loses very little.",
      ],
    ]),
    seoTitle: "Bhramari — Humming Bee Breath for a Restless Mind",
    metaDescription:
      "How to practise Bhramari pranayama, how to position the hands safely, how many rounds, and when to leave the ears alone.",
  },

  {
    slug: "kapalbhati-skull-shining-breath",
    title: "Kapalbhati (Skull-Shining Breath)",
    excerpt:
      "Short sharp exhales from the abdomen with passive inhales — energising, widely taught, and carrying more contraindications than almost anything else here.",
    difficulty: "intermediate",
    durationMinutes: 6,
    repetitions: "Twenty to thirty strokes per round, two to three rounds, with a rest between",
    bestTime: ["early-morning", "empty-stomach"],
    concerns: ["concern-energy"],
    benefits: [
      "Distinctly wakeful and alert afterwards, in a way most people feel on the first attempt",
      "Clears a stuffy nose and head, at least for a while",
      "Makes the abdominal muscles' part in breathing obvious, which no gentle practice does",
    ],
    doshas: ["kapha"],
    steps: [
      step("Sit upright, cross-legged or on a chair, with the spine straight and the hands on the knees. An empty stomach is not optional here — leave at least three hours after a meal."),
      step("Breathe in normally through the nose."),
      step("Contract the lower abdomen sharply and let the air be pushed out through the nose in one short burst. The exhale is active and quick."),
      step("Do nothing to inhale. Release the abdomen and let the air come back in by itself — the inhale is entirely passive. That is one stroke."),
      step("Continue at a steady, unhurried rhythm, about one stroke a second, for twenty to thirty strokes. The chest and shoulders stay still; the movement is all in the belly.", "About 30 seconds"),
      step("Stop and breathe normally for a minute. Notice how you feel before deciding whether to do another round.", "1 minute"),
      step("Two to three rounds in total, then sit quietly.", "About 3 minutes"),
    ],
    cautions: [
      "An empty stomach, always. Three hours after eating, or first thing in the morning.",
      "Stop immediately at any dizziness, pain, nausea, or a feeling of pressure in the head, eyes or ears. These are reasons to stop, not to push through.",
      "Keep the pace moderate. Fast, frantic Kapalbhati is how people hyperventilate, and it is what most online videos demonstrate.",
      "The exhale is the only active part. If you are forcing the inhale too, you are doing Bhastrika, which is a harder practice with stricter limits.",
      "Traditionally avoided during menstruation, and many teachers still advise skipping it then.",
      "It is widely sold as a weight-loss practice. There is no good evidence for that, and it is not a reason to do more of it.",
    ],
    avoidIf: [
      "You have high blood pressure that is not well controlled",
      "You have heart disease, or have had a heart attack or stroke",
      "You are pregnant, or recently gave birth",
      "You have a hernia — hiatal, abdominal or inguinal",
      "You have a stomach or duodenal ulcer, or active gastritis",
      "You have epilepsy",
      "You have glaucoma, a detached retina, or have had recent eye surgery",
      "You have had abdominal, chest or eye surgery in the last three to six months",
      "You have vertigo or are prone to fainting",
    ],
    pregnancyAndChildren:
      "Not in pregnancy at any stage, and not in the first months after giving birth — the forceful abdominal contraction is the reason. Not taught to children under about sixteen.",
    maxDuration:
      "Two to three rounds is a practice; ten is not a better practice. If you want to progress, add a round every few weeks rather than lengthening a round, and stop for a while at any sign of strain.",
    body: body([
      ["h2", "Active out, passive in"],
      [
        "normal",
        "This is the whole technique and the thing almost everyone gets wrong. The exhale is a sharp contraction of the lower abdomen that pushes air out through the nose. The inhale is not performed at all — you release the abdomen, and the air returns on its own because the space is there. One muscle action per stroke, not two.",
      ],
      [
        "normal",
        "Doing both actively turns it into Bhastrika, which is a different and more demanding practice. Doing it fast turns it into hyperventilation, which produces light-headedness and tingling that are then often mistaken for the practice working.",
      ],
      ["h2", "Why the list of exclusions is so long"],
      [
        "normal",
        "Because the repeated forceful contraction raises pressure in the abdomen and the chest many times a minute, and that pressure reaches the eyes, the head, the stomach and the circulation. Each item on the avoid list is a condition where that specific pressure is the problem — a hernia it can push against, a retina it can pull on, an ulcer it can aggravate, blood pressure it can spike.",
      ],
      [
        "normal",
        "None of this makes Kapalbhati dangerous for a healthy person practising moderately. It does mean that the cheerful instruction to do a hundred strokes, which this practice attracts more than any other, is written for nobody in particular.",
      ],
    ]),
    seoTitle: "Kapalbhati — Method, Rounds & Who Must Avoid It",
    metaDescription:
      "How to practise Kapalbhati correctly: active exhale, passive inhale, how many strokes, and the full list of contraindications.",
  },

  {
    slug: "bhastrika-bellows-breath",
    title: "Bhastrika (Bellows Breath)",
    excerpt:
      "Forceful breathing in both directions, like a blacksmith's bellows. The most demanding practice in this section, and the one that most wants a teacher.",
    difficulty: "advanced",
    durationMinutes: 6,
    repetitions: "Ten breaths per round, two rounds, with a full minute of normal breathing between",
    bestTime: ["early-morning", "empty-stomach"],
    concerns: ["concern-energy"],
    benefits: [
      "Strongly and immediately warming — the usual reason it is practised in cold weather",
      "Sharply wakeful, more so than Kapalbhati",
      "Makes the full range of the diaphragm unmistakable",
    ],
    doshas: ["kapha"],
    steps: [
      step("Only attempt this if Kapalbhati is already comfortable and none of the conditions below apply to you. Sit upright with the spine straight, on an empty stomach."),
      step("Breathe in and out normally a few times and settle."),
      step("Breathe in forcefully through the nose, filling the lungs fully, letting the belly expand.", "About 1 second"),
      step("Breathe out forcefully through the nose, emptying completely. Both directions are active and equal — that is what separates this from Kapalbhati.", "About 1 second"),
      step("Continue at roughly one full breath per second for ten breaths. Keep the head, neck and shoulders still and the face relaxed.", "About 10 seconds"),
      step("Stop. Breathe normally for a full minute and pay attention to how you feel.", "1 minute"),
      step("At most one more round. Then sit quietly for a few minutes before standing.", "About 3 minutes"),
    ],
    cautions: [
      "Ten breaths, then stop. This is not a practice to extend on your own, and nothing is gained by pushing to twenty.",
      "A full minute of normal breathing between rounds, every time.",
      "Stop at once at any dizziness, tingling, chest tightness, nausea, or pressure in the head or eyes.",
      "Never attempt this with any breath retention added. That combination belongs to supervised practice only.",
      "Do not practise standing, and sit for a minute before getting up — light-headedness afterwards is common even when it has gone well.",
      "Of everything in this section, this is the one to learn from a teacher in person rather than from a page.",
    ],
    avoidIf: [
      "You have high blood pressure, whether or not it is controlled",
      "You have heart disease, or have had a heart attack or stroke",
      "You are pregnant, or recently gave birth",
      "You have epilepsy",
      "You have glaucoma, a detached retina, or have had recent eye surgery",
      "You have a hernia, a stomach ulcer, or active gastritis",
      "You have asthma or COPD that is not well controlled",
      "You have had abdominal, chest, eye or ear surgery in the last six months",
      "You have vertigo, panic attacks, or are prone to fainting",
      "You are unwell, feverish, or very tired",
    ],
    pregnancyAndChildren:
      "Not in pregnancy at any stage, and not in the months after giving birth. Not for children. Not for anyone over about sixty taking it up for the first time without supervision.",
    maxDuration:
      "Two rounds in a session is a complete practice. Do not build it up week on week without a teacher. If it ever leaves you shaky rather than alert, stop practising it and go back to Kapalbhati.",
    body: body([
      ["h2", "Both directions, and why that matters"],
      [
        "normal",
        "Bhastrika means bellows, and the image is exact: air driven in and out with equal force, the belly working like the leather bag that feeds a forge. Kapalbhati is active on the exhale only. Bhastrika is active on both, which roughly doubles the muscular work and the pressure swings inside the chest and abdomen.",
      ],
      [
        "normal",
        "That is the whole difference, and it is the reason the avoid list here is longer and firmer than Kapalbhati's — high blood pressure appears on it whether or not it is controlled, which it does not for any other practice in this section.",
      ],
      ["h2", "Why ten breaths"],
      [
        "normal",
        "Because the effects arrive fast and the warning signs arrive fast too, and ten breaths followed by a minute of ordinary breathing gives you a chance to notice them while they are still small. The practice is traditionally taught in short rounds for exactly this reason. Long continuous Bhastrika is not a more advanced version of it; it is hyperventilation with a Sanskrit name.",
      ],
      [
        "normal",
        "If this is the practice that drew you to pranayama, the honest advice is to spend a few months on Dirga and Anulom Vilom first, and to find someone to watch you do this one. It is the only entry in this section where a page is not really enough.",
      ],
    ]),
    seoTitle: "Bhastrika — Bellows Breath, Rounds & Contraindications",
    metaDescription:
      "Bhastrika pranayama step by step, how it differs from Kapalbhati, how many rounds, and the long list of who should not try it.",
  },

  {
    slug: "sheetali-cooling-breath",
    title: "Sheetali (Cooling Breath)",
    excerpt:
      "Breathing in through a curled tongue and out through the nose — the practice to reach for in heat, irritation and a short temper.",
    difficulty: "beginner",
    durationMinutes: 4,
    repetitions: "Eight to twelve breaths",
    bestTime: ["midday", "afternoon"],
    concerns: ["concern-stress"],
    benefits: [
      "The incoming air feels distinctly cool, which is unmistakable on the first breath",
      "Takes the edge off irritability and overheating faster than sitting still does",
      "Useful on a hot afternoon, when most of this section is the wrong direction",
    ],
    doshas: ["pitta"],
    steps: [
      step("Sit upright somewhere you are not about to be interrupted."),
      step("Stick the tongue out a little way and curl the long edges upwards to make a tube. If your tongue will not curl, see the note below and use the teeth instead."),
      step("Breathe in slowly through that tube. The air will feel cool as it passes over the wet tongue.", "About 4 seconds"),
      step("Draw the tongue in and close the mouth."),
      step("Breathe out slowly through the nose.", "About 5 seconds"),
      step("Eight to twelve breaths. Then sit for a moment with the mouth closed.", "About 2 minutes"),
    ],
    cautions: [
      "Cooling is the point, which makes this the wrong practice in cold weather or when you are already chilled.",
      "Breathing through the mouth dries it. Take a sip of water afterwards if you need to.",
      "Avoid it outdoors in polluted or dusty air — the nose filters what comes in and the mouth does not.",
      "If it makes you cough or sets off wheezing, stop.",
    ],
    avoidIf: [
      "You have a cold, cough, sore throat or any chest congestion",
      "You have asthma, or any condition where cold air triggers symptoms",
      "You have low blood pressure",
      "You are already cold, or the weather is",
      "You have a tooth or gum problem that cold air makes painful",
    ],
    pregnancyAndChildren:
      "Generally considered safe in pregnancy — no retention and no force — and sometimes suggested for the heat and reflux of late pregnancy; ask your doctor first. Children usually find the tongue-curling entertaining and manage it easily.",
    maxDuration:
      "No limit in hot weather. There is simply no reason to keep practising it once the heat has passed.",
    body: body([
      ["h2", "If your tongue will not curl"],
      [
        "normal",
        "A sizeable minority of people cannot roll the tongue into a tube, and no amount of practice changes it. The traditional alternative is Sheetkari: bring the teeth lightly together, pull the lips back so the air passes between the teeth, breathe in through them, then close the mouth and breathe out through the nose. The effect is essentially the same and the practice is considered interchangeable.",
      ],
      ["h2", "Why the air feels cold"],
      [
        "normal",
        "Because it is passing over a wet surface. Evaporation takes heat with it, which is the same reason a clay pot keeps water cool, and it is why the sensation is on the tongue rather than anywhere deeper. The feeling is real and immediate; it is a local cooling of the mouth and throat rather than a measured drop in body temperature.",
      ],
      [
        "normal",
        "Ayurveda places this squarely as a Pitta practice — for the season, the time of day and the temperament where heat has built up. That framing is also the clearest guide to when to leave it alone: a cough, a cold chest, or a cold day.",
      ],
    ]),
    seoTitle: "Sheetali — Cooling Breath, and Sheetkari If You Can't Curl",
    metaDescription:
      "How to practise Sheetali pranayama, the Sheetkari alternative if your tongue will not curl, and when cooling is the wrong idea.",
  },

  {
    slug: "surya-bhedana-right-nostril-breathing",
    title: "Surya Bhedana (Right Nostril Breathing)",
    excerpt:
      "Breathing in through the right nostril only — the warming, activating counterpart to left nostril breathing, for a sluggish morning.",
    difficulty: "intermediate",
    durationMinutes: 5,
    repetitions: "Nine to twelve rounds",
    bestTime: ["early-morning", "morning", "empty-stomach"],
    concerns: ["concern-energy"],
    benefits: [
      "Warming and rousing — a reasonable substitute when Kapalbhati is too forceful for you",
      "Clears a heavy, foggy start to the day for some people",
      "Gentler than anything else in this section that has the same effect",
    ],
    doshas: ["kapha", "vata"],
    steps: [
      step("Sit upright. Bring the right hand to the nose as in Anulom Vilom — index and middle fingers folded in, thumb and ring finger free."),
      step("Close the left nostril with the ring finger."),
      step("Breathe in slowly through the right nostril.", "About 4 seconds"),
      step("Close the right with the thumb, release the left."),
      step("Breathe out slowly through the left nostril. That is one round.", "About 5 seconds"),
      step("Nine to twelve rounds. Every inhale is through the right and every exhale through the left — this is the part people lose track of.", "About 3 minutes"),
    ],
    cautions: [
      "Do not add breath retention. The classical form includes it and that version belongs with a teacher.",
      "This is heating. Stop if you become agitated, hot or irritable rather than simply more awake.",
      "The wrong practice if you are already anxious or wound up — Chandra Bhedana is the one you want.",
      "Not in the evening, unless you have no intention of sleeping.",
    ],
    avoidIf: [
      "You have high blood pressure that is not well controlled",
      "You have heart disease",
      "You have a fever, or any acute inflammatory condition",
      "You are in an anxious or agitated state, or have a panic disorder",
      "Your nose is blocked on the right side",
    ],
    pregnancyAndChildren:
      "Ask your doctor before practising it in pregnancy; the version without retention is gentle, but the heating effect is not always welcome. Not taught to young children.",
    maxDuration:
      "Fine as a daily morning practice through winter. Leave it alone in hot weather, when its direction works against you.",
    body: body([
      ["h2", "The two channels"],
      [
        "normal",
        "Yoga describes the right nostril as the surya or pingala side — sun, heat, activity — and the left as chandra or ida: moon, cool, receptive. Breathing deliberately through one alone is held to tilt the whole system that way, and Surya Bhedana is the practice for the active direction.",
      ],
      [
        "normal",
        "Whether the mechanism is as described is not settled, and there is no need to settle it to use the practice. What people reliably report is that this one wakes them up and the mirrored version calms them down, which is a usable distinction regardless of what is producing it.",
      ],
      ["h2", "Choosing between this and Chandra Bhedana"],
      [
        "normal",
        "Go by what you actually need. Heavy, foggy, sluggish, cold: this one. Wired, hot, irritable, unable to settle: the other. Getting it the wrong way round will not harm you, but it makes a mild problem slightly worse, which is a dull way to spend five minutes.",
      ],
    ]),
    seoTitle: "Surya Bhedana — Right Nostril Breathing, Step by Step",
    metaDescription:
      "Right nostril breathing for a sluggish morning: the method, how many rounds, and when the heating effect is wrong for you.",
  },

  {
    slug: "chandra-bhedana-left-nostril-breathing",
    title: "Chandra Bhedana (Left Nostril Breathing)",
    excerpt:
      "Breathing in through the left nostril only — the cooling, quieting mirror of Surya Bhedana, for an evening that will not wind down.",
    difficulty: "intermediate",
    durationMinutes: 5,
    repetitions: "Nine to twelve rounds",
    bestTime: ["afternoon", "evening", "before-bed"],
    concerns: ["concern-sleep", "concern-stress"],
    benefits: [
      "Quieting, and more so than alternate nostril breathing for most people",
      "Takes heat and irritability down a level",
      "A short practice that fits into the half hour before bed without ceremony",
    ],
    doshas: ["pitta", "vata"],
    steps: [
      step("Sit upright, somewhere dim if you are doing this at night. Bring the right hand to the nose as in Anulom Vilom."),
      step("Close the right nostril with the thumb."),
      step("Breathe in slowly through the left nostril.", "About 4 seconds"),
      step("Close the left with the ring finger, release the thumb."),
      step("Breathe out slowly through the right nostril. That is one round.", "About 6 seconds"),
      step("Nine to twelve rounds — in through the left, out through the right, every time. Let the exhale be the longer of the two.", "About 3 minutes"),
      step("Sit for a minute afterwards without doing anything in particular."),
    ],
    cautions: [
      "No breath retention in this version.",
      "This is cooling. Leave it alone if you are already cold or congested.",
      "Keep the exhale longer than the inhale — that, as much as the nostril, is what makes it settling.",
      "Not the practice for a morning you have to get going in.",
    ],
    avoidIf: [
      "You have low blood pressure",
      "You have a cold, a cough or chest congestion",
      "Your nose is blocked on the left side",
      "You are feeling low or flat rather than agitated — the quieting direction is traditionally avoided then",
    ],
    pregnancyAndChildren:
      "Generally considered gentle and safe in pregnancy without retention, but ask your doctor. Suitable for older children who can manage the hand position.",
    maxDuration:
      "No limit, and it can be used nightly. Like Bhramari, this is one to use when you need it rather than to keep up as a discipline.",
    body: body([
      ["h2", "The mirror practice"],
      [
        "normal",
        "Everything in Surya Bhedana, reversed: in through the left, out through the right. The left is the chandra or ida side — moon, cool, receptive — and this is the practice for that direction. The two make a pair, and the useful skill is knowing which one the evening calls for.",
      ],
      ["h2", "Why the long exhale matters as much as the nostril"],
      [
        "normal",
        "A slow exhale is the most reliably calming thing you can do with a breath, and it is doing a good deal of the work here. If you take only one instruction from this page, make the out-breath longer than the in-breath — that holds whether or not you bother with the nostrils at all.",
      ],
      [
        "normal",
        "Which is also why this sits well at the end of a day rather than in the middle of one. Nothing about it is strenuous, there is no counting to keep hold of, and it stops without needing to be finished.",
      ],
    ]),
    seoTitle: "Chandra Bhedana — Left Nostril Breathing for the Evening",
    metaDescription:
      "Left nostril breathing to wind down: the method, the long exhale that does the work, how many rounds, and when to skip it.",
  },
]

function validate() {
  const problems = []
  const slugs = new Set()

  for (const p of PRACTICES) {
    const at = (msg) => problems.push(`${p.slug}: ${msg}`)

    if (slugs.has(p.slug)) at("duplicate slug")
    slugs.add(p.slug)

    if (!p.title) at("missing title")
    if (!p.excerpt) at("missing excerpt")
    if (p.excerpt && p.excerpt.length > 300) at(`excerpt is ${p.excerpt.length} chars, max 300`)
    if (!p.steps?.length) at("needs at least one step")
    if (!p.cautions?.length) at("needs at least one caution")
    if (!DIFFICULTIES.includes(p.difficulty)) at(`difficulty "${p.difficulty}" is not valid`)
    if (p.durationMinutes != null && (p.durationMinutes < 1 || p.durationMinutes > 240))
      at(`durationMinutes ${p.durationMinutes} is outside 1–240`)
    if (p.seoTitle && p.seoTitle.length > 60) at(`seoTitle is ${p.seoTitle.length} chars, warns over 60`)
    if (p.metaDescription && p.metaDescription.length > 155)
      at(`metaDescription is ${p.metaDescription.length} chars, warns over 155`)

    for (const t of p.bestTime ?? []) if (!BEST_TIME_VALUES.includes(t)) at(`unknown bestTime "${t}"`)
    for (const d of p.doshas ?? []) if (!DOSHA_VALUES.includes(d)) at(`unknown dosha "${d}"`)
    for (const s of p.steps ?? []) if (!s.text) at("a step has no text")

    /* The concern ids are not written by this script, but link-pranajiva-concerns.mjs reads them
       from here, so a typo would surface there instead. Cheaper to catch it now. */
    const known = CONCERNS.map((c) => c._id.replace(/^drafts\./, ""))
      .concat(["concern-digestion", "concern-cough-cold", "concern-immunity"])
    for (const c of p.concerns ?? []) if (!known.includes(c)) at(`unknown concern id "${c}"`)
  }

  return problems
}

function buildMutations() {
  const mutations = [{ createIfNotExists: CATEGORY }]
  for (const c of CONCERNS) mutations.push({ createIfNotExists: c })

  PRACTICES.forEach((p, index) => {
    mutations.push({
      createIfNotExists: {
        _id: `drafts.practice-${p.slug}`,
        _type: "practice",
        title: p.title,
        slug: { _type: "slug", current: p.slug },
        excerpt: p.excerpt,
        practiceType: "pranayama",

        steps: p.steps.map((s, n) => ({
          _key: `step${n}`,
          _type: "methodStep",
          text: s.text,
          ...(s.duration ? { duration: s.duration } : {}),
        })),
        durationMinutes: p.durationMinutes,
        repetitions: p.repetitions,
        difficulty: p.difficulty,
        bestTime: p.bestTime,
        benefits: p.benefits,
        ...(p.doshas?.length ? { doshas: p.doshas } : {}),

        cautions: p.cautions,
        avoidIf: p.avoidIf,
        pregnancyAndChildren: p.pregnancyAndChildren,
        maxDuration: p.maxDuration,

        body: p.body,

        author: { _type: "reference", _ref: AUTHOR },
        category: { _type: "reference", _ref: CATEGORY._id },
        /* concerns: set by link-pranajiva-concerns.mjs once the concern drafts are published. */
        publishedAt: publishedAt(index),
        featured: false,

        seoTitle: p.seoTitle,
        metaDescription: p.metaDescription,
        noIndex: false,
      },
    })
  })

  return mutations
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

async function main() {
  const problems = validate()
  if (problems.length) {
    console.error(`Refusing to write — ${problems.length} problem(s):\n`)
    for (const p of problems) console.error(`  ${p}`)
    process.exit(1)
  }

  const mutations = buildMutations()

  console.log(
    `Pranajiva — Pranayama\n` +
      `  project ${PROJECT_ID} / ${DATASET}\n` +
      `  1 category  (published)  Pranayama\n` +
      `  ${CONCERNS.length} concerns  (drafts)     ${CONCERNS.map((c) => c.title).join(", ")}\n` +
      `  ${PRACTICES.length} practices (drafts)\n` +
      `  validation passed\n`
  )

  if (DRY_RUN) {
    for (const p of PRACTICES) {
      console.log(
        `  ${p.slug.padEnd(42)} ${p.difficulty.padEnd(12)} ${String(p.steps.length).padStart(2)} steps  ` +
          `${String(p.cautions.length).padStart(2)} cautions  ${String((p.avoidIf ?? []).length).padStart(2)} avoid-if`
      )
    }
    console.log(`\nDry run — nothing was written.`)
    return
  }

  const token = loadToken()
  if (!token) {
    console.error(`No token. Add SANITY_WRITE_TOKEN to crossfriend-ops/.env.local.`)
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

  const resultBody = await res.json()
  if (!res.ok) {
    console.error(`Sanity refused the write (${res.status}):`)
    console.error(JSON.stringify(resultBody, null, 2))
    process.exit(1)
  }

  const created = (resultBody.results ?? []).filter((r) => r.operation === "create").length
  const left = (resultBody.results ?? []).length - created
  console.log(`Done.  ${created} created, ${left} already existed and were left untouched.`)
  console.log(
    `\nNext:\n` +
      `  1. In the Studio, read the ${CONCERNS.length} concern drafts and publish the ones you are happy with.\n` +
      `  2. Run: node scripts/link-pranajiva-concerns.mjs\n` +
      `     That attaches concerns to these practices AND to the teas, which currently have none —\n` +
      `     so "Pairs well with this" has nothing to show on any of them.\n` +
      `  3. Read each practice, add a cover image, publish.\n`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
