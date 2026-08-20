<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# How CrossFriend works

Read this before touching taxonomy, catalogue, or anything that lists products. These are settled
decisions, not suggestions — most of them were paid for by a bug.

## The one rule

**Medusa owns what exists. OPS owns what we do about it.**

If a product type or collection exists in Medusa, OPS shows it — all of it, unfiltered. The OPS
screen is where a human decides whether it is adopted into CrossFriend, what it is called, whether
it is active, and where it sits in the order.

Code never decides what exists. No hardcoded list of types, occasions, or collections anywhere —
not in an array, not in a constant, not in a `switch`. If you find one, it is a bug: it will drift
from the database, silently, and nothing will fail loudly when it does. That has already happened
once, when four separate hardcoded copies of the type/occasion map disagreed with each other and
with Medusa, and five of six navigation chips filtered on values no product could carry.

Adding a type or occasion must never require a deploy.

## The two axes, and what backs them

CrossFriend browses on exactly two axes — **occasion** and **type** — plus the matrix pairing them.

| Concept | Medusa primitive | CrossFriend registry |
|---|---|---|
| Occasion | `public.product_collection` | `crossfriend.occasions` (PK → collection id) |
| Type | `public.product_type` | `crossfriend.product_types` (PK → type id) |
| Matrix | *(none — Medusa cannot express it)* | `crossfriend.occasion_product_types` |

The registry tables are **foreign keys, not copies**. An occasion *is* a Medusa collection; a type
*is* a Medusa product type. The registry adds only what Medusa has nowhere to put: label, emoji,
`is_active`, display order, and the matrix.

This is why there is **no sync job, and must never be one**. A sync is a thing that drifts. A
foreign key cannot. If a task sounds like "keep OPS and Medusa in step", the answer is almost always
that the relationship should be a key, not a copy.

Registration is deliberate: a Medusa row is not a CrossFriend row until someone adopts it in OPS.
That is also the only thing keeping Pranajiva's product types out of CrossFriend navigation.

## What to ignore

**`product_category` — ignore it entirely for CrossFriend.** Legacy, partly Pranajiva's. Do not read
it, write it, filter on it, or "clean it up". It is not one of the two axes. Leave the rows alone.

Where CrossFriend code still touches categories, that is leftover to be removed, not a pattern to
copy.

## This Medusa install is shared with Pranajiva

One database, two brands. Nothing about the schema keeps them apart — you do.

- **Products are separated by sales channel.** Query without the CrossFriend `sales_channel_id` and
  you silently get Pranajiva's catalogue. It returns plausible numbers, not an error, so it does not
  look wrong. Resolve the channel via `/store/crossfriend/sales-channel` and always pass it.
- **Collections and categories** carry `metadata.brand` — filter on it.
- **Product types have no brand marker at all.** The registry is the only boundary. Never reconcile,
  prune, or bulk-edit `product_type` — Pranajiva's live there too.
- Never write across the brand line, in either direction.

## Traps already paid for

- **Soft-deleted rows.** Medusa soft-deletes. This database holds dead collections still occupying
  the handles `birthday`, `anniversary`, `festival`, `kids`, `special`. Every query must filter
  `deleted_at IS NULL` — without it, adoption matches a handle twice and registers the corpse.
  `product_category` is the exception: it has **no** `deleted_at` column, so adding that filter
  there breaks the query outright.
- **Product creation must set both axes.** A product with no `collection_id` cannot appear on any
  occasion page; a product on an unregistered type cannot appear anywhere at all. Both writers —
  the baker portal and AI Cake Studio — are the places to check.
- **Never invent a type at write time.** Passing `type: { value: "…" }` to Medusa *creates* a new
  product type. Resolve an existing registered type instead.
