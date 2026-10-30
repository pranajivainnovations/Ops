/**
 * Seeds ten Teas & Decoctions remedies into the Pranajiva Knowledge Center, as drafts.
 *
 * Run: node scripts/seed-pranajiva-teas.mjs --dry-run   (validates everything, writes nothing)
 *      node scripts/seed-pranajiva-teas.mjs             (needs SANITY_WRITE_TOKEN)
 *
 * ── Why drafts ─────────────────────────────────────────────────────────────────────────────────
 * Every one of these is health copy about what to drink when you are unwell, and none of it has
 * been read by PranaJiva yet. The `drafts.` prefix is Sanity's own convention: the documents appear
 * in the Studio, are fully editable, and are invisible to the public API until someone presses
 * Publish. Nothing here can reach pranajiva.in by accident.
 *
 * ── Why the ids are the live ones rather than the seed script's ───────────────────────────────
 * seed-pranajiva-knowledge.mjs was never run. The Teas & Decoctions category, the two concerns and
 * the author were all created by hand in the Studio, so they carry Sanity's own uuids rather than
 * the deterministic ids that script would have given them. These were read back off the live
 * dataset on 2026-10-30; if the taxonomy is ever rebuilt from that script, these constants are what
 * needs updating.
 *
 * ── What is deliberately not set ───────────────────────────────────────────────────────────────
 * coverImage, step images and productHandles. Images are being supplied separately — the prompts
 * and alt text for all of them are in docs/pranajiva-tea-image-briefs.md rather than dropped. The
 * product handles are left empty because the catalogue lives in Postgres and guessing a handle
 * renders a dead link next to the ingredients.
 *
 * The medical disclaimer is not written into any body, because the storefront already renders
 * MedicalDisclaimer on every remedy page. Repeating it would print it twice.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const PROJECT_ID = "dlrwy20z"
const DATASET = "production"
const API_VERSION = "2024-10-01"

const DRY_RUN = process.argv.includes("--dry-run")

/* Read off the live dataset. See the note at the top of this file. */
/**
 * "PranaJiva", role Editorial Team, isOrganization true.
 *
 * There were briefly two identical author records. This is the one that survived: the duplicate
 * created on 2026-10-30 was merged into it and deleted, and the Tulsi kadha was repointed here.
 */
const AUTHOR = "2b1332fa-bee2-4596-85b9-8fecc47e4e84"
const CATEGORY_TEAS = "f763372a-fcb9-4aa0-bf23-8f9fdbdf113b" // Teas & Decoctions

/**
 * The one concern this batch needs and the dataset does not have.
 *
 * Only the three after-meal seed infusions are tagged with it, and only because their own source
 * briefs name "After-Meal Comfort; Digestive Routine". The other seven are left untagged on
 * purpose: their briefs explicitly forbid the immunity, anti-inflammatory and cold-remedy claims
 * that tagging them Cough & Cold or Immunity would imply. An untagged entry still cross-links
 * through its category, so nothing is orphaned — it simply does not appear on a concern page it
 * has not earned.
 */
const CONCERN_DIGESTION = "concern-digestion"

const BEST_TIME_VALUES = [
  "early-morning", "morning", "midday", "afternoon", "evening",
  "before-bed", "empty-stomach", "with-food", "after-food", "anytime",
]
const DOSHA_VALUES = ["vata", "pitta", "kapha"]

/** [amount, item, note, optional] -> an ingredient object. */
function ing(amount, item, note, optional = false) {
  return { amount, item, note, optional }
}

/** [text, duration] -> a methodStep object. */
function step(text, duration) {
  return { text, duration }
}

/** [[style, text], ...] -> portable text. Headings start at h2; the title is the page's H1. */
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
 * Publication timestamps, staggered so the index has a stable order rather than an arbitrary one.
 *
 * Newest first is the storefront's ordering, so the first recipe in the brief gets the latest time.
 * All of them are in the past: a future-dated entry stays invisible even after Publish, which is a
 * genuinely confusing way for a page to go missing.
 */
const PUBLISHED_BASE = Date.parse("2026-10-30T10:00:00Z")
const publishedAt = (i) => new Date(PUBLISHED_BASE - i * 4 * 60_000).toISOString()

