/**
 * Shared shape for the invite action and the panel that renders its result.
 *
 * Deliberately NOT in invite-actions.ts. That file carries "use server", and such a module may only
 * export async functions — exporting a plain object from it throws at module evaluation with
 * "A 'use server' file can only export async functions, found object", which surfaces as an opaque
 * 500 on the whole baker page. Types are erased so they would have been fine; the constant is not.
 */

export interface InviteState {
  /** The full activation URL. Present ONCE, immediately after generating it. Never persisted. */
  activationUrl: string | null
  expiresAt: string | null
  error: string | null
}

export const EMPTY_INVITE_STATE: InviteState = {
  activationUrl: null,
  expiresAt: null,
  error: null,
}
