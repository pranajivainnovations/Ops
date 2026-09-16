/**
 * Shared shape for the reward actions and the cards that render their result.
 *
 * Deliberately NOT in actions.ts. That file carries "use server", and such a module may only export
 * async functions — a plain object exported from it is turned into a server action REFERENCE, so a
 * client component importing it receives a function where it expected `{ blocks: [], warnings: [] }`
 * and dies on the first property access. It surfaces as "Cannot read properties of undefined
 * (reading 'length')" in the browser and an opaque 500 on the whole page during SSR.
 *
 * Types are erased at compile time and would have been fine either way; the constant is not.
 * `invite-types.ts` exists for exactly this reason, and this file is its twin.
 */

export interface SaveState {
  ok: boolean
  error: string | null
  /** Refusals. The save did not happen and will not until these are resolved. */
  blocks: string[]
  /** Accepted, but worth saying — a thin margin, an offer that stacks close to the line. */
  warnings: string[]
}

export const EMPTY_SAVE_STATE: SaveState = {
  ok: false,
  error: null,
  blocks: [],
  warnings: [],
}