const REMEDIES = [
  {
    slug: "cumin-coriander-fennel-ccf-tea",
    title: "Cumin, Coriander & Fennel Tea",
    excerpt:
      "A gently spiced, caffeine-free seed infusion, traditionally taken after meals as part of an Ayurvedic digestive routine.",
    concerns: [CONCERN_DIGESTION],
    prepMinutes: 12,
    makes: "2 cups, about 400–450 ml depending on how hard it simmers",
    ingredients: [
      ing("2½ cups", "Water"),
      ing("½ tsp", "Whole cumin seeds (jeera)", "lightly crushed"),
      ing("½ tsp", "Whole coriander seeds (dhaniya)", "lightly crushed"),
      ing("½ tsp", "Whole fennel seeds (saunf)", "lightly crushed"),
    ],
    steps: [
      step("Crush the three seeds lightly — a pestle or the flat of a knife is enough. You want them cracked open, not powdered.", "1 minute"),
      step("Bring the water to a boil, add all three seeds, lower the heat and let it simmer covered.", "7 minutes"),
      step("Turn off the heat and leave it covered to steep.", "3 minutes"),
      step("Strain into two cups and drink it comfortably warm.", "1 minute"),
    ],
    dosage:
      "Half a cup to one cup after a meal, as often as you enjoy it. This is an everyday beverage rather than a course of treatment — there is no dose to build up to and no schedule to keep.",
    bestTime: ["after-food", "evening"],
    howLong:
      "The warmth and the aroma are the whole of it, and both are immediate. Nothing here is expected to clear a symptom, so do not sit waiting for one.",
    doshas: [],
    cautions: [
      "Stop if it makes reflux, nausea or discomfort worse rather than better.",
      "Keep it at food-level strength. Brewing it heavily and drinking it to a schedule for weeks turns a kitchen tea into a self-prescribed treatment, which is not what this is.",
      "Persistent stomach pain, vomiting, blood in the stool or unexplained weight loss are reasons to see a doctor, not reasons to brew this more often.",
    ],
    avoidIf: [
      "You are allergic to cumin, coriander or fennel, or to other plants in the carrot family — celery, dill, anise, caraway.",
    ],
    pregnancyAndChildren:
      "Cooking with these three spices is not the same as drinking a concentrated infusion of them. Ask your doctor before taking this regularly in pregnancy or while breastfeeding, or before giving it to a child.",
    maxDuration:
      "There is no course to finish. If you are reaching for this daily for weeks because something is not settling, that is the point to have it looked at rather than to keep brewing.",
    body: body([
      ["h2", "Why these three seeds"],
      [
        "normal",
        "Jeera, dhaniya and saunf are the three seeds almost every Indian kitchen already has, and the combination of them is one of the oldest after-meal habits in the country. Ayurveda discusses the grouping in relation to agni — the digestive fire — and frames it as something that keeps a meal moving rather than something that fixes a problem.",
      ],
      [
        "normal",
        "That framing is worth taking literally. The evidence for treating a diagnosed digestive disorder with this specific tea is thin, and nothing about the three seeds together has been shown to do more than the pleasant, warming, aromatic thing you can taste it doing. Crushing them is the only step that changes the result much: whole seeds keep most of their oils sealed in, and the tea comes out weak.",
      ],
    ]),
    seoTitle: "CCF Tea — Cumin, Coriander & Fennel Recipe",
    metaDescription:
      "Cumin, coriander and fennel tea made at home — ingredients, method, the traditional Ayurvedic reasoning and sensible precautions.",
  },

  {
    slug: "ajwain-saunf-digestive-kadha",
    title: "Ajwain & Saunf Kadha",
    excerpt:
      "An aromatic carom-seed and fennel decoction, built on the familiar Indian habit of chewing spices after a meal.",
    concerns: [CONCERN_DIGESTION],
    prepMinutes: 10,
    makes: "1 cup, about 200 ml",
    ingredients: [
      ing("1¼ cups", "Water"),
      ing("¼ tsp", "Ajwain (carom seeds)", "lightly crushed"),
      ing("½ tsp", "Fennel seeds (saunf)", "lightly crushed"),
      ing("a small pinch", "Jaggery", "for flavour, stirred in at the end", true),
    ],
    steps: [
      step("Crush the ajwain and fennel lightly together.", "1 minute"),
      step("Add them to boiling water and bring it down to a gentle simmer.", "5 minutes"),
      step("Cover and leave it to steep off the heat.", "2 minutes"),
      step("Strain into a cup, and stir in the jaggery while it is still warm if you are using it.", "2 minutes"),
    ],
    dosage:
      "Half a cup to one cup after food, occasionally. Do not increase the ajwain to chase a stronger effect — ajwain gets harsh long before it gets more useful.",
    bestTime: ["after-food"],
    howLong:
      "You will notice the aroma and the warmth while you are drinking it. There is no predictable timeline beyond that, and none should be expected.",
    doshas: ["vata", "kapha"],
    cautions: [
      "Ajwain is pungent and can feel irritating when it is concentrated. A quarter teaspoon is the whole of it.",
      "If you get heartburn, reflux or a burning feeling, this is the wrong direction — stop rather than persist.",
      "Severe or recurring stomach discomfort needs examining, not a stronger kadha.",
    ],
    avoidIf: [
      "You are allergic to ajwain or fennel",
      "You have active digestive irritation — an ulcer, gastritis or a reflux flare-up — that spices make worse",
    ],
    pregnancyAndChildren:
      "Concentrated ajwain decoctions are best avoided in pregnancy and while breastfeeding unless your doctor has cleared it. This recipe is written for adults.",
    maxDuration:
      "An occasional drink, not a daily one. Digestive symptoms that keep coming back over weeks are not something to manage from the spice box.",
    body: body([
      ["h2", "Why ajwain, and why so little of it"],
      [
        "normal",
        "Ajwain is the sharpest thing in most Indian spice boxes, and the traditional preparations that use it are notable for how little they use. A quarter of a teaspoon in a cup and a quarter of water is not caution for its own sake — past that the drink turns bitter and starts to irritate the stomach it was meant to settle.",
      ],
      [
        "normal",
        "Fennel is doing the other half of the job. It is sweeter and rounder, and it makes the ajwain drinkable in the first place. What you end up with is a household infusion with a long cultural history behind it, which is a different claim from evidence that it treats gastritis or IBS — it does not, and nothing here should be read as saying so.",
      ],
    ]),
    seoTitle: "Ajwain & Saunf Kadha — Recipe & Precautions",
    metaDescription:
      "How to make ajwain and saunf kadha from two kitchen spices — quantities, method, traditional background and safety notes.",
  },

  {
    slug: "lemongrass-ginger-herbal-tea",
    title: "Lemongrass & Ginger Tea",
    excerpt:
      "A bright, citrus-scented cup warmed with a little ginger — a caffeine-free daily ritual rather than a remedy.",
    concerns: [],
    prepMinutes: 10,
    makes: "2 cups",
    ingredients: [
      ing("2¼ cups", "Water"),
      ing("1 stalk", "Tender lemongrass", "washed and bruised, or 1 tbsp chopped"),
      ing("½ inch", "Fresh ginger", "thinly sliced"),
      ing("1 tsp per cup", "Honey", "stirred in only once the tea has cooled to warm", true),
    ],
    steps: [
      step("Rinse the lemongrass and bruise the stalk along its length so it opens up. Slice the ginger thinly.", "2 minutes"),
      step("Bring the water to a boil and add both.", "1 minute"),
      step("Simmer gently, covered.", "5 minutes"),
      step("Turn off the heat and leave it to steep.", "2 minutes"),
      step("Strain. If you are using honey, wait until the cup is warm rather than hot before stirring it in."),
    ],
    dosage:
      "One cup, whenever you want it. This is an aromatic beverage and there is no medicinal dose attached to it.",
    bestTime: ["morning", "evening"],
    howLong:
      "The citrus smell and the warmth arrive with the first sip. Nothing else is being promised — in particular, this is not a treatment for a cold or an infection.",
    doshas: ["vata", "kapha"],
    cautions: [
      "Ginger makes heartburn worse for some people. Use less of it, or leave it out, if that is you.",
      "Talk to your doctor about concentrated ginger if you take blood-thinning or anti-platelet medication, or if you have surgery coming up.",
      "Honey goes into warm liquid, never boiling — and never for a child under one year old.",
    ],
    avoidIf: ["You are allergic to lemongrass or to ginger"],
    pregnancyAndChildren:
      "Concentrated lemongrass infusions are not recommended in pregnancy or while breastfeeding without medical advice. Honey must never be given to a child under one year old.",
    maxDuration:
      "Fine as an everyday drink. A cold or a cough that keeps going needs assessing on its own terms, and this does not bear on that either way.",
    body: body([
      ["h2", "What this is, and what it is not"],
      [
        "normal",
        "Ginger is described in the Ayurvedic texts as warming and drying, under the names shunthi when dried and ardraka when fresh, and that description is a fair guide to how the cup feels. Lemongrass is not part of that tradition in the same way — it is a South and Southeast Asian kitchen herb that brings a clean citrus note, and the pairing here is a modern one.",
      ],
      [
        "normal",
        "Which is worth saying plainly, because lemongrass-and-ginger is sold almost everywhere as a cold remedy. It is not a classical formula and it has not been shown to shorten or prevent anything. Bruising the stalk rather than chopping it is the one technique that matters: the aromatic oils sit in the fibres, and a cut stalk releases far less of them.",
      ],
    ]),
    seoTitle: "Lemongrass & Ginger Tea — Recipe",
    metaDescription:
      "Brew lemongrass and ginger tea at home — exact ingredients, step-by-step method and the precautions worth knowing first.",
  },

  {
    slug: "pudina-saunf-herbal-tea",
    title: "Pudina & Saunf Tea",
    excerpt:
      "A fragrant mint and fennel infusion, taken after lunch in the way the spice bowl at the door of a restaurant is taken.",
    concerns: [CONCERN_DIGESTION],
    prepMinutes: 8,
    makes: "2 cups",
    ingredients: [
      ing("2 cups", "Water"),
      ing("10–12", "Fresh mint leaves (pudina)", "rinsed, torn by hand"),
      ing("1 tsp", "Whole fennel seeds (saunf)", "lightly crushed"),
      ing("½ tsp per cup", "Jaggery", "stirred in while warm", true),
    ],
    steps: [
      step("Crush the fennel seeds lightly.", "1 minute"),
      step("Bring the water to a boil, add the fennel and let it simmer.", "3 minutes"),
      step("Switch off the heat, tear in the mint leaves, cover and leave to steep. The mint must not boil.", "3 minutes"),
      step("Strain, add the jaggery if you are using it, and serve.", "1 minute"),
    ],
    dosage:
      "One cup when you want it, preferably after food. It is a herbal drink, not a cure for indigestion, and it does not need to be taken to a schedule.",
    bestTime: ["after-food", "afternoon"],
    howLong:
      "The mint is apparent straight away. Whether it settles anything is individual and not something to count on.",
    doshas: ["pitta"],
    cautions: [
      "Mint relaxes the valve at the top of the stomach and makes acid reflux worse for some people. If heartburn increases, this is the wrong drink for you.",
      "Boiling the mint turns it bitter and loses most of what you added it for. It goes in off the heat.",
    ],
    avoidIf: ["You are allergic to mint or to fennel"],
    pregnancyAndChildren:
      "Using mint and fennel in cooking is not the same as a strong infusion of them. Ask a doctor before taking this regularly in pregnancy, while breastfeeding, or giving it to a child.",
    maxDuration:
      "An occasional drink. Reflux, vomiting or digestive symptoms that persist should be looked at by a clinician.",
    body: body([
      ["h2", "Why the mint goes in last"],
      [
        "normal",
        "Fennel is the half of this with the long after-meal history behind it — it is the saunf in the bowl by the door, and the reason it is there at all. Mint is the fresher, cooler note on top, and in Ayurvedic terms it is the cooling element in what would otherwise be a sweet, warm cup.",
      ],
      [
        "normal",
        "Mint is also the ingredient that is easiest to ruin. Its aromatic oils are volatile and they leave with the steam, so mint that is boiled gives you a bitter, grassy tea and very little scent. Tear the leaves rather than chopping them, add them once the pan is off the flame, and keep it covered while it steeps.",
      ],
    ]),
    seoTitle: "Pudina & Saunf Herbal Tea — Recipe",
    metaDescription:
      "An easy mint and fennel tea with fresh pudina — ingredients, method, when to drink it and the precautions that apply.",
  },

  {
    slug: "dhaniya-seed-coriander-tea",
    title: "Dhaniya Seed Tea",
    excerpt:
      "A mild coriander-seed infusion, drunk warm or at room temperature — the gentlest thing in this section.",
    concerns: [],
    prepMinutes: 12,
    makes: "2 cups",
    ingredients: [
      ing("2¼ cups", "Water"),
      ing("1 tsp", "Whole coriander seeds (dhaniya)", "lightly crushed"),
      ing("2 thin slices", "Fresh ginger", "for flavour — it makes the cup warming rather than cooling", true),
    ],
    steps: [
      step("Crush the coriander seeds gently.", "1 minute"),
      step("Bring the water to a boil and add the coriander, along with the ginger slices if you are using them.", "1 minute"),
      step("Simmer covered.", "6 minutes"),
      step("Take it off the heat and leave it to steep.", "3 minutes"),
      step("Strain, and drink it warm or let it come down to room temperature.", "1 minute"),
    ],
    dosage:
      "One cup, occasionally, as a caffeine-free infusion. There is no therapeutic dose here and nothing to work up to.",
    bestTime: ["morning", "after-food"],
    howLong:
      "A mild flavour and a glass of warm water is honestly what this is. It has not been shown to lower body temperature or to do anything for urinary symptoms, so do not drink it waiting for either.",
    doshas: ["pitta"],
    cautions: [
      "Made in advance and left standing at room temperature, any infusion grows bacteria. Refrigerate it or make it fresh.",
      "Burning on urination, fever or signs of dehydration are reasons to see a doctor. This is not the answer to any of them.",
    ],
    avoidIf: ["You are allergic to coriander or to other plants in the carrot family"],
    pregnancyAndChildren:
      "Strong medicinal-style seed preparations are not recommended in pregnancy, while breastfeeding, or for children without individual advice from a clinician.",
    maxDuration:
      "Occasional use. This is not something to self-treat an ongoing symptom with over weeks.",
    body: body([
      ["h2", "The quiet one"],
      [
        "normal",
        "Dhaniya is described in Ayurvedic and Indian food writing as the gentle member of the spice box — cooling where cumin and ajwain are heating, and mild enough that it is one of the few spices used freely in preparations for people who cannot tolerate pungency.",
      ],
      [
        "normal",
        "That is a description of taste and traditional usage, and it is not a substitute for clinical evidence of any kind. Coriander water is widely recommended online for summer heat and for urinary complaints; neither use is established. What it reliably is: mild, pleasant, caffeine-free and easy on a stomach that is not up to much.",
      ],
    ]),
    seoTitle: "Dhaniya Seed Tea — Coriander Water Recipe",
    metaDescription:
      "A mild coriander-seed tea — how to make it, how much water to use, the traditional context and the honest limits.",
  },

  {
    slug: "dalchini-elaichi-warming-tea",
    title: "Dalchini & Elaichi Tea",
    excerpt:
      "A fragrant cinnamon and cardamom tea made with no tea leaves at all — warming, and entirely caffeine-free.",
    concerns: [],
    prepMinutes: 10,
    makes: "2 cups",
    ingredients: [
      ing("2¼ cups", "Water"),
      ing("1 small stick, 2–3 cm", "Cinnamon (dalchini)", "Ceylon cinnamon if you drink it often — see the cautions"),
      ing("2 pods", "Green cardamom (elaichi)", "lightly cracked"),
      ing("1 tsp in total", "Jaggery", "stirred in while warm", true),
    ],
    steps: [
      step("Crack the cardamom pods open and measure out the cinnamon.", "1 minute"),
      step("Bring the water to a boil and add both spices.", "1 minute"),
      step("Cover and let it simmer lightly.", "6 minutes"),
      step("Switch off, let it steep, then strain.", "2 minutes"),
      step("Stir in the jaggery while it is still warm, if you are using it."),
    ],
    dosage:
      "One small cup, occasionally. Avoid strong concentrated cinnamon decoctions and daily medicinal-style use — see the note on coumarin below.",
    bestTime: ["morning", "evening"],
    howLong:
      "The warmth and the smell are the point and they are immediate. There is no validated timeline for anything else, and nothing else is being claimed.",
    doshas: ["vata", "kapha"],
    cautions: [
      "Cassia cinnamon — the common, thick, dark variety sold as cinnamon in most of India — contains coumarin, which is hard on the liver in repeated high doses. Ceylon cinnamon contains very little. If you are drinking this often, buy Ceylon.",
      "Talk to your doctor first if you take glucose-lowering medication. Cinnamon is widely claimed to affect blood sugar, and whatever the truth of that, it is not something to layer on top of a prescription unsupervised.",
      "One small cup. Doubling the cinnamon does not double anything useful.",
    ],
    avoidIf: [
      "You are allergic to cinnamon or cardamom",
      "You have liver disease — the coumarin in cassia cinnamon is the reason",
    ],
    pregnancyAndChildren:
      "Keep to ordinary food quantities. Medicinal use of cinnamon in pregnancy, while breastfeeding or for children needs a clinician's advice first.",
    maxDuration:
      "An occasional cup rather than a daily habit, unless you are using Ceylon cinnamon. There is no course here to complete.",
    body: body([
      ["h2", "Two spices, and one thing worth knowing"],
      [
        "normal",
        "Dalchini and elaichi are the aromatic backbone of masala chai, and this is essentially that cup with the tea leaves and the milk taken away. What is left is warming and sweet-smelling without any caffeine in it, which is the whole reason to make it in the evening.",
      ],
      [
        "normal",
        "The one thing worth knowing is which cinnamon you have. Most cinnamon sold in India is cassia — thick, hard, dark, rolled in a single thick layer — and it carries coumarin, which accumulates and is hard on the liver at repeated high intakes. Ceylon cinnamon is pale, brittle, and rolled in many thin layers like a cigar, and has almost none. For a cup now and then it does not matter. For a daily habit it does.",
      ],
    ]),
    seoTitle: "Cinnamon & Cardamom Herbal Tea — Recipe",
    metaDescription:
      "A caffeine-free dalchini and elaichi tea from two spices — method, quantities, and why the type of cinnamon matters.",
  },

  {
    slug: "rose-fennel-herbal-tea",
    title: "Rose & Fennel Tea",
    excerpt:
      "A delicate floral infusion of edible rose petals and fennel, for an evening that is meant to slow down.",
    concerns: [],
    prepMinutes: 8,
    makes: "2 cups",
    ingredients: [
      ing("2 cups", "Water"),
      ing("1 tsp", "Dried edible rose petals", "food-grade and unsprayed — see the cautions"),
      ing("½ tsp", "Fennel seeds (saunf)", "lightly crushed"),
      ing("½ tsp per cup", "Honey", "added only once the cup is warm rather than hot", true),
    ],
    steps: [
      step("Crush the fennel seeds lightly.", "1 minute"),
      step("Bring the water to a gentle boil, add the fennel and simmer.", "3 minutes"),
      step("Turn off the heat, add the rose petals, cover and steep. The petals should never boil.", "3 minutes"),
      step("Strain, and stir in the honey once it has cooled to warm if you are using it.", "1 minute"),
    ],
    dosage:
      "One cup in the evening, as often as you like it. Whether it relaxes you is a personal matter and not a therapeutic effect.",
    bestTime: ["afternoon", "evening"],
    howLong:
      "The scent is immediate. Nothing here treats anxiety or insomnia, and it should not be used in place of something that does.",
    doshas: ["pitta"],
    cautions: [
      "Use only petals sold as food-grade and unsprayed. Florist roses and decorative potpourri petals are treated with pesticides and fragrance and are not for drinking.",
      "Honey goes into a warm cup, never a boiling one, and never to a child under one year old.",
      "Ongoing sleeplessness or anxiety deserves proper attention. A pleasant evening ritual is a good thing to have alongside that, not instead of it.",
    ],
    avoidIf: ["You are allergic to rose, fennel or related plants"],
    pregnancyAndChildren:
      "Ask a qualified clinician before taking concentrated floral infusions regularly in pregnancy or while breastfeeding. Honey must never be given to a child under one year old.",
    maxDuration:
      "No limit worth stating for an occasional cup. Persistent insomnia or anxiety is the thing to act on, and this is not the action.",
    body: body([
      ["h2", "A ritual, described honestly"],
      [
        "normal",
        "Rose carries a particular association in Indian tradition — gentleness, coolness, the sort of thing offered at the end of a hot day rather than the start of one. Gulkand and rose water sit in the same family of preparations. Fennel supplies the sweet anise note underneath and keeps the cup from being only perfume.",
      ],
      [
        "normal",
        "What this is, then, is a ritual: a warm, fragrant, caffeine-free cup at a time of day when having one is pleasant. That is worth something, and it is a different claim from a sleep aid. The petals go in off the heat for the same reason the mint does elsewhere in this section — boiled, they give up their scent to the room instead of the cup.",
      ],
    ]),
    seoTitle: "Rose & Fennel Herbal Tea — Recipe",
    metaDescription:
      "An elegant rose and fennel tea with edible petals and saunf — method, how to source safe petals, and the precautions.",
  },

  {
    slug: "hibiscus-rose-herbal-tea",
    title: "Hibiscus & Rose Tea",
    excerpt:
      "A ruby-red, pleasantly tart caffeine-free infusion, with a little edible rose softening the edge of the hibiscus.",
    concerns: [],
    prepMinutes: 8,
    makes: "2 cups",
    ingredients: [
      ing("2 cups", "Water"),
      ing("1 tsp", "Dried hibiscus calyces", "food-grade Hibiscus sabdariffa, not ornamental hibiscus"),
      ing("½ tsp", "Dried edible rose petals", "food-grade and unsprayed"),
      ing("to taste", "Jaggery", "a little goes a long way against the tartness", true),
    ],
    steps: [
      step("Check that both the hibiscus and the rose are sold as food-grade.", "1 minute"),
      step("Heat the water to a boil, then switch the heat off.", "2 minutes"),
      step("Add the hibiscus and rose, cover, and leave to steep.", "4 minutes"),
      step("Strain promptly — left sitting on the petals it turns sharply astringent. Sweeten lightly if you want to.", "1 minute"),
    ],
    dosage:
      "One cup, occasionally, warm or cooled. This is not a blood-pressure regimen and should not be drunk as one.",
    bestTime: ["afternoon"],
    howLong:
      "The tartness and the colour are immediate. No health outcome is promised and none should be waited for.",
    doshas: ["pitta"],
    cautions: [
      "Hibiscus is widely reported to lower blood pressure and may interact with blood-pressure medication. Talk to your doctor before drinking it regularly if you take any, or if your blood pressure already runs low.",
      "Only Hibiscus sabdariffa — the dried red calyces sold as food — is for drinking. The ornamental hibiscus in the garden is not.",
      "Steeped too long it becomes unpleasantly sour and astringent rather than stronger in any useful sense.",
    ],
    avoidIf: [
      "You are allergic to hibiscus or rose",
      "You are pregnant, unless your doctor has specifically cleared it",
      "You take medication for blood pressure and have not checked with your doctor",
    ],
    pregnancyAndChildren:
      "Avoid regular or concentrated hibiscus in pregnancy and while breastfeeding — the safety evidence is insufficient, which is a reason for caution rather than reassurance. Not recommended for children without medical advice.",
    maxDuration:
      "An occasional drink. Daily therapeutic use is exactly the pattern that needs a doctor's view first, because of the blood-pressure question.",
    body: body([
      ["h2", "Where this one comes from"],
      [
        "normal",
        "Hibiscus tea belongs to contemporary wellness drinking far more than to classical Ayurveda — it is karkade in Egypt, agua de jamaica in Mexico, and gudhal in Indian gardens, and the red infusion is drunk across most of the tropics. This is not presented as a traditional Ayurvedic formula, because it is not one.",
      ],
      [
        "normal",
        "It also carries the one real pharmacological caution in this set. The blood-pressure effect reported for hibiscus is the reason it turns up in so many wellness lists, and it is also the reason to mention medication before mentioning anything else. The rose is here for balance: hibiscus alone is sharply sour, and a small amount of petal rounds it without sweetening it.",
      ],
    ]),
    seoTitle: "Hibiscus & Rose Herbal Tea — Recipe",
    metaDescription:
      "Brew a bright hibiscus and rose tea at home — quantities, steeping time, and the blood-pressure caution to read first.",
  },

  {
    slug: "turmeric-ginger-kadha",
    title: "Turmeric & Ginger Kadha",
    excerpt:
      "An earthy, gently warming kitchen-spice decoction of fresh ginger and a little haldi, for cold weather.",
    concerns: [],
    prepMinutes: 12,
    makes: "2 small cups",
    ingredients: [
      ing("2¼ cups", "Water"),
      ing("½ inch", "Fresh ginger", "thinly sliced"),
      ing("¼ tsp", "Turmeric powder (haldi)", "culinary, or a small piece of fresh turmeric, grated"),
      ing("½ tsp in total", "Jaggery", "stirred in while warm", true),
    ],
    steps: [
      step("Slice the ginger and measure out the turmeric.", "2 minutes"),
      step("Bring the water to a boil, add the ginger and turmeric, and lower the heat.", "1 minute"),
      step("Simmer gently, covered.", "6 minutes"),
      step("Take it off the heat and let it rest.", "2 minutes"),
      step("Strain through a fine sieve, stir in the jaggery if you are using it, and drink it warm after food.", "1 minute"),
    ],
    dosage:
      "Half a cup to one small cup, occasionally, after food. This is a food-level drink — it is not a substitute for, and not comparable to, a turmeric supplement.",
    bestTime: ["after-food"],
    howLong:
      "Taste and warmth, immediately. This has not been shown to reduce inflammation, treat an infection or improve immunity, and it is not offered for any of those.",
    doshas: ["vata", "kapha"],
    cautions: [
      "Heating in nature, and it can make reflux and stomach irritation worse. Always after food, never on an empty stomach.",
      "Talk to your doctor if you take blood-thinning medication, or if you have gallbladder or bile-duct disease.",
      "A quarter teaspoon of turmeric in a cup is nothing like a curcumin capsule. Claims made for concentrated extracts do not transfer to this, in either direction.",
    ],
    avoidIf: [
      "You are allergic to ginger or turmeric",
      "You have gallstones or bile-duct obstruction",
      "A doctor has told you to avoid either of these",
    ],
    pregnancyAndChildren:
      "Cooking with turmeric and ginger is ordinary and fine. A concentrated decoction of both is a different thing — ask your doctor before taking it regularly in pregnancy, while breastfeeding, or giving it to a child.",
    maxDuration:
      "An occasional drink in cold weather. There is no treatment course here and no reason to keep it going day after day.",
    body: body([
      ["h2", "Food-level, and why that matters"],
      [
        "normal",
        "Haridra and ardraka — turmeric and ginger — are two of the most used substances in both the Indian kitchen and the Ayurvedic pharmacy, and a simmered decoction of the two is about as old and ordinary a winter drink as exists.",
      ],
      [
        "normal",
        "The confusing part is modern. Almost everything published about turmeric concerns curcumin extracts at doses many times what a quarter teaspoon provides, usually with piperine or a lipid to make it absorbable at all. None of that evidence belongs to this cup, and the honest position is that this is a warming, earthy drink with a long history and no demonstrated effect of its own. Strain it through something fine — turmeric sediment is gritty and unpleasant.",
      ],
    ]),
    seoTitle: "Turmeric & Ginger Kadha — Recipe & Cautions",
    metaDescription:
      "A gentle haldi and ginger kadha from kitchen ingredients — method, how much to drink, and the cautions that apply.",
  },

  {
    slug: "amla-ginger-herbal-tea",
    title: "Amla & Ginger Tea",
    excerpt:
      "A tangy, lightly warmed infusion pairing fresh Indian gooseberry with a small amount of ginger.",
    concerns: [],
    prepMinutes: 10,
    makes: "2 cups",
    ingredients: [
      ing("2 cups", "Water"),
      ing("1 small", "Fresh amla (Indian gooseberry)", "washed, deseeded and roughly chopped"),
      ing("¼ inch", "Fresh ginger", "thinly sliced"),
      ing("½ tsp in total", "Jaggery", "stirred in while warm", true),
    ],
    steps: [
      step("Wash the amla, deseed it and chop it roughly. Slice the ginger.", "3 minutes"),
      step("Bring the water to a boil and add the ginger.", "1 minute"),
      step("Simmer gently.", "3 minutes"),
      step("Switch off the heat, add the amla, cover and leave it to steep. It is added off the heat on purpose.", "2 minutes"),
      step("Strain, sweeten with the jaggery if you want to, and drink it warm.", "1 minute"),
    ],
    dosage:
      "One cup, occasionally, as a food-level infusion. There is no dose here and nothing to take it for on a schedule.",
    bestTime: ["morning", "after-food"],
    howLong:
      "The sourness is immediate. No claim is made about vitamin C or immunity — see below for why that claim is harder to make than it looks.",
    doshas: [],
    cautions: [
      "Sour enough to irritate a sensitive stomach, and hard on tooth enamel. Rinse your mouth with plain water afterwards.",
      "Check with your doctor about any medication-specific concerns. Amla is taken alongside a great many things in traditional practice, which is not the same as being known to be safe alongside them.",
    ],
    avoidIf: ["You are allergic or intolerant to amla or to ginger"],
    pregnancyAndChildren:
      "Eating amla as a food is one thing; a habitual medicinal preparation is another. Ask a professional before using this routinely in pregnancy, while breastfeeding, or for a child.",
    maxDuration:
      "Occasional use. Stop if it is uncomfortable, and get persistent symptoms assessed rather than brewing through them.",
    body: body([
      ["h2", "Why the amla goes in off the heat"],
      [
        "normal",
        "Amalaki is one of the most important single ingredients in Ayurveda — the first of the three fruits in triphala, and a rasayana in its own right. Ginger here is mostly contrast: a little warmth and aroma against what is otherwise an aggressively sour fruit.",
      ],
      [
        "normal",
        "Amla is famous for its vitamin C content, and that is exactly the claim this recipe does not make. Vitamin C degrades with heat and with time, and nobody has measured what survives this particular process — so the honest answer is that we do not know, and a page that tells you it is a vitamin C drink is telling you something it has not checked. Adding the fruit after the pan is off the flame is the sensible precaution either way, and it also keeps the tea from turning bitter.",
      ],
    ]),
    seoTitle: "Amla & Ginger Herbal Tea — Recipe",
    metaDescription:
      "Make an amla and ginger tea with fresh Indian gooseberry — ingredients, method and the precautions worth reading.",
  },
]

