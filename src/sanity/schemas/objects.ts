import { defineField, defineType } from "sanity"

/**
 * The small repeated structures inside a remedy, a practice or a concept.
 *
 * ── Why an ingredient is three fields and not one line of text ─────────────────────────────────
 * Because Google renders recipe cards from `schema.org/Recipe`, and that needs the ingredients as a
 * discrete list rather than a paragraph. A remedy typed as prose is a page; the same remedy typed
 * into these fields is a page that can win a rich result for "what to drink for a cough" — which is
 * the single largest piece of search value available to this section, and it is only reachable if
 * the content is modelled rather than written.
 *
 * The same argument applies to steps and `schema.org/HowTo`.
 */

/**
 * One ingredient.
 *
 * `amount` is free text, not a number and a unit. Ayurvedic quantities are genuinely written as
 * "a thumb-sized piece", "two pinches" and "half a glass", and a numeric field would force the
 * editor to either lie or leave it empty. The storefront composes "1 tsp grated ginger, lightly
 * crushed" from the three parts, which is also exactly the string schema.org wants.
 */
const ingredient = defineType({
  name: "ingredient",
  title: "Ingredient",
  type: "object",
  fields: [
    defineField({
      name: "item",
      title: "Ingredient",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "amount",
      title: "How much",
      description: "Written however it is actually measured — 1 tsp, a thumb-sized piece, 2 pinches.",
      type: "string",
    }),
    defineField({
      name: "note",
      title: "Note",
      description: "Preparation or a substitute — lightly crushed, or use jaggery instead.",
      type: "string",
    }),
    defineField({
      name: "optional",
      title: "Optional",
      type: "boolean",
      initialValue: false,
    }),
  ],
  preview: {
    select: { item: "item", amount: "amount", optional: "optional" },
    prepare({ item, amount, optional }) {
      return {
        title: [amount, item].filter(Boolean).join(" "),
        subtitle: optional ? "optional" : undefined,
      }
    },
  },
})

/**
 * One step of a method.
 *
 * Numbered by position rather than by a field, so reordering in the Studio reorders the method —
 * a stored number would let the list and the numbering disagree, and the one that is wrong is
 * always the one the reader follows.
 */
const methodStep = defineType({
  name: "methodStep",
  title: "Step",
  type: "object",
  fields: [
    defineField({
      name: "text",
      title: "What to do",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "duration",
      title: "How long",
      description: "For a step that takes time of its own — simmer 5 minutes, hold for 4 counts.",
      type: "string",
    }),
    defineField({
      name: "image",
      title: "Image",
      description:
        "Only where seeing it helps. A photo of a pose or a colour to boil to earns its place; a photo of a cup does not.",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt text",
          description: "What the image shows, for someone who cannot see it.",
          type: "string",
          validation: (rule) => rule.required(),
        }),
      ],
    }),
  ],
  preview: {
    select: { text: "text", duration: "duration", media: "image" },
    prepare({ text, duration, media }) {
      return { title: text, subtitle: duration, media }
    },
  },
})

/**
 * A label and a value, for reference entries whose facts are the content.
 *
 * This is what makes the seven chakras work without a document type of their own: each one is an
 * article whose key facts are its Sanskrit name, location, element, seed sound and signs of
 * imbalance. The same field serves a dosha explainer or a herb profile, which is why it is a
 * general list of pairs rather than a chakra-shaped set of named fields.
 */
const keyFact = defineType({
  name: "keyFact",
  title: "Key fact",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "value",
      title: "Value",
      type: "string",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { label: "label", value: "value" },
    prepare({ label, value }) {
      return { title: value, subtitle: label }
    },
  },
})

export const objectTypes = [ingredient, methodStep, keyFact]
