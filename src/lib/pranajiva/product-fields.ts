/**
 * What a PranaJiva product carries beyond title and price, described once.
 *
 * ── Why this file exists ──────────────────────────────────────────────────────────────────────
 * The seventeen live products hold thirty-odd metadata keys between them, and every one of them is
 * load-bearing on the storefront: `brand` decides whether a product appears on pranajiva.in at all,
 * `ritual_usage.time` orders the Abhyanga Snan strip, `pair_with` fills "Pairs with", `seo_title`
 * and `seo_description` are what Google shows. Medusa's own admin edits all of it as untyped
 * key/value rows, where `pair_with` is a string that happens to look like JSON and a typo in
 * `brand` removes a product from the site with nothing failing loudly.
 *
 * So the shapes are declared here instead, and the editor is generated from them. A field that is
 * a list renders as a list. A field with a fixed vocabulary renders as a select, so "Glow care"
 * cannot be typed where "Glow Care" is meant. Adding a field is one entry here, not a new form.
 *
 * ── The vocabularies are seeded, not fixed ────────────────────────────────────────────────────
 * `options` below is what the catalogue already uses, read off the live rows. It is a starting
 * list, not a constraint: the editor offers these and still accepts anything else typed in, because
 * the rule in AGENTS.md is that code never decides what exists. A hardcoded list that refuses a new
 * value is exactly the drift that rule was written about.
 */

export type FieldKind =
  | "text"
  | "textarea"
  | "list"
  | "keyvalue"
  | "ingredients"
  | "boolean"
  | "number"

export interface FieldSpec {
  /** The metadata key, exactly as it is stored. */
  key: string
  label: string
  kind: FieldKind
  /** Shown under the input. Say what it affects on the storefront, not what it is. */
  help?: string
  /** Seed values for a free-text field with a settled vocabulary. Never enforced. */
  options?: string[]
}

export interface FieldGroup {
  id: string
  title: string
  /** Why this group exists, shown once at the top of it. */
  blurb?: string
  fields: FieldSpec[]
}

/**
 * Groups follow how somebody works, not how the data is stored: everything that changes together
 * sits together. Care-product and hamper groups are both always shown — a product can legitimately
 * be neither, and hiding a group is how a populated field becomes invisible and then stale.
 */
