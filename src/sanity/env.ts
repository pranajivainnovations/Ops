/**
 * Sanity project coordinates for the two brands.
 *
 * ── Why the ids are inline defaults rather than required env vars ──────────────────────────────
 * A project id is not a secret. It appears in every request the browser makes to Sanity and in the
 * published HTML of any page that renders an image. What protects the content is the dataset's own
 * visibility and the CORS allow-list, neither of which this file can influence.
 *
 * Making them env-only would mean the Studio silently fails to mount whenever someone forgets a
 * variable — a failure mode with no useful error, on a screen whose whole job is to be reachable.
 * The env var still wins where it is set, so a throwaway dataset can be pointed at for testing.
 *
 * ── Why the datasets are public ────────────────────────────────────────────────────────────────
 * Both storefronts read published articles server-side with no token. A public dataset is what
 * makes that possible without shipping a credential into a container, and a blog has nothing in it
 * that is not intended to be read. Drafts are a separate matter: Sanity keeps them under a
 * `drafts.` prefix that the public API does not return, so unpublished work stays unpublished.
 */

export const CROSSFRIEND = {
  projectId: process.env.NEXT_PUBLIC_SANITY_CROSSFRIEND_PROJECT_ID || "q9n8m46w",
  dataset: process.env.NEXT_PUBLIC_SANITY_CROSSFRIEND_DATASET || "production",
  title: "CrossFriend Knowledge",
  /** Where these articles are published, used to build previews and canonical URLs. */
  siteUrl: "https://crossfriend.in",
  basePath: "/knowledge",
} as const

export const PRANAJIVA = {
  projectId: process.env.NEXT_PUBLIC_SANITY_PRANAJIVA_PROJECT_ID || "dlrwy20z",
  dataset: process.env.NEXT_PUBLIC_SANITY_PRANAJIVA_DATASET || "production",
  title: "Pranajiva Knowledge",
  siteUrl: "https://pranajiva.in",
  basePath: "/pranajiva/knowledge",
} as const

/** The API version pins query behaviour; bump it deliberately, never automatically. */
export const SANITY_API_VERSION = "2024-10-01"

export type BrandConfig = typeof CROSSFRIEND | typeof PRANAJIVA
