import { defineField, defineType } from "sanity"

/**
 * A YouTube video embedded in an article body.
 *
 * ── Why YouTube rather than uploading the file ─────────────────────────────────────────────────
 * A headless CMS is a poor video host: you pay bandwidth for a single original with no transcoding
 * and no adaptive bitrate, so a phone on a weak connection either waits or fails. YouTube costs
 * nothing, transcodes for every device, and — the part that matters for a brand nobody has found
 * yet — is itself the second-largest search engine. The same video can be discovered there and
 * carry a link back, which a self-hosted file cannot do.
 *
 * If a video ever needs to appear without YouTube's branding or its suggested-video panel, the
 * answer is Mux or Cloudflare Stream as a second block type, not an uploaded file.
 *
 * `title` is required because it becomes the `name` of the VideoObject in structured data and the
 * iframe's accessible name. An unnamed embed is invisible to both a screen reader and a crawler.
 */
export default defineType({
  name: "youtube",
  title: "YouTube video",
  type: "object",
  fields: [
    defineField({
      name: "url",
      title: "YouTube URL",
      description: "Paste the normal watch URL or a youtu.be short link.",
      type: "url",
      validation: (rule) =>
        rule
          .required()
          .uri({ scheme: ["http", "https"] })
          .custom((value) => {
            if (!value) return true
            return /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/.test(value)
              ? true
              : "That does not look like a YouTube link"
          }),
    }),
    defineField({
      name: "title",
      title: "Video title",
      description:
        "Describes the video for screen readers and for structured data. Not shown as a caption unless you also fill in the caption field.",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "string",
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "url" },
  },
})
