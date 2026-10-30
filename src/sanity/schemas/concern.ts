import { defineField, defineType } from "sanity"

import { slugify } from "./shared"

/**
 * Something a reader wants help with: a cough, poor sleep, low energy, sluggish digestion.
 *
 * ── Why this exists alongside Category ─────────────────────────────────────────────────────────
 * They answer different questions and a single taxonomy cannot do both. Category says what a piece
 * *is* — a tea, a pranayama, a chakra explainer — and that is how an editor files it. A concern says
 * what it is *for*, and that is how a reader arrives. Someone with a cough does not want the teas
 * section; they want the tea, the steam inhalation and the note on why Kapha rises in winter, which
 * are three different categories and three different document types.
 *
 * Collapsing the two would mean choosing which of those readers to serve. Keeping them separate is
 * what lets `/knowledge/for/cough-and-cold` be a real page rather than a search result, and it is
 * the mechanism behind every "pairs well with" link on the site.
 *
 * ── Why the description is required ────────────────────────────────────────────────────────────
 * The concern page's only original sentence is this one. Without it the page is a list of links to
 * other pages on the same site, which is the textbook definition of a thin page — the kind that
 * drags down the pages around it rather than ranking on its own.
 */
export default defineType({
  name: "concern",
  title: "Concern",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      description: "As a reader would say it — Cough & Cold, Poor Sleep, Low Energy.",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      description: "The URL, after /knowledge/for/.",
      type: "slug",
      options: { source: "title", maxLength: 96, slugify },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      description:
        "Two or three sentences on what this covers and how Ayurveda reads it. This is the only original text on the concern page, so it is what makes the page worth having.",
      type: "text",
      rows: 4,
      validation: (rule) => rule.required().min(80).max(600),
    }),
    defineField({
      name: "icon",
      title: "Emoji",
      description:
        "One character, shown on the chips on the index. Optional — an empty one renders as a plain chip rather than a gap.",
      type: "string",
      validation: (rule) => rule.max(4),
    }),
    defineField({
      name: "order",
      title: "Order on the index",
      description:
        "Lower numbers come first. Use it to put the concerns people actually arrive with at the front; leave it empty and it sorts alphabetically behind the ones that are set.",
      type: "number",
    }),
  ],
  orderings: [
    { title: "Display order", name: "displayOrder", by: [{ field: "order", direction: "asc" }] },
  ],
  preview: {
    select: { title: "title", subtitle: "description", order: "order" },
    prepare({ title, subtitle, order }) {
      return {
        title: order === undefined || order === null ? title : `${order}.  ${title}`,
        subtitle,
      }
    },
  },
})
