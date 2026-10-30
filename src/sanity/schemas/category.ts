import { defineField, defineType } from "sanity"

import { SANITY_API_VERSION } from "../env"

/**
 * A topic grouping, used for navigation and for the entry's URL-independent classification.
 *
 * Kept deliberately thin. Categories earn their place when a reader uses them to find a second
 * article, and stop earning it the moment there are twenty of them with one post each — so the
 * description field exists mainly to make a category page worth indexing rather than a bare list
 * of links, which is the difference between a useful page and a thin one.
 *
 * ── Why there is a parent and only one level of it ─────────────────────────────────────────────
 * Sub-sections are a real editorial need: Remedies divides into Teas & Decoctions, Morning Rituals
 * and Steams long before it has fifty entries. A self-reference gives that for one field, where a
 * second taxonomy type would have given the same thing for a migration.
 *
 * Depth stops at one because nothing navigates three levels. A reader who has to pass through
 * Remedies → Teas → Winter Teas → an entry has been given a filing cabinet instead of a route, and
 * every breadcrumb, index grouping and sitemap entry on the site would need to handle arbitrary
 * depth to serve a case that should be solved by writing a better category name. The validation
 * below refuses a grandparent rather than leaving it to be discovered as a rendering bug.
 */
export default defineType({
  name: "category",
  title: "Category",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      description:
        "A sentence or two on what belongs here. This is the only original text on the category page — without it the page is a list of links, which is not worth indexing.",
      type: "text",
      rows: 3,
      validation: (rule) => rule.max(300),
    }),
    defineField({
      name: "parent",
      title: "Parent section",
      description:
        "Leave empty for a top-level section. Set it to make this a sub-section — Teas & Decoctions inside Remedies.",
      type: "reference",
      to: [{ type: "category" }],
      /* Excludes this document from its own picker. Without it the most obvious wrong answer is
         also the first one in the list. */
      options: {
        filter: ({ document }) => {
          const id = document?._id?.replace(/^drafts\./, "")
          return id
            ? { filter: "!(_id in [$self, $draft])", params: { self: id, draft: `drafts.${id}` } }
            : {}
        },
      },
      validation: (rule) =>
        rule.custom(async (value, context) => {
          const ref = (value as { _ref?: string } | undefined)?._ref
          if (!ref) return true

          const parentHasParent = await context
            .getClient({ apiVersion: SANITY_API_VERSION })
            .fetch<boolean>(`defined(*[_id == $ref][0].parent._ref)`, { ref })

          return parentHasParent
            ? "That section is already a sub-section. The site navigates one level of nesting, so pick a top-level section instead."
            : true
        }),
    }),
  ],
  orderings: [{ title: "A–Z", name: "titleAsc", by: [{ field: "title", direction: "asc" }] }],
  preview: {
    select: { title: "title", subtitle: "description", parent: "parent.title" },
    prepare({ title, subtitle, parent }) {
      return { title: parent ? `${parent}  ›  ${title}` : title, subtitle }
    },
  },
})
