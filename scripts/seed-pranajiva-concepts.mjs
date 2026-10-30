/**
 * Seeds the Understanding half of the Knowledge Center — ten explanatory articles.
 *
 * Run: node scripts/seed-pranajiva-concepts.mjs --dry-run   (validates, writes nothing)
 *      node scripts/seed-pranajiva-concepts.mjs             (needs SANITY_WRITE_TOKEN)
 *
 * ── Why these ten, and not the seven chakras ───────────────────────────────────────────────────
 * Because these are the words the existing twenty-one entries already use and never define. The
 * Tulsi kadha says a heavy chest is "Kapha settling where it shouldn't". The CCF tea talks about
 * agni. The digestion concern explains itself in terms of agni, the immunity concern in terms of
 * Ojas, the joints concern in terms of Ama. Every one of those is currently a term dropped on a
 * reader with nowhere to go and look it up.
 *
 * Writing these first closes that loop and makes the cross-type rail do its job: a reader on the
 * cough kadha gets offered the explanation of why Kapha rises in winter, which is a different kind
 * of answer to the same question rather than a fourth tea.
 *
 * The chakras are the obvious next batch, and deliberately a batch of their own: there are seven of
 * them and they only make sense as a complete set. Three now and four later would read as an
 * abandoned series.
 *
 * ── Why articles need no safety fields but do need the disclaimer ──────────────────────────────
 * The schema gives remedies and practices required cautions because those are things a reader does
 * to their body. An explanation of Kapha is prose, so it has none — but it is still health writing
 * on a site that also sells, so it needs the standing disclaimer. The storefront gated that
 * disclaimer behind remedy-or-practice, which was fine while no articles existed and wrong the
 * moment one did; that gate has been removed in the same change as this script.
 *
 * These are written as descriptions of what the tradition holds, not as claims about physiology.
 * That distinction is the whole editorial line of this batch, and it is why nothing below says a
 * dosha has been measured.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const PROJECT_ID = "dlrwy20z"
const DATASET = "production"
const API_VERSION = "2024-10-01"

const DRY_RUN = process.argv.includes("--dry-run")

const AUTHOR = "2b1332fa-bee2-4596-85b9-8fecc47e4e84"

/**
 * Two new sections, published immediately.
 *
 * A category is a neutral label that needs nobody's review, and every article requires one before
 * it can be published. Same call the teas and pranayama batches made.
 */
const CATEGORIES = [
  {
    _id: "category-doshas",
    _type: "category",
    title: "Doshas & Constitution",
    slug: { _type: "slug", current: "doshas" },
    description: "Vata, Pitta and Kapha, and how to read your own balance.",
  },
  {
    _id: "category-core-concepts",
    _type: "category",
    title: "Core Concepts",
    slug: { _type: "slug", current: "core-concepts" },
    description: "Agni, Ojas, Ama, Rasa — the vocabulary the rest of this rests on.",
  },
]

/**
 * Concerns that are already published, so these references can be written now.
 *
 * Five of the ten articles can be tagged immediately because Cough & Cold, Digestion & Bloating and
 * Immunity are live. The rest want Stress, Sleep and Low Energy, which are still drafts — those are
 * in link-pranajiva-concerns.mjs and attach on the next run after they are published.
 *
 * These five are the ones that matter most anyway: they are what finally gives the cross-type rail
 * something to show. Until now every live entry was a remedy, so "Pairs well with this" could only
 * offer more teas.
 */
const CONCERN_COUGH = "024c9b06-4137-4592-9bef-7ea22781e9df"
const CONCERN_IMMUNITY = "5cb4a17e-e169-41d0-8215-671c98e36389"
const CONCERN_DIGESTION = "concern-digestion"

