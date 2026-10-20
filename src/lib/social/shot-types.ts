/**
 * The shot vocabulary, with nothing server-only in it.
 *
 * Split out of reels.ts because the builder is a client component and needs the mode labels and
 * types. reels.ts opens a Postgres pool at module scope, so importing it from the browser bundle
 * drags `pg` in with it and the build fails — correctly, since a database pool has no business in
 * a browser. Everything here is a string or a type, so both sides can share it.
 */

export type ShotMode = "text" | "image" | "first_last" | "continue"
export type ShotStatus = "queued" | "rendering" | "ready" | "failed"

export const MODE_LABEL: Record<ShotMode, string> = {
  text: "From the prompt alone",
  image: "Anchored to an opening frame",
  first_last: "Between a first and last frame",
  continue: "Continues the previous shot",
}

export const dollars = (cents: number | null | undefined) => `$${((cents ?? 0) / 100).toFixed(2)}`
