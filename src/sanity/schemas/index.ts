import type { SchemaTypeDefinition } from "sanity"

import defineArticle from "./article"
import author from "./author"
import category from "./category"
import concern from "./concern"
import { objectTypes } from "./objects"
import practice from "./practice"
import remedy from "./remedy"
import youtube from "./youtube"

/**
 * One schema per brand, built from mostly shared parts.
 *
 * ── What stayed shared ─────────────────────────────────────────────────────────────────────────
 * CrossFriend and Pranajiva publish very different things, but they publish prose in the same
 * shape: a headline, an author who can be held to it, a date, a body, and the handful of fields
 * that decide how it appears in a search result. `article`, `author`, `category` and `youtube` are
 * therefore identical in both, so an improvement to the SEO rules or the video block is made once.
 *
 * ── What stopped being shared, and why ─────────────────────────────────────────────────────────
 * Remedies, practices and the concerns that connect them are not a Pranajiva *style* of article —
 * they are structure a cake brand has no use for at all. The earlier note here argued that the
 * brands differ in content rather than structure and should not fork the model, and that was right
 * about articles. It stops being right once one brand needs ingredient lists and dosages: giving
 * CrossFriend a Remedy type would not be sharing, it would be clutter in a form an editor has to
 * read past every day.
 *
 * It is also load-bearing rather than tidiness. `article.concerns` references the `concern` type,
 * and a reference to a type absent from the schema is a Studio that fails to start — so the
 * CrossFriend article is built without that field rather than with a field pointing nowhere.
 */

/** Types every brand gets. The objects are shared because `keyFacts` and the body blocks are. */
const common: SchemaTypeDefinition[] = [author, category, youtube, ...objectTypes]

export const crossfriendSchemaTypes: SchemaTypeDefinition[] = [
  defineArticle({ withConcerns: false }),
  ...common,
]

export const pranajivaSchemaTypes: SchemaTypeDefinition[] = [
  defineArticle({ withConcerns: true }),
  remedy,
  practice,
  concern,
  ...common,
]

/**
 * Kept for anything still importing the old name.
 *
 * Resolves to the Pranajiva set, which is the superset — a caller that wanted "all the types" gets
 * all of them rather than silently losing the wellness ones.
 */
export const schemaTypes = pranajivaSchemaTypes
