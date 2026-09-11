import { defineArrayMember, defineField, defineType } from "sanity"

/**
 * One published article.
 *
 * ── Why the type is called "article" and not "post" ────────────────────────────────────────────
 * Pranajiva's storefront already queries `*[_type == "article"]` against its old project. Naming
 * this `post` would have meant rewriting working code on a site that is live, for no gain. The name
 * also happens to match the schema.org type these pages emit, which keeps one fewer thing to
 * translate between the CMS and the markup.
 *
 * ── Why SEO fields are separate from the title and excerpt ─────────────────────────────────────
 * A headline is written for a person reading the page; a title tag is written for someone deciding,
 * from one line in a list of ten, whether to click. They are usually not the same sentence, and
 * forcing them to be produces one of the two badly. Both SEO fields fall back to the editorial ones
 * when left empty, so the common case costs nothing.
 *
 * The length rules are warnings, not errors. Google truncates around 60 characters for a title and
 * roughly 155 for a description — but truncation is a judgement about display, not a defect, and a
 * schema that refuses to save a good 62-character title would be wrong. A warning informs; an error
 * would be the CMS overruling the editor about their own copy.
 *
 * ── Why publishedAt and updatedAt are both explicit ────────────────────────────────────────────
 * `_createdAt` and `_updatedAt` exist on every Sanity document, but they record when the row was
 * touched, not when the piece was published or last genuinely revised — fixing a typo would move
 * `_updatedAt` and claim the article was revised. These two are editorial facts, and they become
 * `datePublished` and `dateModified` in the page's structured data, which is one of the signals an
 * answer engine uses to decide whether a source is current enough to quote.
 */
export default defineType({
  name: "article",
  title: "Article",
  type: "document",
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "meta", title: "Attribution" },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    // ── Content ────────────────────────────────────────────────────────────────────────────────
    defineField({
      name: "title",
      title: "Headline",
      type: "string",
      group: "content",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      description:
        "The URL. Once an article is published and has been linked to, changing this breaks those links — so treat it as permanent.",
      type: "slug",
      group: "content",
      options: {
        source: "title",
        maxLength: 96,
        /* Lower-cased, hyphenated, stripped of anything that would need percent-encoding. The
           default slugifier already does most of this; the explicit version also collapses runs of
           hyphens, which is what you get from a headline containing an em dash. */
        slugify: (input) =>
          input
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
            .replace(/-{2,}/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 96),
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "excerpt",
      title: "Excerpt",
      description:
        "One or two sentences, shown on cards and used as the meta description when the SEO tab is left empty.",
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
          description:
            "What the image shows, for someone who cannot see it. Not a caption and not keywords.",
          type: "string",
          validation: (rule) => rule.required(),
        }),
      ],
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      group: "content",
      of: [
        defineArrayMember({
          type: "block",
          /* H1 is deliberately absent. The page renders the headline as its only H1, and a second
             one inside the body would compete with it — a rule the site currently passes and should
             keep passing. Editors get H2 and H3, which is the structure that makes long pages
             skimmable and lets an answer engine quote a section rather than the whole article. */
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

    // ── Attribution ────────────────────────────────────────────────────────────────────────────
    defineField({
      name: "author",
      title: "Author",
      type: "reference",
      to: [{ type: "author" }],
      group: "meta",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "reviewedBy",
      title: "Reviewed by",
      description:
        "For anything making a health, safety or money claim. A named, qualified reviewer is the single strongest trust signal such a page can carry — and its absence is the usual reason wellness content fails to rank.",
      type: "reference",
      to: [{ type: "author" }],
      group: "meta",
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "reference",
      to: [{ type: "category" }],
      group: "meta",
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
      group: "meta",
    }),
    defineField({
      name: "publishedAt",
      title: "Published on",
      type: "datetime",
      group: "meta",
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "updatedAt",
      title: "Last substantively revised",
      description:
        "Set this when the content actually changed in a way a reader would care about. Leave it alone for typo fixes — claiming a revision that did not happen is worse than claiming none.",
      type: "datetime",
      group: "meta",
    }),
    defineField({
      name: "featured",
      title: "Feature on the index",
      type: "boolean",
      group: "meta",
      initialValue: false,
    }),

    // ── SEO ────────────────────────────────────────────────────────────────────────────────────
    defineField({
      name: "seoTitle",
      title: "Title tag",
      description:
        "Leave empty to use the headline. Around 60 characters is where Google starts truncating, and the site appends the brand name after it.",
      type: "string",
      group: "seo",
      validation: (rule) =>
        rule.max(60).warning("Longer than about 60 characters will usually be cut off in results."),
    }),
    defineField({
      name: "metaDescription",
      title: "Meta description",
      description: "Leave empty to use the excerpt.",
      type: "text",
      rows: 3,
      group: "seo",
      validation: (rule) =>
        rule
          .max(155)
          .warning("Longer than about 155 characters will usually be cut off in results."),
    }),
    defineField({
      name: "canonicalUrl",
      title: "Canonical URL",
      description:
        "Only when this article was first published somewhere else and that version should be treated as the original. Leave empty otherwise — the page sets its own canonical.",
      type: "url",
      group: "seo",
    }),
    defineField({
      name: "noIndex",
      title: "Hide from search engines",
      description:
        "Keeps the article live and linkable but asks search engines not to list it. For thin or duplicated pieces you still want reachable. This is not a privacy control.",
      type: "boolean",
      group: "seo",
      initialValue: false,
    }),
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
      author: "author.name",
      publishedAt: "publishedAt",
      media: "coverImage",
      noIndex: "noIndex",
    },
    prepare({ title, author, publishedAt, media, noIndex }) {
      const date = publishedAt
        ? new Date(publishedAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "unscheduled"
      return {
        title: noIndex ? `${title}  ·  hidden from search` : title,
        subtitle: [author, date].filter(Boolean).join("  ·  "),
        media,
      }
    },
  },
})
