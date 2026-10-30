import type { SlugValidationContext } from "sanity"
import { defineField } from "sanity"

import { SANITY_API_VERSION } from "../env"

/**
 * Field groups and option lists shared by the Knowledge Center document types.
 *
 * ── Why these are builders rather than one base document ───────────────────────────────────────
 * Sanity has no document inheritance, and the usual workaround — a single `entry` type with a
 * "kind" dropdown and every field for every kind — produces a form where two thirds of the inputs
 * do not apply to what the editor is writing. Separate types with shared field builders give each
 * one a form containing only its own fields, while a change to the safety wording or the SEO rules
 * is still made once.
 */

/**
 * Slugs that belong to a route rather than to a document.
 *
 * The storefront serves every entry at `/knowledge/<slug>`, with `/knowledge/for/<concern>` as a
 * static segment beside it. Next resolves the static segment first, so a document that managed to
 * take the slug `for` would be published, linked, listed in the sitemap — and unreachable, a
 * failure that reports itself nowhere. Refusing the handful of reserved words costs nothing.
 */
const RESERVED_SLUGS = ["for", "topic", "page", "api", "feed", "search"]

/**
 * True when no other document — of any type — already holds this slug.
 *
 * Sanity's default uniqueness check is per type, which is right for a CMS where each type has its
 * own URL prefix. Here a remedy, a practice and an article all resolve under `/knowledge/`, so two
 * types sharing a slug means one of them is unreachable. The check has to span types because the
 * URL space does.
 *
 * Both the draft and the published id of the current document are excluded, or a document would
 * always collide with itself.
 */
export async function isSlugUniqueAcrossTypes(
  slug: string,
  context: SlugValidationContext
): Promise<boolean> {
  const { document, getClient } = context
  if (!document?._id) return true

  const id = document._id.replace(/^drafts\./, "")
  const taken = await getClient({ apiVersion: SANITY_API_VERSION }).fetch<boolean>(
    `defined(*[!(_id in [$draft, $published]) && slug.current == $slug][0]._id)`,
    { draft: `drafts.${id}`, published: id, slug }
  )

  return !taken
}

/** Lower-cased, hyphenated, stripped of anything that would need percent-encoding. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96)
}

/** The URL field, identical on every type that gets a page of its own. */
export function slugField(group = "content") {
  return defineField({
    name: "slug",
    title: "Slug",
    description:
      "The URL, after /knowledge/. Once this is published and linked to, changing it breaks those links — so treat it as permanent.",
    type: "slug",
    group,
    options: { source: "title", maxLength: 96, slugify, isUnique: isSlugUniqueAcrossTypes },
    validation: (rule) =>
      rule.required().custom((value) => {
        const current = (value as { current?: string } | undefined)?.current
        if (current && RESERVED_SLUGS.includes(current)) {
          return `"${current}" is reserved by the site's own routes. Pick another slug.`
        }
        return true
      }),
  })
}

/** When to take or do something. Shared so a remedy and a practice answer it the same way. */
export const BEST_TIME = [
  { title: "Early morning (before sunrise)", value: "early-morning" },
  { title: "Morning", value: "morning" },
  { title: "Midday", value: "midday" },
  { title: "Afternoon", value: "afternoon" },
  { title: "Evening", value: "evening" },
  { title: "Before bed", value: "before-bed" },
  { title: "On an empty stomach", value: "empty-stomach" },
  { title: "With food", value: "with-food" },
  { title: "After food", value: "after-food" },
  { title: "Any time", value: "anytime" },
]

export const DOSHAS = [
  { title: "Vata", value: "vata" },
  { title: "Pitta", value: "pitta" },
  { title: "Kapha", value: "kapha" },
]

/**
 * The safety block, required on anything a reader might ingest or do to their body.
 *
 * ── Why these are required ─────────────────────────────────────────────────────────────────────
 * This content tells someone what to take when they are unwell, and content of that kind is held to
 * a higher standard than the rest of a site — by search engines, which treat health advice as YMYL,
 * and by whoever has to answer for it later. The failure mode is not an editor who refuses to write
 * cautions; it is an editor in a hurry who does not think of them. A required field is the only
 * mechanism that reliably prevents that, which is why the schema insists rather than advises.
 *
 * `avoidIf` is deliberately separate from `cautions`. A caution modifies how something is used; an
 * avoid is a reason not to use it at all, and the page renders the two differently because a reader
 * scanning for "does this apply to me" needs the absolute answers first.
 */
