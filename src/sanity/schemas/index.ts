import type { SchemaTypeDefinition } from "sanity"

import article from "./article"
import author from "./author"
import category from "./category"
import youtube from "./youtube"

/**
 * One schema, both brands.
 *
 * CrossFriend and Pranajiva publish very different things, but they publish them in the same shape:
 * a headline, an author who can be held to it, a date, a body, and the handful of fields that decide
 * how it appears in a search result. Two schemas would mean every improvement — a new SEO rule, a
 * better video block — has to be made twice and will eventually be made once.
 *
 * Where the brands genuinely differ is content, not structure: `reviewedBy` matters far more on a
 * wellness article than on a piece about cake sizes. That is an editorial expectation, not a reason
 * to fork the model, so the field exists in both and is optional in both.
 */
export const schemaTypes: SchemaTypeDefinition[] = [article, author, category, youtube]