export const FIELD_GROUPS: FieldGroup[] = [
  {
    id: "search",
    title: "Search & sharing",
    blurb:
      "What Google lists and what WhatsApp prints under the preview image. Left empty, the product title and description are used instead.",
    fields: [
      {
        key: "seo_title",
        label: "SEO title",
        kind: "text",
        help: "Google truncates around 60 characters. Ends with “| PranaJiva” by convention.",
      },
      {
        key: "seo_description",
        label: "SEO description",
        kind: "textarea",
        help: "Around 155 characters. This is the sentence under the blue link.",
      },
    ],
  },
  {
    id: "placement",
    title: "Where it appears",
    blurb:
      "brand is the one field that decides whether this product exists on pranajiva.in. Clearing it removes the product from the storefront, the sitemap and the Google Merchant feed.",
    fields: [
      {
        key: "brand",
        label: "Brand",
        kind: "text",
        help: "Must be exactly “pranajiva” for this product to appear on the site.",
        options: ["pranajiva", "crossfriend"],
      },
      {
        key: "wellness_category",
        label: "Wellness category",
        kind: "text",
        options: ["Glow Care", "Nutrition", "Ayurveda", "Intimate Wellness", "Gifting"],
      },
      {
        key: "product_family",
        label: "Product family",
        kind: "text",
        options: ["blend", "single-herb", "oil", "hamper"],
      },
      {
        key: "origin_system",
        label: "Origin system",
        kind: "text",
        options: ["ayurveda", "modern"],
      },
      {
        key: "target_gender",
        label: "For",
        kind: "text",
        options: ["unisex", "women", "men"],
      },
    ],
  },
  {
    id: "ritual",
    title: "The ritual",
    blurb:
      "Drives the Abhyanga Snan strip on the product page. The order of the four steps comes from the time below — not from a list in code — so a product with no time set simply does not appear in the ritual.",
    fields: [
      {
        key: "ritual_usage",
        label: "Ritual usage",
        kind: "keyvalue",
        help: "“time” orders the strip: morning, midday, evening. “method” is the sentence shown under the step.",
      },
      {
        key: "pair_with",
        label: "Pairs with",
        kind: "list",
        help: "Product handles, one per line, e.g. herbal-body-ubtan. A handle that does not exist is dropped silently on the storefront.",
      },
    ],
  },
  {
    id: "composition",
    title: "What is in it",
    fields: [
      {
        key: "ingredients",
        label: "Ingredients",
        kind: "ingredients",
        help: "Name and percentage. Percentages are shown as given and are not checked against 100.",
      },
      { key: "key_ingredients", label: "Key ingredients", kind: "list" },
      { key: "key_actives", label: "Key actives", kind: "list" },
      { key: "benefits", label: "Benefits", kind: "list", help: "One claim per line." },
      { key: "key_nutrients", label: "Key nutrients", kind: "list" },
      {
        key: "allergen",
        label: "Allergen",
        kind: "text",
        help: "Stated on the pack. Leave empty only when there genuinely is none.",
      },
      {
        key: "free_from",
        label: "Free from",
        kind: "list",
        options: ["parabens", "sulfates", "artificial fragrance", "synthetic additives"],
      },
      { key: "form", label: "Form", kind: "text", options: ["powder", "oil", "paste", "liquid"] },
      { key: "texture", label: "Texture", kind: "text" },
      { key: "fragrance", label: "Fragrance", kind: "text" },
    ],
  },
  {
    id: "use",
    title: "How to use it",
    fields: [
      { key: "directions", label: "Directions", kind: "textarea" },
      {
        key: "usage_type",
        label: "Usage type",
        kind: "text",
        options: ["external", "internal"],
      },
      { key: "patch_test", label: "Patch test", kind: "textarea" },
      {
        key: "safety",
        label: "Safety",
        kind: "textarea",
        help: "Shown verbatim on the product page. Keep it accurate rather than reassuring.",
      },
      { key: "storage", label: "Storage", kind: "textarea" },
      { key: "dosha", label: "Dosha", kind: "list", options: ["vata", "pitta", "kapha"] },
      { key: "skin_type", label: "Skin type", kind: "list" },
      { key: "hair_type", label: "Hair type", kind: "list" },
      { key: "concerns", label: "Concerns", kind: "list" },
      { key: "lifestyle", label: "Lifestyle", kind: "list" },
      { key: "who_is_it_for", label: "Who is it for", kind: "textarea" },
    ],
  },
  {
    id: "story",
    title: "Story & evidence",
    blurb:
      "Longer-form copy. `science` is where a claim is justified, and is the field a regulator or a sceptical customer would ask about — keep it to what can be supported.",
    fields: [
      { key: "brand_story", label: "Brand story", kind: "textarea" },
      { key: "science", label: "Science", kind: "textarea" },
    ],
  },
  {
    id: "hamper",
    title: "Hamper",
    blurb:
      "Only the twelve corporate gift hampers use these. Leave them empty on a care product.",
    fields: [
      { key: "hamper_number", label: "Hamper number", kind: "number" },
      {
        key: "hamper_collection",
        label: "Collection",
        kind: "text",
        options: ["Ayurveda", "Tulsi", "Pushp", "Sugandh", "Prakriti", "Deep", "Sneh", "Dinacharya", "Shubh"],
      },
      { key: "tagline", label: "Tagline", kind: "text" },
      { key: "presentation", label: "Presentation", kind: "text", options: ["Gift Box", "Basket", "Tray"] },
      { key: "contents", label: "Contents", kind: "list", help: "One line per item, as printed in the catalogue." },
      { key: "care_essentials", label: "Care essentials", kind: "list" },
      { key: "festive_and_extra", label: "Festive & extra", kind: "list" },
      { key: "customisable", label: "Customisable", kind: "boolean" },
      { key: "customisation_note", label: "Customisation note", kind: "textarea" },
      { key: "quotation_note", label: "Quotation note", kind: "textarea" },
      { key: "enquiries", label: "Enquiries", kind: "keyvalue", help: "email and phone, comma-separated within each." },
      { key: "catalogue_revision", label: "Catalogue revision", kind: "text" },
    ],
  },
  {
    id: "spec",
    title: "Specification table",
    fields: [
      {
        key: "tech_specs",
        label: "Tech specs",
        kind: "keyvalue",
        help: "Rendered as the spec table on the product page, in the order given here.",
      },
      { key: "kit_revision", label: "Kit revision", kind: "text" },
    ],
  },
  {
    id: "launch",
    title: "Before launch",
    blurb: "An internal checklist. Never rendered on the storefront.",
    fields: [
      {
        key: "pending_before_launch",
        label: "Pending before launch",
        kind: "list",
        help: "One outstanding item per line.",
      },
    ],
  },
]

/** Every key the editor knows how to render, for separating known fields from stray ones. */
export const KNOWN_KEYS: Set<string> = new Set(
  FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key))
)

export function specFor(key: string): FieldSpec | null {
  for (const group of FIELD_GROUPS) {
    const found = group.fields.find((f) => f.key === key)
    if (found) return found
  }
  return null
}

/* ── Encoding between a form field and what is stored ──────────────────────────────────────── */

/**
 * A stored value, as text in a form control.
 *
 * Lists become one item per line because that is how they are read and edited — a comma-separated
 * string breaks the moment an item contains a comma, and the hamper contents are full of them.
 */
