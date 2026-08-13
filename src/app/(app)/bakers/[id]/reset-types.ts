/**
 * Shared shape for the reset action and the panel that renders its result.
 *
 * Deliberately NOT in reset-actions.ts. That file carries "use server", and such a module may only
 * export async functions — exporting a plain object from it throws at module evaluation with
 * "A 'use server' file can only export async functions, found object", which surfaces as an opaque
 * 500 on the whole baker page. Same reasoning as invite-types.ts.
 */

export interface ResetState {
  /** One line per thing that actually happened, shown after a successful reset. */
  done: string[]
  error: string | null
}

export const EMPTY_RESET_STATE: ResetState = {
  done: [],
  error: null,
}
