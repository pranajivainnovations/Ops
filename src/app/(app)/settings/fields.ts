/**
 * The catalogue of site settings OPS can edit.
 *
 * Deliberately in code rather than in the database. The values are data; the *shape* — which
 * settings exist, what they mean, how they are validated — is a decision, and putting it here means
 * adding "YouTube" later is a one-line change instead of a migration plus a UI change.
 *
 * It doubles as the write whitelist: the save action only accepts keys that appear below, so a
 * typo cannot quietly create a setting that nothing reads and everyone assumes is working.
 */

export type SettingKind = "phone" | "whatsapp" | "email" | "url" | "text"

export interface SettingField {
  key: string
  label: string
  kind: SettingKind
  help?: string
  placeholder?: string
}

export interface SettingGroup {
  title: string
  blurb?: string
  fields: SettingField[]
}

export const SETTING_GROUPS: SettingGroup[] = [
  {
    title: "Contact",
    blurb: "Shown across the storefront and on every legal page.",
    fields: [
      {
        key: "whatsapp_number",
        label: "WhatsApp number",
        kind: "whatsapp",
        help: "Digits only, including country code — 91 for India. This is the number behind the floating WhatsApp button on every page.",
        placeholder: "919821101868",
      },
      {
        key: "support_phone",
        label: "Support phone",
        kind: "phone",
        help: "Displayed as written, so format it the way you want customers to read it.",
        placeholder: "+91 98211 01868",
      },
      {
        key: "support_email",
        label: "Support email",
        kind: "email",
        placeholder: "support@crossfriend.in",
      },
    ],
  },
  {
    title: "Grievance officer",
    blurb:
      "Required under the Information Technology (Intermediary Guidelines) Rules, 2021. These appear on the legal pages.",
    fields: [
      { key: "grievance_name", label: "Officer name", kind: "text", placeholder: "Full name" },
      {
        key: "grievance_email",
        label: "Officer email",
        kind: "email",
        placeholder: "director@crossfriend.in",
      },
    ],
  },
  {
    title: "Social profiles",
    blurb:
      "Leave a field empty to hide that link. These are also published as the brand's sameAs list, which is how Google and AI answer engines confirm that this site, your social accounts and your Google Business Profile are one business rather than several with similar names.",
    fields: [
      {
        key: "google_business_url",
        label: "Google Business Profile",
        kind: "url",
        help: "The share link from your Google Business Profile. The single most valuable one here for local search.",
        placeholder: "https://maps.app.goo.gl/…",
      },
      { key: "instagram_url", label: "Instagram", kind: "url", placeholder: "https://instagram.com/…" },
      { key: "facebook_url", label: "Facebook", kind: "url", placeholder: "https://facebook.com/…" },
      { key: "linkedin_url", label: "LinkedIn", kind: "url", placeholder: "https://linkedin.com/company/…" },
      { key: "youtube_url", label: "YouTube", kind: "url", placeholder: "https://youtube.com/@…" },
      { key: "x_url", label: "X (Twitter)", kind: "url", placeholder: "https://x.com/…" },
    ],
  },
]

export const SETTING_KEYS: string[] = SETTING_GROUPS.flatMap((g) => g.fields.map((f) => f.key))

export const FIELD_BY_KEY: Record<string, SettingField> = Object.fromEntries(
  SETTING_GROUPS.flatMap((g) => g.fields).map((f) => [f.key, f])
)

/**
 * Validation runs on the way IN, because every one of these values is rendered on a public page.
 * A malformed WhatsApp number does not throw — it produces a link that silently opens a chat with
 * nobody, which is exactly the failure that made this screen necessary.
 *
 * Returns an error string, or null when the value is acceptable. Empty is always acceptable: it
 * means "don't show this".
 */
export function validateSetting(field: SettingField, value: string): string | null {
  const v = value.trim()
  if (!v) return null

  switch (field.kind) {
    case "whatsapp":
      if (!/^\d{10,15}$/.test(v)) {
        return `${field.label} must be digits only, including the country code — for example 919821101868. No +, spaces or dashes.`
      }
      if (/^(\d)\1+$/.test(v)) return `${field.label} does not look like a real number.`
      // The dummy number that shipped to production for months. Worth refusing by name.
      if (v === "919876543210" || v === "9876543210") {
        return `${field.label} is the standard placeholder number, not a real one. Enter the number customers should actually reach.`
      }
      return null

    case "phone":
      if (!/^[\d+\-() ]{7,20}$/.test(v)) return `${field.label} does not look like a phone number.`
      return null

    case "email":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return `${field.label} is not a valid email address.`
      return null

    case "url":
      try {
        const url = new URL(v)
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          return `${field.label} must be a web address starting with https://`
        }
        return null
      } catch {
        return `${field.label} must be a full web address starting with https://`
      }

    default:
      return null
  }
}
