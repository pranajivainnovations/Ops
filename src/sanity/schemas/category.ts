import { defineField, defineType } from "sanity"

/**
 * A topic grouping, used for navigation and for the article's URL-independent classification.
 *
 * Kept deliberately thin. Categories earn their place when a reader uses them to find a second
 * article, and stop earning it the moment there are twenty of them with one post each — so the
 * description field exists mainly to make a category page worth indexing rather than a bare list
 * of links, which is the difference between a useful page and a thin one.
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
  ],
  preview: {
    select: { title: "title", subtitle: "description" },
  },
})