export function toFormValue(kind: FieldKind, value: unknown): string {
  if (value === null || value === undefined) return ""

  switch (kind) {
    case "list":
      return Array.isArray(value) ? value.map((v) => String(v)).join("\n") : String(value)

    case "ingredients":
      /* Two shapes are live: [{name, percent}] on the blends, and a plain [string] on Neem Powder,
         which is a single herb with nothing to apportion. Both have to survive a round trip —
         reading a string as `{name: undefined}` silently emptied the field. */
      return Array.isArray(value)
        ? value
            .map((v) => {
              if (typeof v === "string") return v
              const row = (isPlainObject(v) ? v : {}) as Record<string, unknown>
              const percent =
                row.percent === undefined || row.percent === null ? "" : row.percent
              const head = `${String(row.name ?? "")}${percent === "" ? "" : ` = ${percent}`}`
              /**
               * Anything beyond name and percent is carried through as `key: value`.
               *
               * Not hypothetical: the abhyanga oil's one ingredient also holds `inci`, the
               * regulatory name, and an encoding that understood only name and percent deleted it
               * the first time anybody pressed Save.
               */
              const extras = Object.entries(row)
                .filter(([k]) => k !== "name" && k !== "percent")
                .map(([k, val]) => `${k}: ${String(val)}`)
              return extras.length ? `${head}${ARRAY_SEP}${extras.join(ARRAY_SEP)}` : head
            })
            .join("\n")
        : String(value)

    case "keyvalue":
      if (isPlainObject(value)) {
        return Object.entries(value)
          .map(([k, v]) => `${k} = ${Array.isArray(v) ? v.join(ARRAY_SEP) : String(v)}`)
          .join("\n")
      }
      /* Not an object at all. Moringa Powder's ritual_usage is a string of JSON-ish text that was
         never parsed — shown as it is rather than coerced, so opening the product and saving it
         cannot mangle it further. It is editable, which is how it gets fixed. */
      return String(value)

    case "boolean":
      return value ? "true" : "false"

    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value)
  }
}

/**
 * A form field, back into what gets stored.
 *
 * Returns `undefined` for an empty field, and the caller removes the key rather than storing an
 * empty string. A key holding "" and a key that is absent read the same on the storefront, and two
 * representations of one state is how a condition like `metadata.form ? … : …` starts lying.
 */
export function fromFormValue(kind: FieldKind, raw: string): unknown {
  const text = raw.trim()
  if (!text) return undefined

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  switch (kind) {
    case "list":
      return lines

    case "ingredients":
      return lines.map((line) => {
        /* `Name = 60 | inci: Sesamum Indicum` — the head, then any extra fields. */
        const [head, ...extraParts] = line.split(ARRAY_SEP.trim()).map((s) => s.trim())
        const [name, percent] = splitOnce(head, "=")
        const n = Number(percent)

        const extras: Record<string, unknown> = {}
        for (const part of extraParts) {
          const [k, v] = splitOnce(part, ":")
          if (k) extras[k] = v ?? ""
        }

        const hasPercent = percent !== null && percent !== "" && Number.isFinite(n)
        if (!hasPercent && extraParts.length === 0) {
          /* A bare string, which is the shape the single-herb products use. Returning `{name}`
             would rewrite them into a different shape on every save. */
          return name
        }
        return { name, ...(hasPercent ? { percent: n } : {}), ...extras }
      })

    case "keyvalue": {
      /**
       * A block with no `key = value` line in it is not a map, and forcing one produces a single
       * key made of the whole paragraph. That is what a malformed field looks like today, and the
       * editor's job there is to preserve it, not to destroy it differently.
       */
      if (!lines.some((line) => line.includes("="))) return text

      const out: Record<string, unknown> = {}
      for (const line of lines) {
        const [k, v] = splitOnce(line, "=")
        if (!k) continue
        /**
         * Arrays are separated by a pipe, not a comma.
         *
         * Commas were tried and were wrong: `ritual_usage.method` is a sentence — "Mix 1-2
         * teaspoons with water to a smooth paste, apply to a clean face…" — and splitting it
         * turned the instructions on every care product into a list of fragments. A pipe does not
         * occur in this prose, and `enquiries.email` is still restored as the list it is.
         */
        out[k] =
          v !== null && v.includes(ARRAY_SEP.trim())
            ? v.split(ARRAY_SEP.trim()).map((s) => s.trim()).filter(Boolean)
            : v ?? ""
      }
      return out
    }

    case "boolean":
      return text === "true"

    case "number": {
      const n = Number(text)
      return Number.isFinite(n) ? n : undefined
    }

    default:
      return text
  }
}

/** How a list inside a key/value map is written. See the note in the keyvalue branch above. */
const ARRAY_SEP = " | "

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** Splits on the first separator only, so a value may contain it. */
function splitOnce(line: string, sep: string): [string, string | null] {
  const at = line.indexOf(sep)
  if (at === -1) return [line.trim(), null]
  return [line.slice(0, at).trim(), line.slice(at + sep.length).trim()]
}
