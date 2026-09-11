import { defineConfig, type WorkspaceOptions } from "sanity"
import { structureTool } from "sanity/structure"
import { visionTool } from "@sanity/vision"

import { CROSSFRIEND, PRANAJIVA, SANITY_API_VERSION, type BrandConfig } from "./env"
import { schemaTypes } from "./schemas"

/**
 * Studio configuration for the two brands.
 *
 * ── Why two configs rather than one with two workspaces ────────────────────────────────────────
 * Sanity can host several workspaces in a single Studio and offer a switcher. That would be the
 * right answer if the two brands lived side by side in OPS, but they do not: OPS is already split
 * into a CrossFriend section and a Pranajiva section, each with its own navigation and its own
 * mental context. Mounting one Studio per section means the brand you are editing is decided by
 * where you already are, and there is no second switcher to get wrong.
 *
 * ── Why basePath matters ───────────────────────────────────────────────────────────────────────
 * The Studio owns its own routing beneath whatever path it is mounted at. Getting this wrong does
 * not error — it produces a Studio that loads once and then navigates to URLs that do not exist, so
 * it must match the route segment exactly.
 */
function brandConfig(brand: BrandConfig): WorkspaceOptions {
  return defineConfig({
    name: brand.projectId,
    title: brand.title,
    basePath: brand.basePath,
    projectId: brand.projectId,
    dataset: brand.dataset,
    apiVersion: SANITY_API_VERSION,
    schema: { types: schemaTypes },
    plugins: [
      structureTool(),
      /* The query playground. Kept because the storefronts read this content with GROQ, and being
         able to run the exact query a page uses — against the real dataset, next to the content —
         is the difference between debugging in the Studio and debugging in a deploy. */
      visionTool({ defaultApiVersion: SANITY_API_VERSION }),
    ],
    document: {
      /* "Open preview" points at the live article rather than a Studio preview pane. There is no
         preview route on either storefront yet, and a link to a page that does not exist is worse
         than no link — so this resolves to the published URL, which is exactly what an editor
         checking their work wants to open. */
      productionUrl: async (prev, { document }) => {
        const doc = document as { _type?: string; slug?: { current?: string } }
        if (doc?._type !== "article" || !doc?.slug?.current) return prev
        return `${brand.siteUrl}/knowledge/${doc.slug.current}`
      },
    },
  }) as WorkspaceOptions
}

export const crossfriendConfig = brandConfig(CROSSFRIEND)
export const pranajivaConfig = brandConfig(PRANAJIVA)
