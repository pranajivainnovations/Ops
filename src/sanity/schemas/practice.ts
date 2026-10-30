import { defineArrayMember, defineField, defineType } from "sanity"

import {
  BEST_TIME,
  DOSHAS,
  publishingFields,
  safetyFields,
  seoFields,
  slugField,
} from "./shared"

/**
 * One practice: something a reader does rather than makes.
 *
 * An asana, a pranayama, a meditation, a mudra, a morning routine. Shaped as a `schema.org/HowTo`
 * for the same reason a remedy is shaped as a Recipe — the steps are the content, and a search
 * engine can only show them as steps if they are stored as steps.
 *
 * ── Why this is a separate type from Remedy rather than one type with a switch ──────────────────
 * Almost nothing they need is shared. A practice has no ingredients, no dosage and no yield; it has
 * rounds, a duration and a difficulty. One type covering both would present an editor writing about
 * Anulom Vilom with an ingredients list, and an editor writing about a decoction with a repetitions
 * field. What they do share — safety, filing, SEO — is shared as fields.
 *
 * ── Why difficulty is required ─────────────────────────────────────────────────────────────────
 * Because the harm here is someone attempting a practice they are not ready for, and "Advanced" is
 * the cheapest possible intervention. An optional field would be left empty on exactly the entries
 * that most need it.
 */
export default defineType({
  name: "practice",
  title: "Practice",
  type: "document",
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "method", title: "How to do it" },
    { name: "safety", title: "Safety" },
    { name: "meta", title: "Filing" },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    // ── Content ────────────────────────────────────────────────────────────────────────────────
    defineField({
      name: "title",
      title: "Name",
      description:
        "What it is called, with the Sanskrit name where there is one — Anulom Vilom (Alternate Nostril Breathing).",
      type: "string",
      group: "content",
      validation: (rule) => rule.required(),
    }),
    slugField("content"),
    defineField({
      name: "excerpt",
      title: "One-line summary",
      description:
        "What it does and who it is for, in a sentence. Shown on cards and used as the meta description when the SEO tab is empty.",
      type: "text",
      rows: 3,
      group: "content",
      validation: (rule) => rule.required().max(300),
    }),
    defineField({
      name: "coverImage",
      title: "Cover image",
      type: "image",
      group: "content",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt text",
          description: "What the image shows, for someone who cannot see it. Not a caption.",
          type: "string",
          validation: (rule) => rule.required(),
        }),
      ],
    }),
    defineField({
      name: "practiceType",
      title: "Kind",
      type: "string",
      group: "content",
      options: {
        list: [
          { title: "Asana (posture)", value: "asana" },
          { title: "Pranayama (breathing)", value: "pranayama" },
          { title: "Meditation", value: "meditation" },
          { title: "Mudra", value: "mudra" },
          { title: "Stretch or mobility", value: "mobility" },
          { title: "Daily routine (Dinacharya)", value: "dinacharya" },
          { title: "Other", value: "other" },
        ],
        layout: "dropdown",
      },
      validation: (rule) => rule.required(),
    }),

    // ── How to do it ───────────────────────────────────────────────────────────────────────────
    defineField({
      name: "steps",
      title: "Steps",
      description: "One step per entry. They are numbered by their order here, so reordering works.",
      type: "array",
      of: [defineArrayMember({ type: "methodStep" })],
      group: "method",
      validation: (rule) => rule.required().min(1).error("A practice needs at least one step."),
    }),
    defineField({
      name: "durationMinutes",
      title: "How long it takes (minutes)",
      type: "number",
      group: "method",
      validation: (rule) => rule.min(1).max(240),
    }),
    defineField({
      name: "repetitions",
      title: "How many rounds",
      description: "Three rounds of ten breaths; hold for thirty seconds each side.",
      type: "string",
      group: "method",
    }),
    defineField({
      name: "difficulty",
      title: "Difficulty",
      type: "string",
      group: "method",
      options: {
        list: [
          { title: "Beginner", value: "beginner" },
          { title: "Intermediate", value: "intermediate" },
          { title: "Advanced", value: "advanced" },
        ],
        layout: "radio",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "bestTime",
      title: "Best time",
      type: "array",
      of: [{ type: "string" }],
      options: { list: BEST_TIME },
      group: "method",
    }),
    defineField({
      name: "benefits",
      title: "What it is for",
      description: "One benefit per line. Claims a reader can check against how they feel.",
      type: "array",
      of: [{ type: "string" }],
      group: "method",
    }),
    defineField({
      name: "doshas",
      title: "Suits",
      description: "Which constitutions this is generally suited to. Leave empty if it suits all.",
      type: "array",
      of: [{ type: "string" }],
      options: { list: DOSHAS },
      group: "method",
    }),

    // ── Safety ─────────────────────────────────────────────────────────────────────────────────
    ...safetyFields("safety"),

    // ── Why it works ───────────────────────────────────────────────────────────────────────────
    defineField({
      name: "body",
      title: "Why it works",
      description:
        "Optional. The reasoning, the tradition, what is happening in the body. Headings start at H2 — the name above is the page's H1.",
      type: "array",
      group: "content",
      of: [
        defineArrayMember({
          type: "block",
          styles: [
            { title: "Normal", value: "normal" },
            { title: "Heading", value: "h2" },
            { title: "Subheading", value: "h3" },
            { title: "Quote", value: "blockquote" },
          ],
          marks: {
            annotations: [
              {
                name: "link",
                type: "object",
                title: "Link",
                fields: [
                  defineField({
                    name: "href",
                    type: "url",
                    title: "URL",
                    validation: (rule) =>
                      rule.uri({ scheme: ["http", "https", "mailto", "tel"] }),
                  }),
                ],
              },
            ],
          },
        }),
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({ name: "alt", type: "string", title: "Alt text" }),
            defineField({ name: "caption", type: "string", title: "Caption" }),
          ],
        }),
        defineArrayMember({ type: "youtube" }),
      ],
    }),

    // ── Filing & SEO ───────────────────────────────────────────────────────────────────────────
    ...publishingFields({ group: "meta" }),
    ...seoFields("seo"),
  ],
  orderings: [
    {
      title: "Newest first",
      name: "publishedDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      practiceType: "practiceType",
      difficulty: "difficulty",
      media: "coverImage",
      noIndex: "noIndex",
    },
    prepare({ title, practiceType, difficulty, media, noIndex }) {
      return {
        title: noIndex ? `${title}  ·  hidden from search` : title,
        subtitle: [practiceType, difficulty].filter(Boolean).join("  ·  "),
        media,
      }
    },
  },
})
