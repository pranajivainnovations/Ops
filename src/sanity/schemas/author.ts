import { defineField, defineType } from "sanity"

/**
 * A named human, with a reason to be believed.
 *
 * ── Why this is a document and not a string on the article ─────────────────────────────────────
 * An author name typed into each post drifts: three spellings, no bio, no photo, and nothing a
 * search engine or an answer engine can resolve to a person. As a document it is written once,
 * referenced everywhere, and can carry the two things that actually matter — what qualifies this
 * person to write it, and where else they exist on the internet.
 *
 * ── Why credentials and links are here at all ──────────────────────────────────────────────────
 * Google assesses health, finance and safety content under stricter expectations than a recipe:
 * who wrote it, whether they are qualified, and whether that can be verified. Pranajiva publishes
 * wellness material, which lands squarely in that category. `credentials` and `sameAs` become the
 * `author` block of the Article schema on the page, which is the machine-readable form of the same
 * claim. An assistant deciding whether to quote a page reads exactly this.
 */
export default defineType({
  name: "author",
  title: "Author",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Full name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "role",
      title: "Role or title",
      description:
        'Shown under the name, e.g. "Founder, CrossFriend" or "Ayurvedic practitioner".',
      type: "string",
    }),
    defineField({
      name: "isOrganization",
      title: "This is a brand, not a person",
      description:
        'Tick when the byline is the company itself (e.g. "CrossFriend", "Editorial team") rather than a named human. It decides whether the page describes the author as an Organization or a Person in structured data — declaring a brand as a Person is simply false, and a search engine that resolves the name to a company will treat the mismatch as a reason to trust the page less.',
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "credentials",
      title: "Qualifications",
      description:
        "Only real, checkable ones — a degree, a registration number, years in practice. Leave blank rather than inventing something; an unverifiable claim is worse than none.",
      type: "string",
    }),
    defineField({
      name: "bio",
      title: "Short bio",
      description: "Two or three sentences. Appears on the article and on the author page.",
      type: "text",
      rows: 3,
      validation: (rule) => rule.max(400),
    }),
    defineField({
      name: "photo",
      title: "Photo",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt text",
          type: "string",
        }),
      ],
    }),
    defineField({
      name: "sameAs",
      title: "Profile links",
      description:
        "LinkedIn, a personal site, a professional register. These become the `sameAs` property in structured data, which is how a search engine connects this name to a real identity.",
      type: "array",
      of: [{ type: "url" }],
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "role", media: "photo" },
  },
})