function fact(label, value) {
  return { label, value }
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

const publishedAt = (i) => new Date(Date.now() - 60_000 - i * 4 * 60_000).toISOString()

const ARTICLES = [
  {
    slug: "three-doshas-vata-pitta-kapha",
    title: "The Three Doshas",
    category: "category-doshas",
    excerpt:
      "Vata, Pitta and Kapha — what the three doshas actually describe, and why Ayurveda treats the imbalance rather than the person.",
    concerns: [],
    keyFacts: [
      fact("Vata", "Air and ether — movement, breath, nerve impulse, elimination"),
      fact("Pitta", "Fire and water — digestion, metabolism, heat, perception"),
      fact("Kapha", "Earth and water — structure, lubrication, stamina, immunity"),
      fact("The word", "Dosha means, roughly, that which can go out of balance"),
      fact("Everyone has", "All three, in a proportion particular to them"),
    ],
    body: body([
      [
        "normal",
        "Almost everything else in this section refers back to these three words, so this is the page to read first. A dosha is not a substance and not an organ. It is a category of function — a way of grouping what the body does by the kind of activity involved.",
      ],
      ["h2", "What each one covers"],
      [
        "normal",
        "Vata is everything that moves. Breath, blood, nerve impulse, food through the gut, waste out of it, and thought across a mind. Its elements are air and ether, and its qualities are dry, light, cold and mobile — which is why Vata trouble tends to show up as dryness, irregularity and restlessness.",
      ],
      [
        "normal",
        "Pitta is everything that transforms. Digestion in the obvious sense, metabolism in the broader one, body heat, and the processing of what the eyes and mind take in. Fire and water, hot and sharp — so Pitta trouble shows up as burning, inflammation, acidity and a short temper.",
      ],
      [
        "normal",
        "Kapha is everything that holds. Structure, the fluid that cushions a joint, the mucous membrane that lines a lung, fat, stamina and steadiness. Earth and water, heavy and slow — so Kapha trouble shows up as congestion, heaviness, sluggishness and accumulation.",
      ],
      ["h2", "Why it is a proportion and not a type"],
      [
        "normal",
        "You have all three. Every person needs movement, transformation and structure, and a body with no Kapha would have nothing to hold it together. What differs is the ratio, and the quizzes that assign you a single dosha are compressing that ratio into a label it does not fit.",
      ],
      [
        "normal",
        "The ratio also matters less than the change in it. Ayurveda is interested in which dosha is currently running high relative to your own baseline — not in placing you in one of three boxes. That distinction has its own page, because it is the one most often lost.",
      ],
      ["h2", "How to read the rest of this section"],
      [
        "normal",
        "Every remedy and practice here says which constitutions it generally suits, and that field is this framework in use. A warming, drying kadha suits Vata and Kapha and can aggravate Pitta; a cooling floral infusion is the reverse. None of that is a diagnosis — it is a description of direction, and the useful question is always which direction you currently need.",
      ],
    ]),
    seoTitle: "The Three Doshas — Vata, Pitta & Kapha Explained",
    metaDescription:
      "What Vata, Pitta and Kapha actually describe, why everyone has all three, and how to read the dosha notes on a remedy.",
  },

  {
    slug: "vata-dosha",
    title: "Vata — the Dosha of Movement",
    category: "category-doshas",
    excerpt:
      "Dry, light, cold and mobile. What Vata governs, the signs it has risen, and why warmth, oil and routine are the usual answer.",
    concerns: [],
    keyFacts: [
      fact("Elements", "Air and ether"),
      fact("Qualities", "Dry, light, cold, rough, subtle, mobile"),
      fact("Governs", "Breath, circulation, nerve impulse, elimination, thought"),
      fact("Seat in the body", "Colon and pelvis, also bones, skin and ears"),
      fact("Rises", "Autumn and early winter; 2–6am and 2–6pm; later life"),
      fact("Signs it is high", "Dry skin, constipation, broken sleep, restlessness, cold hands, cracking joints"),
      fact("Settled by", "Warmth, oil, weight, regularity; sweet, sour and salty tastes"),
    ],
    body: body([
      [
        "normal",
        "Vata is the dosha of movement, and it is the one most easily disturbed — which is why it accounts for the majority of what Ayurveda treats. Air and ether give it its qualities: dry, light, cold, rough and above all mobile.",
      ],
      ["h2", "What high Vata looks like"],
      [
        "normal",
        "The pattern is irregularity. Sleep that comes late and breaks at three in the morning. Digestion that is fine for a week and then is not. Energy in bursts followed by nothing. Skin and lips that go dry, joints that crack, hands and feet that stay cold, and a mind that will not stop producing thoughts it does not need.",
      ],
      [
        "normal",
        "Anxiety belongs on that list, and Ayurveda puts it there for a structural reason rather than a poetic one: the same dosha governs nerve impulse and the movement of thought, so a body running high in Vata and a mind that will not settle are read as one phenomenon rather than two.",
      ],
      ["h2", "Why the remedies look the way they do"],
      [
        "normal",
        "The approach is to supply the opposite qualities, and this is the single most useful principle in Ayurveda. Dry is met with oil. Cold with warmth. Light with weight and substance. Mobile with routine.",
      ],
      [
        "normal",
        "Which explains why Vata advice is so unglamorous and so repetitive. Warm cooked food rather than salads. Oil on the skin. Meals at the same times. Bed at the same hour. Nothing on that list is interesting, and the regularity is doing more work than any single item on it.",
      ],
      ["h2", "When Vata rises"],
      [
        "normal",
        "Autumn and early winter are the Vata season — dry, cold, windy. Two to six, morning and afternoon, are the Vata hours, which is why three in the morning is the classic time to be awake and unable to stop thinking. And Vata increases with age, which is the tradition's account of why skin thins, joints dry and sleep lightens over a life.",
      ],
      [
        "normal",
        "None of this has been demonstrated in a laboratory. It is a framework for noticing a pattern across season, time of day and stage of life — and as a way of noticing, it is genuinely useful even to someone who holds the physiology at arm's length.",
      ],
    ]),
    seoTitle: "Vata Dosha — Signs, Qualities & What Settles It",
    metaDescription:
      "What Vata governs, how high Vata shows up in sleep, skin and digestion, and why warmth, oil and routine are the answer.",
  },

  {
    slug: "pitta-dosha",
    title: "Pitta — the Dosha of Transformation",
    category: "category-doshas",
    excerpt:
      "Hot, sharp and penetrating. What Pitta governs, how it shows when it runs high, and why the answer is cooling and moderation.",
    concerns: [],
    keyFacts: [
      fact("Elements", "Fire and water"),
      fact("Qualities", "Hot, sharp, light, slightly oily, liquid, spreading"),
      fact("Governs", "Digestion, metabolism, body heat, vision, intellect, drive"),
      fact("Seat in the body", "Small intestine and stomach, also liver, blood, eyes and skin"),
      fact("Rises", "Summer; 10am–2pm and 10pm–2am; middle life"),
      fact("Signs it is high", "Acidity, loose stools, skin inflammation, overheating, irritability, early greying"),
      fact("Settled by", "Cooling, moderation, shade; sweet, bitter and astringent tastes"),
    ],
    body: body([
      [
        "normal",
        "Pitta is the dosha of transformation — the capacity to take something in and convert it into something usable. Food into tissue, obviously, but also light into sight and information into understanding. Fire and water, hot and sharp.",
      ],
      ["h2", "What high Pitta looks like"],
      [
        "normal",
        "Heat and sharpness, in whatever tissue it has settled in. In the gut: acidity, reflux, burning, loose stools. In the skin: inflammation, rashes, redness, breakouts. In the eyes: burning and sensitivity to light. In the temperament: impatience, criticism, a short fuse and a tendency to argue when tired.",
      ],
      [
        "normal",
        "Pitta types are also the ones most likely to overdo things, because the drive is part of the dosha. The classic picture is someone who skips lunch to finish something, becomes irritable by three, and eats badly at nine — a pattern Ayurveda reads as Pitta aggravating itself.",
      ],
      ["h2", "Why moderation is the medicine"],
      [
        "normal",
        "Opposite qualities again: cool against hot, soft against sharp, steady against spreading. In practice that means cooling foods, real shade in summer, bitter and astringent tastes, and not letting hunger build until it turns into irritation.",
      ],
      [
        "normal",
        "It is also why so much Pitta advice is about restraint rather than addition. Strong spices, long hours, too much sun, competitive exercise, alcohol and skipped meals all push in the same direction. The intervention is usually to remove something, which is a harder prescription to follow than a tea.",
      ],
      ["h2", "A note on the cooling remedies here"],
      [
        "normal",
        "Several entries in this library are described as suiting Pitta — the hibiscus and rose infusion, the rose and fennel tea, Sheetali breath, Chandra Bhedana. What they share is direction rather than ingredient: all of them cool, soften or slow. The warming ones, the kadhas and Kapalbhati, do the opposite, and are the ones to go lightly on in a Pitta summer.",
      ],
    ]),
    seoTitle: "Pitta Dosha — Signs, Qualities & What Cools It",
    metaDescription:
      "What Pitta governs, how high Pitta shows in digestion, skin and temper, and why cooling and moderation are the answer.",
  },

  {
    slug: "kapha-dosha",
    title: "Kapha — the Dosha of Structure",
    category: "category-doshas",
    excerpt:
      "Heavy, cold, slow and dense. What Kapha holds together, why it settles in the chest in winter, and what shifts it.",
    concerns: [CONCERN_COUGH],
    keyFacts: [
      fact("Elements", "Earth and water"),
      fact("Qualities", "Heavy, slow, cold, oily, smooth, dense, stable"),
      fact("Governs", "Structure, lubrication, fluid balance, stamina, immunity, patience"),
      fact("Seat in the body", "Chest and stomach, also sinuses, joints and fat tissue"),
      fact("Rises", "Late winter and spring; 6–10am and 6–10pm; childhood"),
      fact("Signs it is high", "Congestion, mucus, heaviness, sluggish digestion, oversleeping, weight gain"),
      fact("Settled by", "Warmth, dryness, movement, stimulation; pungent, bitter and astringent tastes"),
    ],
    body: body([
      [
        "normal",
        "Kapha is what holds you together. The structure of tissue, the fluid that cushions a joint, the membrane lining a lung, fat, stamina, and the steadiness of a person who is hard to rattle. Earth and water — heavy, cold, slow and dense.",
      ],
      [
        "normal",
        "It is also the dosha behind most of what this library has to say about coughs, which is why that section keeps using the word.",
      ],
      ["h2", "Why a heavy chest is read as Kapha"],
      [
        "normal",
        "A loose, chesty cough with thick mucus, a blocked nose, a heavy head and no appetite is, in Ayurvedic terms, Kapha accumulating where it should not be — in the chest and the sinuses — usually with weakened agni behind it. The qualities match exactly: heavy, cold, wet, slow.",
      ],
      [
        "normal",
        "Which is why the remedies go the other way. Warming, drying, light and pungent. Ginger, pepper, tulsi, steam, a lighter diet while it clears. It is also why the same kadha is the wrong choice for a dry, barking cough, where there is no Kapha to shift and the dryness is Vata — the single most useful thing on that page is the line saying so.",
      ],
      ["h2", "Late winter, and six in the morning"],
      [
        "normal",
        "Kapha season is late winter into spring, which is the tradition's account of why congestion and colds cluster then and why spring is the classic time for lightening and clearing practices. Six to ten, morning and evening, are the Kapha hours — so waking at half past eight into heaviness is expected rather than a failing, and waking before six is the standard advice for anyone who runs Kapha.",
      ],
      [
        "normal",
        "Childhood is the Kapha stage of life, which is given as the reason children produce so much mucus and recover so quickly.",
      ],
      ["h2", "What shifts it"],
      [
        "normal",
        "Everything Kapha is not: heat, dryness, lightness, stimulation and movement. Warm and well-spiced food rather than cold, sweet and heavy. Less dairy while congested. Up early. And actual exertion — of the three doshas, Kapha is the one where exercise is not optional, because the quality being countered is inertia.",
      ],
    ]),
    seoTitle: "Kapha Dosha — Signs, Qualities & What Shifts It",
    metaDescription:
      "What Kapha governs, why Ayurveda reads a heavy chest and a loose cough as Kapha, and the warming, drying answer to it.",
  },

  {
    slug: "prakriti-and-vikriti",
    title: "Prakriti & Vikriti — Your Nature and Your Current State",
    category: "category-doshas",
    excerpt:
      "The distinction most dosha quizzes lose: what you were born with, what is happening now, and why only one of the two is treatable.",
    concerns: [],
    keyFacts: [
      fact("Prakriti", "Your constitution, set at conception — considered fixed for life"),
      fact("Vikriti", "Your present state, which shifts with season, age, food and stress"),
      fact("Which is treated", "Vikriti. Prakriti is context, not a problem"),
      fact("Traditionally assessed by", "A vaidya, through pulse, tongue, eyes, build and history"),
      fact("The common error", "Reading a quiz result as prakriti when it is describing vikriti"),
    ],
    body: body([
      [
        "normal",
        "This is the distinction that makes the dosha framework usable, and it is the one almost always missing from the places people first meet it.",
      ],
      ["h2", "Two different questions"],
      [
        "normal",
        "Prakriti is what you are made of — the proportion of Vata, Pitta and Kapha you were born with. Ayurveda holds it to be fixed. It is the reason one person has run warm and slept lightly their whole life while another has always been solid and slow to wake.",
      ],
      [
        "normal",
        "Vikriti is what is happening at the moment. It moves with the season, the week, the last few meals, how much sleep you have had and what you are carrying. It is the departure from your own baseline, and it is the thing that can be changed.",
      ],
      ["h2", "Why it matters more than it sounds"],
      [
        "normal",
        "Because the advice differs, sometimes completely. A person of Pitta prakriti with high Kapha vikriti in March needs warming, drying, stimulating things — the opposite of what a page about Pitta would tell them. Treating the constitution instead of the current state is the most common way this framework is applied backwards.",
      ],
      [
        "normal",
        "It also removes the main objection to the whole system. Nobody is being sorted into a personality type. The question is not what you are; it is what has shifted, relative to how you normally are.",
      ],
      ["h2", "About the quizzes"],
      [
        "normal",
        "An online dosha quiz asks how you feel now, so it measures vikriti and reports it as prakriti. That is why the answer changes when you take it again in a different season — which looks like the quiz being unreliable and is actually it measuring the thing that is supposed to move.",
      ],
      [
        "normal",
        "Prakriti is traditionally determined by a vaidya over a conversation, reading the pulse, the tongue, the eyes, the build and a life history. If you want to use these pages without any of that, the practical approach is to skip prakriti entirely and ask only which qualities are currently excessive — dry, hot, or heavy. That question you can answer honestly about yourself, and it is the one the remedies here are organised around.",
      ],
    ]),
    seoTitle: "Prakriti & Vikriti — Constitution vs Current State",
    metaDescription:
      "The difference between the constitution you are born with and the imbalance you have now, and why only one of them is treated.",
  },

  {
    slug: "agni-digestive-fire",
    title: "Agni — the Digestive Fire",
    category: "category-core-concepts",
    excerpt:
      "Ayurveda's central idea: that health follows from what you can actually digest, not from what you manage to eat.",
    concerns: [CONCERN_DIGESTION],
    keyFacts: [
      fact("The word", "Agni — fire"),
      fact("What it refers to", "The whole digestive and metabolic capacity, not one organ"),
      fact("Principal seat", "The stomach and small intestine, called jatharagni"),
      fact("Strong agni", "Clear appetite at mealtimes, comfortable digestion, steady energy, clean tongue"),
      fact("Weak agni (mandagni)", "Heaviness after food, coated tongue, irregularity, fatigue, dull appetite"),
      fact("Tended by", "Eating to appetite, warm food, the main meal at midday, leaving gaps between meals"),
    ],
    body: body([
      [
        "normal",
        "If there is one idea to take from Ayurveda, it is this one. Health is not determined by what you eat; it is determined by what you can digest. Food you cannot process does not become nutrition — it becomes a burden, and the tradition has a separate word for that residue.",
      ],
      ["h2", "Not a metaphor for the stomach"],
      [
        "normal",
        "Agni means fire, and it refers to the body's whole capacity to break things down and convert them — digestion in the gut, metabolism in the tissues, and the processing of experience in the mind. Jatharagni, the fire of the stomach and small intestine, is the principal one and the one these pages mean.",
      ],
      [
        "normal",
        "The test of it is simple and you already know the answer. Do you get hungry at mealtimes? Is eating followed by energy or by wanting to lie down? Is your tongue clear in the morning? Those three questions are, in traditional terms, an assessment of agni.",
      ],
      ["h2", "How it is weakened"],
      [
        "normal",
        "Mostly by habits rather than by food. Eating when the last meal has not finished digesting. Grazing, so the fire never goes out and never gets going. Cold drinks with hot food. Eating when upset or in a hurry. The largest meal at night, when digestive capacity is at its lowest. And simply too much, too often.",
      ],
      [
        "normal",
        "Notice that almost none of that is about which foods. Ayurveda is far more interested in when and how much, which is the part modern nutrition advice tends to leave out.",
      ],
      ["h2", "How it is tended"],
      [
        "normal",
        "Eat when you are hungry and not otherwise. Make the midday meal the largest, because agni is held to follow the sun and be strongest when it is highest. Leave three or four hours between meals and nothing in between. Prefer food warm and cooked over cold and raw, especially in winter. Stop before you are full.",
      ],
      [
        "normal",
        "This is also why so many of the remedies in this library are warm, spiced and taken after food. A kadha of ginger and pepper, or a tea of cumin, coriander and fennel, is understood as supporting agni rather than as treating a symptom — and it is why none of them will do much for someone eating a large meal at eleven at night.",
      ],
    ]),
    seoTitle: "Agni — Ayurveda's Digestive Fire, Explained",
    metaDescription:
      "Why Ayurveda treats digestion as the centre of health, how to tell whether your agni is strong, and what weakens it.",
  },

  {
    slug: "ama-undigested-residue",
    title: "Ama — What Incomplete Digestion Leaves Behind",
    category: "category-core-concepts",
    excerpt:
      "The coating on your tongue in the morning, and what Ayurveda thinks it means. Ama, how it accumulates, and how it clears.",
    concerns: [CONCERN_DIGESTION],
    keyFacts: [
      fact("The word", "Ama — raw, uncooked, unripe"),
      fact("What it refers to", "The residue of food the body could not fully process"),
      fact("Caused by", "Weak agni, overeating, eating too soon after the last meal, cold and heavy food"),
      fact("Classic signs", "A coating on the tongue on waking, heaviness, dull appetite, bad breath, aching"),
      fact("Cleared by", "Rest from food, warmth, bitter and pungent tastes, and time"),
      fact("Not the same as", "Toxins in the modern detox sense"),
    ],
    body: body([
      [
        "normal",
        "Ama is the counterpart to agni, and the two only make sense together. Where agni is the capacity to digest, ama is what is left when that capacity falls short: food that has been taken in but not properly transformed.",
      ],
      ["h2", "Look at your tongue"],
      [
        "normal",
        "The classic sign is a white or grey coating on the tongue first thing in the morning, before eating or drinking. Alongside it: waking unrefreshed, no appetite at breakfast but eating anyway out of habit, a heaviness in the limbs, a dull ache with no injury behind it, and breath that is off.",
      ],
      [
        "normal",
        "This is the single most checkable idea in Ayurveda. You can look, today, and the answer tends to track what you ate last night more closely than people expect.",
      ],
      ["h2", "How it accumulates"],
      [
        "normal",
        "Through the ordinary things: a meal larger than the appetite that called for it, eating again before the previous meal has cleared, food that is cold or heavy or both, and eating late. None of it is dramatic, which is why ama is described as building up gradually rather than arriving.",
      ],
      [
        "normal",
        "Where it goes matters too. Ama is held to lodge in the joints, which is the traditional reading of stiffness that is worse in the morning and better with movement, and in the channels, which is given as the reason it produces a general heaviness rather than one clear symptom.",
      ],
      ["h2", "How it clears, and what that is not"],
      [
        "normal",
        "By giving digestion less to do and more heat to do it with. A lighter day. Warm water. Bitter and pungent tastes, which are described as drying and scraping. Gaps between meals that are actually empty. And time — ama is understood to clear over days, not in a session.",
      ],
      [
        "normal",
        "It is worth being clear about what this is not. Ama is not a toxin in the sense the wellness industry uses the word, and nothing here endorses a cleanse, a juice fast or a supplement that promises to remove it. The traditional approach is the unexciting one: eat less, eat warm, wait. If a coated tongue persists for weeks alongside real symptoms, that is a reason to see a doctor rather than to fast harder.",
      ],
    ]),
    seoTitle: "Ama — the Coated Tongue and What It Means",
    metaDescription:
      "What ama is in Ayurveda, why a coated tongue is its classic sign, how it accumulates, and the unexciting way it clears.",
  },

  {
    slug: "ojas-vitality-reserve",
    title: "Ojas — the Reserve Behind Resilience",
    category: "category-core-concepts",
    excerpt:
      "Why Ayurveda frames immunity as something built over months rather than boosted in a week, and what it says builds it.",
    concerns: [CONCERN_IMMUNITY],
    keyFacts: [
      fact("The word", "Ojas — vigour, essence"),
      fact("What it refers to", "The refined end-product of properly digested food; the body's reserve"),
      fact("Built by", "Sound digestion, enough sleep, unhurried meals, contentment"),
      fact("Depleted by", "Too little sleep, overwork, grief, excessive exercise, irregular eating"),
      fact("Signs it is good", "Steady energy, a settled mind, quick recovery, clear complexion"),
      fact("Timescale", "Months. Nothing builds Ojas in a week"),
    ],
    body: body([
      [
        "normal",
        "Ojas is what Ayurveda means by resilience, and it is the reason this library's immunity section is about building rather than fighting.",
      ],
      ["h2", "The end of a long process"],
      [
        "normal",
        "The traditional account is sequential. Food is digested by agni, becomes rasa, and is refined through the tissues step by step; Ojas is the final, most concentrated product of that chain. Which has a consequence worth sitting with: you cannot take Ojas directly. It is made from food you have actually digested, so anything that undermines digestion undermines it, however good the food was.",
      ],
      [
        "normal",
        "This is the structural answer to why Ayurveda is unenthusiastic about supplements and tonics taken by someone sleeping five hours and eating at eleven at night. The input is not the constraint; the processing is.",
      ],
      ["h2", "What it looks like"],
      [
        "normal",
        "Energy that is steady rather than spiky. Catching what is going round less often, and recovering faster when you do. A mind that settles. Skin and eyes that look well rather than merely clean. And a tolerance for a bad week without falling over.",
      ],
      [
        "normal",
        "Low Ojas is the reverse, and the description is familiar: run down, catching everything, slow to recover, anxious without a reason to be, tired in a way that sleep does not touch.",
      ],
      ["h2", "What builds it"],
      [
        "normal",
        "Sleep, first — the tradition is unusually insistent on this, and particularly on being asleep before the Pitta hours begin around ten. Then regular meals you actually digest, eaten without hurry. Ghee, milk, dates, almonds and other foods described as nourishing. Oil on the skin. And contentment, which appears in the classical lists beside the foods rather than as an afterthought.",
      ],
      [
        "normal",
        "What depletes it is as specific: too little sleep, sustained overwork, grief, fear, exercise past the point of strain, and eating at erratic hours. Several of those are not food at all, which is the point — Ojas is the concept through which Ayurveda connects how you live to how robust you are.",
      ],
      [
        "normal",
        "And it is slow. Months, not a fortnight. Of everything in this library, the immunity section is the one where consistency over a season matters more than anything you can do today, and that is a direct consequence of what Ojas is held to be.",
      ],
    ]),
    seoTitle: "Ojas — Why Ayurveda Builds Immunity Slowly",
    metaDescription:
      "What Ojas means, why it cannot be taken directly, what builds and depletes it, and why resilience is a matter of months.",
  },

  {
    slug: "six-tastes-shad-rasa",
    title: "The Six Tastes",
    category: "category-core-concepts",
    excerpt:
      "Sweet, sour, salty, pungent, bitter and astringent — what each one does, and why a meal is meant to contain all six.",
    concerns: [CONCERN_DIGESTION],
    keyFacts: [
      fact("Sweet — madhura", "Earth and water. Builds, grounds, nourishes. Grains, milk, dates"),
      fact("Sour — amla", "Earth and fire. Stimulates appetite, aids digestion. Lemon, tamarind, yoghurt"),
      fact("Salty — lavana", "Water and fire. Moistens, warms, carries flavour. Salt, seaweed"),
      fact("Pungent — katu", "Fire and air. Heats, dries, clears. Ginger, pepper, chilli, ajwain"),
      fact("Bitter — tikta", "Air and ether. Cools, dries, clears. Neem, turmeric, leafy greens"),
      fact("Astringent — kashaya", "Air and earth. Dries, tightens, firms. Lentils, pomegranate, tea"),
      fact("The principle", "All six at every main meal, in proportions that suit the season and the person"),
    ],
    body: body([
      [
        "normal",
        "Ayurveda classifies food by taste, and treats taste as information rather than preference: each of the six is made of two elements and does something specific to the body. A meal containing all six is held to be complete in a way that a meal of two is not.",
      ],
      ["h2", "Why six and not four"],
      [
        "normal",
        "The familiar list — sweet, sour, salty, bitter — leaves out the two that do most of the work in Indian cooking. Pungent is the heat of ginger, pepper and chilli: it warms, dries and clears, which is why it dominates the cold-weather remedies in this library. Astringent is the drying, mouth-puckering quality of lentils, pomegranate and strong tea, and it is the one most people have never consciously noticed.",
      ],
      [
        "normal",
        "Between them they explain a great deal about a plate of Indian food, which is usually assembled to hit all six without anyone having to think about it — rice sweet, pickle sour, salt, a dry spiced vegetable pungent, greens or methi bitter, dal astringent.",
      ],
      ["h2", "How the tastes meet the doshas"],
      [
        "normal",
        "Each dosha is settled by three of the six and aggravated by the other three, and this is the practical use of the whole framework. Vata is settled by sweet, sour and salty — warm, moist, grounding — and aggravated by pungent, bitter and astringent, which are drying. Pitta is settled by sweet, bitter and astringent, the cooling three, and aggravated by pungent, sour and salty. Kapha is settled by pungent, bitter and astringent, which dry and lighten, and aggravated by sweet, sour and salty.",
      ],
      [
        "normal",
        "Read that against the remedies here and they stop looking arbitrary. A pepper and ginger kadha is pungent, so it suits Kapha and will aggravate Pitta. A rose and fennel infusion is sweet and astringent, so it suits Pitta. The dosha note on each entry is this table applied.",
      ],
      ["h2", "What to do with it"],
      [
        "normal",
        "Not calculate. The useful version is much looser: notice which taste your diet almost never contains, and add it. For most people eating a modern diet, that is bitter — the taste that has been bred out of vegetables and designed out of processed food, and the one classical texts treat as the most cleansing of the six.",
      ],
      [
        "normal",
        "Sweet, meanwhile, means far more than sugar. Grains, milk, root vegetables and most fruit are sweet in this system, and the sweet taste is the one that builds tissue. It is also the easiest to overdo, which is the traditional reading of why a diet heavy in it produces Kapha.",
      ],
    ]),
    seoTitle: "The Six Tastes of Ayurveda — Shad Rasa Explained",
    metaDescription:
      "Sweet, sour, salty, pungent, bitter and astringent: what each taste does, which dosha it settles, and why all six belong in a meal.",
  },

  {
    slug: "dinacharya-ayurvedic-daily-routine",
    title: "Dinacharya — the Shape of an Ayurvedic Day",
    category: "category-core-concepts",
    excerpt:
      "Waking, eating and sleeping in an order the body can rely on — and why Ayurveda treats the timing as the active ingredient.",
    concerns: [],
    keyFacts: [
      fact("The word", "Dinacharya — daily conduct"),
      fact("Wake", "Before sunrise, in the Vata hours, rather than in the Kapha hours after six"),
      fact("First", "Water, elimination, scrape the tongue, clean the teeth"),
      fact("Then", "Oil on the skin, movement, breath — before the day starts making demands"),
      fact("Main meal", "Midday, when agni is held to be strongest"),
      fact("Evening", "Lighter food, early, then a wind-down rather than a stop"),
      fact("Sleep", "By about ten, before the Pitta hours begin"),
      fact("The principle", "Regularity matters more than any single element of it"),
    ],
    body: body([
      [
        "normal",
        "Dinacharya is the Ayurvedic daily routine, and it is the framework the rest of this library sits inside. Nearly every remedy here specifies a time — on waking, after food, before bed — and those instructions are not incidental. In this system, when you do something is part of what you are doing.",
      ],
      ["h2", "The day in three cycles"],
      [
        "normal",
        "Each dosha is held to govern two periods of the day, twice over. Kapha runs from six to ten, morning and evening: heavy, slow, settled. Pitta from ten to two: sharp, hot, productive. Vata from two to six: light, mobile, unsettled.",
      ],
      [
        "normal",
        "Most of dinacharya follows from that. Wake before six, in the Vata hours, because waking after it means waking into Kapha and feeling heavy regardless of how long you slept. Eat the main meal between ten and two, when Pitta governs and digestive capacity is held to be highest. Be asleep by ten, before Pitta returns at night — the tradition's account of why staying up past it brings a second wind and then a hungry, restless hour.",
      ],
      ["h2", "The morning sequence"],
      [
        "normal",
        "Water first, warm, before anything else. Then elimination, which the routine assumes follows from the water and the hour. Scrape the tongue — which is also the moment to look at what is on it, since that is the ama check. Teeth. Then oil on the skin if you have time for it, some movement, and breath work before the day begins asking for things.",
      ],
      [
        "normal",
        "None of these are difficult. The reason they are written as a sequence rather than a list is that the order is what makes them happen at all.",
      ],
      ["h2", "Why regularity is the point"],
      [
        "normal",
        "If you take one thing from this page, it is that the consistency is doing more work than any item. A body that is fed, rested and woken at predictable times is described as having less Vata to contend with, and Vata — irregularity — is the dosha most of this system is trying to settle.",
      ],
      [
        "normal",
        "Which also means a partial dinacharya kept every day beats a complete one kept twice a week. The honest starting point is two things: a fixed wake time and the largest meal at midday. Those two reshape a day more than the rest combined, and everything else can be added later or not at all.",
      ],
    ]),
    seoTitle: "Dinacharya — the Ayurvedic Daily Routine",
    metaDescription:
      "The Ayurvedic day: when to wake, eat and sleep, the dosha clock behind it, and why regularity does most of the work.",
  },
]

function validate() {
  const problems = []
  const slugs = new Set()
  const categoryIds = CATEGORIES.map((c) => c._id)

  for (const a of ARTICLES) {
    const at = (msg) => problems.push(`${a.slug}: ${msg}`)

    if (slugs.has(a.slug)) at("duplicate slug")
    slugs.add(a.slug)

    if (!a.title) at("missing title")
    if (!a.excerpt) at("missing excerpt")
    if (a.excerpt && a.excerpt.length > 300) at(`excerpt is ${a.excerpt.length} chars, max 300`)
    if (!categoryIds.includes(a.category)) at(`category "${a.category}" is not one this script creates`)
    if (!a.body?.length) at("has no body")
    if (a.seoTitle && a.seoTitle.length > 60) at(`seoTitle is ${a.seoTitle.length} chars, warns over 60`)
    if (a.metaDescription && a.metaDescription.length > 155)
      at(`metaDescription is ${a.metaDescription.length} chars, warns over 155`)

    for (const f of a.keyFacts ?? []) {
      if (!f.label) at("a key fact has no label")
      if (!f.value) at("a key fact has no value")
    }
  }

  return problems
}

function buildMutations() {
  const mutations = CATEGORIES.map((c) => ({ createIfNotExists: c }))

  ARTICLES.forEach((a, index) => {
    mutations.push({
      createIfNotExists: {
        _id: `drafts.article-${a.slug}`,
        _type: "article",
        title: a.title,
        slug: { _type: "slug", current: a.slug },
        excerpt: a.excerpt,
        ...(a.keyFacts?.length
          ? {
              keyFacts: a.keyFacts.map((f, n) => ({
                _key: `fact${n}`,
                _type: "keyFact",
                label: f.label,
                value: f.value,
              })),
            }
          : {}),
        body: a.body,

        author: { _type: "reference", _ref: AUTHOR },
        category: { _type: "reference", _ref: a.category },
        ...(a.concerns?.length
          ? {
              concerns: a.concerns.map((c, n) => ({
                _key: `con${n}`,
                _type: "reference",
                _ref: c,
              })),
            }
          : {}),
        publishedAt: publishedAt(index),
        featured: false,

        seoTitle: a.seoTitle,
        metaDescription: a.metaDescription,
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
  const tagged = ARTICLES.filter((a) => a.concerns?.length).length

  console.log(
    `Pranajiva — Understanding\n` +
      `  project ${PROJECT_ID} / ${DATASET}\n` +
      `  ${CATEGORIES.length} categories (published)  ${CATEGORIES.map((c) => c.title).join(", ")}\n` +
      `  ${ARTICLES.length} articles  (drafts)\n` +
      `  ${tagged} already tagged with a published concern\n` +
      `  validation passed\n`
  )

  if (DRY_RUN) {
    for (const a of ARTICLES) {
      const cat = CATEGORIES.find((c) => c._id === a.category).title
      console.log(
        `  ${a.slug.padEnd(38)} ${cat.padEnd(22)} ${String((a.keyFacts ?? []).length).padStart(2)} facts  ` +
          `${String(a.body.length).padStart(2)} blocks  concerns: ${a.concerns?.length ?? 0}`
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
      `  1. Read each article and publish it. Two new sections appear in the index directory as\n` +
      `     soon as the first article in each goes live.\n` +
      `  2. The five tagged ones are what make "Pairs well with this" work across types for the\n` +
      `     first time — the cough kadha will start offering the Kapha explainer.\n` +
      `  3. Publish the Stress, Sleep and Low Energy concern drafts, then run\n` +
      `     node scripts/link-pranajiva-concerns.mjs to finish the tagging.\n`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
