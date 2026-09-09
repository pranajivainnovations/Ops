/**
 * The colour presets an announcement can use.
 *
 * ── Why presets and not a colour picker ────────────────────────────────────────────────────────
 * A picker looks like more freedom and is mostly a way to publish a contrast failure to every
 * visitor at once. These pairs are chosen together, so text is always legible on its background, and
 * every one of them looks like CrossFriend. Someone choosing "Alert" gets a considered red rather
 * than whichever red they picked from a wheel at 11pm.
 *
 * Full class strings, never interpolated — Tailwind reads source text, so `bg-${theme}-600` would
 * simply never be generated. The storefront keeps its own copy of this map for the same reason; the
 * key travelling between them is the contract, not the classes.
 */

export interface AnnouncementTheme {
  key: string
  label: string
  /** What it is for, so the choice is about meaning rather than about colour. */
  hint: string
  /** Preview swatch in OPS. The storefront maps the same key to its own classes. */
  swatch: string
}

export const THEMES: AnnouncementTheme[] = [
  {
    key: "purple",
    label: "Brand",
    hint: "The default. Launches, new features, anything celebratory.",
    swatch: "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white",
  },
  {
    key: "warm",
    label: "Warm",
    hint: "Festivals and seasonal offers — softer, less shouty than brand.",
    swatch: "bg-gradient-to-r from-orange-500 to-amber-500 text-white",
  },
  {
    key: "info",
    label: "Information",
    hint: "Delivery timings, policy changes, anything purely factual.",
    swatch: "bg-sky-600 text-white",
  },
  {
    key: "alert",
    label: "Alert",
    hint: "Outages and problems. Use sparingly — a permanent red banner stops being read.",
    swatch: "bg-red-600 text-white",
  },
]

export const THEME_KEYS = THEMES.map((t) => t.key)

export function isTheme(value: string): boolean {
  return THEME_KEYS.includes(value)
}