/**
 * The one concern these need and the dataset does not have.
 *
 * Seeded as a draft like the rest, and deliberately not referenced by any remedy in this script.
 *
 * Sanity validates strong references when the document is written, not when it is published, and
 * refuses a reference to a document that does not exist. A draft's id is `drafts.concern-digestion`
 * while a reference has to point at the published id `concern-digestion`, so a remedy written here
 * with the reference in place fails the whole transaction.
 *
 * The two ways around that are both worse than ticking a box. Publishing the concern up front puts
 * a description nobody has read on a live URL. Marking the reference `_weak` lets the write through
 * but also lets a remedy publish while the concern is still a draft, which renders a concern chip
 * pointing at nothing.
 */
const CONCERN = {
  _id: `drafts.${CONCERN_DIGESTION}`,
  _type: "concern",
  title: "Digestion & Bloating",
  icon: "🌿",
  order: 20,
  slug: { _type: "slug", current: "digestion" },
  description:
    "Bloating, heaviness after eating, irregularity and the sense that food is sitting rather than moving. Ayurveda treats digestion as the centre of health rather than one system among many: Agni, the digestive fire, is what turns food into something the body can use, and most of what follows here is about tending it — the timing of meals as much as their contents.",
}

/**
 * Checks the whole batch against the schema's own rules before anything is sent.
 *
 * The Studio enforces these, but it enforces them one document at a time at publish, which means a
 * bad field is found by a person at the end rather than by the script at the start.
 */
