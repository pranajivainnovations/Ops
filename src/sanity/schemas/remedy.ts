import { defineArrayMember, defineField, defineType } from "sanity"

import {
  BEST_TIME,
  DOSHAS,
  productFields,
  publishingFields,
  safetyFields,
  seoFields,
  slugField,
} from "./shared"

/**
 * One remedy: something a reader makes and takes.
 *
 * A morning drink, a tea for a cough, a churna, a paste, a steam inhalation. The shape is a recipe,
 * because that is what it is — and modelling it as a recipe rather than as an article is the whole
 * point of this type existing.
 *
 * ── Why this is not an article with a recipe written in the body ───────────────────────────────
 * Three things break if it is. Google renders recipe cards from discrete ingredient and step
 * fields, and cannot read a method out of prose, so the richest search result available to this
 * content becomes unreachable. "Everything for a cough" stops being answerable, because the thing
 * it is for lives in a sentence rather than in a field. And twenty remedies written as free prose
 * by different hands put the dosage in twenty different places, which is a safety problem before it
 * is an editorial one.
 *
 * ── Why dosage is required and separate from the method ────────────────────────────────────────
 * The method says how to make it. The dosage says how much of it to take, how often, and for how
 * long — and that is the part a reader acts on and the part that can harm them. Folding it into the
 * last step is how it ends up missing.
 */
export default defineType({
  name: "remedy",
  title: "Remedy",
  type: "document",
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "method", title: "Ingredients & method" },
    { name: "safety", title: "Safety" },
    { name: "meta", title: "Filing" },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    // ── Content ────────────────────────────────────────────────────────────────────────────────
    defineField({
      name: "title",
      title: "Name",
      description: "What it is called — Tulsi & Ginger Decoction, Morning Warm Water with Lemon.",
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
      name: "remedyType",
      title: "Form",
      type: "string",
      group: "content",
      options: {
        list: [
          { title: "Drink or tea", value: "drink" },
          { title: "Food", value: "food" },
          { title: "Churna or powder", value: "churna" },
          { title: "Oil or external application", value: "oil" },
          { title: "Paste or lepa", value: "paste" },
          { title: "Steam or inhalation", value: "steam" },
          { title: "Other", value: "other" },
        ],
        layout: "dropdown",
      },
      validation: (rule) => rule.required(),
    }),
    ...productFields("content"),

    // ── Ingredients & method ───────────────────────────────────────────────────────────────────
    defineField({
      name: "ingredients",
      title: "Ingredients",
      type: "array",
      of: [defineArrayMember({ type: "ingredient" })],
      group: "method",
      validation: (rule) => rule.required().min(1).error("A remedy needs at least one ingredient."),
    }),
    defineField({
      name: "steps",
      title: "Method",
      description: "One step per entry. They are numbered by their order here, so reordering works.",
      type: "array",
      of: [defineArrayMember({ type: "methodStep" })],
      group: "method",
      validation: (rule) => rule.required().min(1).error("A remedy needs at least one step."),
    }),
    defineField({
      name: "prepMinutes",
      title: "Preparation time (minutes)",
      type: "number",
      group: "method",
      validation: (rule) => rule.min(0).max(600),
    }),
    defineField({
      /* Named `makes` rather than `yield`, which is a reserved word in JavaScript and an
         awkward one to project in GROQ — not worth a field name that reads no better. */
      name: "makes",
      title: "Makes",
      description: "One cup, about 200ml, enough for two.",
      type: "string",
      group: "method",
    }),
    defineField({
      name: "dosage",
      title: "How much, and how often",
      description:
        "The part the reader acts on. Be specific: one cup, twice a day, after food. Vagueness here is the most common way this kind of content causes harm.",
      type: "text",
      rows: 3,
      group: "method",
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
      name: "howLong",
      title: "How soon to expect anything",
      description:
        "Sets an honest expectation — three to four days for a cough, a few weeks for digestion. Readers abandon things that were going to work because nobody told them when to look.",
      type: "string",
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
        "Optional, and the difference between a recipe and something worth reading: the reasoning, the tradition, what the ingredients are doing. Headings start at H2 — the name above is the page's H1.",
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
      remedyType: "remedyType",
      category: "category.title",
      media: "coverImage",
      noIndex: "noIndex",
    },
    prepare({ title, remedyType, category, media, noIndex }) {
      return {
        title: noIndex ? `${title}  ·  hidden from search` : title,
        subtitle: [category, remedyType].filter(Boolean).join("  ·  "),
        media,
      }
    },
  },
})