export function safetyFields(group = "safety") {
  return [
    defineField({
      name: "cautions",
      title: "Cautions",
      description:
        "What a reader should be careful about — too much, too long, taken alongside the wrong thing. One per line.",
      type: "array",
      of: [{ type: "string" }],
      group,
      validation: (rule) => rule.required().min(1).error("At least one caution is required."),
    }),
    defineField({
      name: "avoidIf",
      title: "Do not use if",
      description:
        "Conditions, medicines or situations where this should be skipped entirely. One per line.",
      type: "array",
      of: [{ type: "string" }],
      group,
    }),
    defineField({
      name: "pregnancyAndChildren",
      title: "Pregnancy, breastfeeding and children",
      description:
        "State the position plainly, including where it is “ask a doctor first”. Silence here reads as safe, which is the one thing it must never do.",
      type: "text",
      rows: 2,
      group,
    }),
    defineField({
      name: "maxDuration",
      title: "How long is too long",
      description:
        "Where continuous use has a limit, say it — for example, not beyond two weeks without a break.",
      type: "string",
      group,
    }),
  ]
}

/**
 * Publishing and classification fields.
 *
 * `publishedAt` is compared to `now()` by every storefront query, which is what makes scheduling
 * real: an editor can date something forward, publish it, and it stays off the site until then.
 */
export function publishingFields({
  group = "meta",
  withConcerns = true,
}: { group?: string; withConcerns?: boolean } = {}) {
  return [
    defineField({
      name: "author",
      title: "Author",
      type: "reference",
      to: [{ type: "author" }],
      group,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "reviewedBy",
      title: "Reviewed by",
      description:
        "Optional, and worth filling in where a named individual reviewed this rather than the brand as a whole.",
      type: "reference",
      to: [{ type: "author" }],
      group,
    }),
    defineField({
      name: "category",
      title: "Section",
      description:
        "What kind of thing this is — Teas & Decoctions, Pranayama, Chakras. Sub-sections are made by giving a category a parent.",
      type: "reference",
      to: [{ type: "category" }],
      group,
      validation: (rule) => rule.required(),
    }),
    ...(withConcerns
      ? [
          defineField({
            name: "concerns",
            title: "Helps with",
            description:
              "What a reader would arrive looking for — a cough, poor sleep, low energy. This is the axis that connects a tea, a breathing practice and a dosha explainer to one another, so it earns more care than it looks like it needs.",
            type: "array",
            of: [{ type: "reference", to: [{ type: "concern" }] }],
            group,
          }),
        ]
      : []),
    defineField({
      name: "publishedAt",
      title: "Published on",
      type: "datetime",
      group,
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "updatedAt",
      title: "Last substantively revised",
      description:
        "Set this when the content actually changed in a way a reader would care about. Leave it alone for typo fixes — claiming a revision that did not happen is worse than claiming none.",
      type: "datetime",
      group,
    }),
    defineField({
      name: "featured",
      title: "Feature on the Knowledge Center index",
      type: "boolean",
      group,
      initialValue: false,
    }),
  ]
}

/** The four fields that decide how a page appears in a search result. Identical on every type. */
export function seoFields(group = "seo") {
  return [
    defineField({
      name: "seoTitle",
      title: "Title tag",
      description:
        "Leave empty to use the headline. Around 60 characters is where Google starts truncating, and the site appends the brand name after it.",
      type: "string",
      group,
      validation: (rule) =>
        rule.max(60).warning("Longer than about 60 characters will usually be cut off in results."),
    }),
    defineField({
      name: "metaDescription",
      title: "Meta description",
      description: "Leave empty to use the excerpt.",
      type: "text",
      rows: 3,
      group,
      validation: (rule) =>
        rule
          .max(155)
          .warning("Longer than about 155 characters will usually be cut off in results."),
    }),
    defineField({
      name: "canonicalUrl",
      title: "Canonical URL",
      description:
        "Only when this was first published somewhere else and that version should be treated as the original. Leave empty otherwise — the page sets its own canonical.",
      type: "url",
      group,
    }),
    defineField({
      name: "noIndex",
      title: "Hide from search engines",
      description:
        "Keeps the page live and linkable but asks search engines not to list it, and leaves it out of the sitemap. This is not a privacy control.",
      type: "boolean",
      group,
      initialValue: false,
    }),
  ]
}

/**
 * Products this entry calls for, by storefront handle.
 *
 * ── Why handles rather than references ─────────────────────────────────────────────────────────
 * The catalogue lives in Postgres behind the Medusa backend, not in Sanity, so there is nothing
 * here to reference. A handle is the stable, human-checkable identifier the storefront already
 * routes on, and an entry whose product was renamed then renders one dead link rather than failing
 * the page — which is why the storefront treats these as hints and not as truth.
 */
export function productFields(group = "content") {
  return [
    defineField({
      name: "productHandles",
      title: "Products this uses",
      description:
        "Storefront handles, exactly as they appear in the product URL. These render as links beside the ingredients.",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
      group,
    }),
  ]
}