function validate() {
  const problems = []
  const slugs = new Set()

  for (const r of REMEDIES) {
    const at = (msg) => problems.push(`${r.slug}: ${msg}`)

    if (slugs.has(r.slug)) at("duplicate slug")
    slugs.add(r.slug)

    if (!r.title) at("missing title")
    if (!r.excerpt) at("missing excerpt")
    if (r.excerpt && r.excerpt.length > 300) at(`excerpt is ${r.excerpt.length} chars, max 300`)
    if (!r.dosage) at("missing dosage — it is required")
    if (!r.ingredients?.length) at("needs at least one ingredient")
    if (!r.steps?.length) at("needs at least one step")
    if (!r.cautions?.length) at("needs at least one caution")
    if (r.seoTitle && r.seoTitle.length > 60) at(`seoTitle is ${r.seoTitle.length} chars, warns over 60`)
    if (r.metaDescription && r.metaDescription.length > 155)
      at(`metaDescription is ${r.metaDescription.length} chars, warns over 155`)

    for (const t of r.bestTime ?? []) if (!BEST_TIME_VALUES.includes(t)) at(`unknown bestTime "${t}"`)
    for (const d of r.doshas ?? []) if (!DOSHA_VALUES.includes(d)) at(`unknown dosha "${d}"`)
    for (const i of r.ingredients ?? []) if (!i.item) at("an ingredient has no name")
    for (const s of r.steps ?? []) if (!s.text) at("a step has no text")
  }

  return problems
}

function buildMutations() {
  const mutations = [{ createIfNotExists: CONCERN }]

  REMEDIES.forEach((r, index) => {
    mutations.push({
      createIfNotExists: {
        _id: `drafts.remedy-${r.slug}`,
        _type: "remedy",
        title: r.title,
        slug: { _type: "slug", current: r.slug },
        excerpt: r.excerpt,
        remedyType: "drink",

        ingredients: r.ingredients.map((i, n) => ({
          _key: `ing${n}`,
          _type: "ingredient",
          item: i.item,
          ...(i.amount ? { amount: i.amount } : {}),
          ...(i.note ? { note: i.note } : {}),
          optional: Boolean(i.optional),
        })),
        steps: r.steps.map((s, n) => ({
          _key: `step${n}`,
          _type: "methodStep",
          text: s.text,
          ...(s.duration ? { duration: s.duration } : {}),
        })),
        prepMinutes: r.prepMinutes,
        makes: r.makes,
        dosage: r.dosage,
        bestTime: r.bestTime,
        howLong: r.howLong,
        ...(r.doshas?.length ? { doshas: r.doshas } : {}),

        cautions: r.cautions,
        avoidIf: r.avoidIf,
        pregnancyAndChildren: r.pregnancyAndChildren,
        maxDuration: r.maxDuration,

        body: r.body,

        author: { _type: "reference", _ref: AUTHOR },
        category: { _type: "reference", _ref: CATEGORY_TEAS },
        /**
         * `concerns` is deliberately not set here. See the note on CONCERN_DIGESTION: Sanity
         * rejects a strong reference to a document that does not exist, and the concern this
         * batch needs exists only as a draft — publishing it early to satisfy the write would
         * put unreviewed health copy on a live URL, and marking the reference weak would let a
         * published remedy carry a concern chip that resolves to nothing.
         *
         * The three entries that want it are named in the closing instructions instead.
         */
        publishedAt: publishedAt(index),
        featured: false,

        seoTitle: r.seoTitle,
        metaDescription: r.metaDescription,
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
    `Pranajiva — Teas & Decoctions\n` +
      `  project ${PROJECT_ID} / ${DATASET}\n` +
      `  1 concern   (draft)  Digestion & Bloating\n` +
      `  ${REMEDIES.length} remedies (drafts) filed under Teas & Decoctions\n` +
      `  validation passed\n`
  )

  if (DRY_RUN) {
    for (const r of REMEDIES) {
      const tagged = r.concerns?.length ? "digestion" : "—"
      console.log(
        `  ${r.slug.padEnd(34)} ${String(r.ingredients.length).padStart(2)} ing  ` +
          `${String(r.steps.length)} steps  ${String(r.cautions.length)} cautions  concerns: ${tagged}`
      )
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
        `  SANITY_WRITE_TOKEN=sk... node scripts/seed-pranajiva-teas.mjs\n`
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

  const resultBody = await res.json()
  if (!res.ok) {
    console.error(`Sanity refused the write (${res.status}):`)
    console.error(JSON.stringify(resultBody, null, 2))
    process.exit(1)
  }

  const created = (resultBody.results ?? []).filter((r) => r.operation === "create").length
  const left = (resultBody.results ?? []).length - created

  console.log(`Done.  ${created} created, ${left} already existed and were left untouched.`)
  const wantsConcern = REMEDIES.filter((r) => r.concerns?.length).map((r) => r.title)

  console.log(
    `\nNext, in OPS → Pranajiva → Knowledge:\n` +
      `  1. Read the "Digestion & Bloating" concern draft, edit the description if you want to,\n` +
      `     and publish it.\n` +
      `  2. On these three, tick Filing → Helps with → Digestion & Bloating:\n` +
      wantsConcern.map((t) => `       · ${t}\n`).join("") +
      `     None of the other seven get a concern — their own briefs rule out the immunity and\n` +
      `     anti-inflammatory claims that Cough & Cold or Immunity would imply.\n` +
      `  3. Read each remedy, add its cover image, then publish it.\n` +
      `\nImage prompts and alt text: docs/pranajiva-tea-image-briefs.md\n`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
