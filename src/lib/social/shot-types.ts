/**
 * The storyboard vocabulary, with nothing server-only in it.
 *
 * Split out of reels.ts because the builder is a client component and reels.ts opens a Postgres
 * pool at module scope — importing it from the browser bundle drags `pg` in and the build fails,
 * correctly. Everything here is a string or a type, so both sides share it.
 *
 * The two lists mirror SHOT_TYPES and CAMERA_MOVES in the backend's compose-prompt.ts. They are
 * duplicated rather than imported across repo boundaries, which is the same trade every other
 * shared constant in this codebase makes; if one changes, the other follows.
 */

export type TakeStatus = "rendering" | "ready" | "failed"

/**
 * A closed list rather than a free text box, because the value of this field is that it uses the
 * model's own vocabulary. "Zoomed out a bit" and "wide shot" are the same intention and only one
 * of them lands.
 */
export const SHOT_TYPES = [
  "Extreme wide shot",
  "Wide shot",
  "Medium shot",
  "Medium close-up",
  "Close-up",
  "Extreme close-up",
  "Over-the-shoulder shot",
  "Low-angle shot",
  "High-angle shot",
  "Eye-level shot",
  "Front view, eye-level",
  "Top-down overhead shot",
] as const

export const CAMERA_MOVES = [
  "Static camera",
  "Slow push-in dolly",
  "Slow pull-back dolly",
  "Slow pan left",
  "Slow pan right",
  "Slow tilt up",
  "Slow tilt down",
  "Handheld, subtle movement",
  "Orbit around the subject",
  "Crane up",
  "Tracking shot following the subject",
] as const

/**
 * Suggestions, not a closed list — audio is described in prose and the model takes what it is
 * given. "No dialogue" is first because it is the one most often wanted and least often
 * remembered: the model generates an audio track whether or not anybody asked for one.
 */
export const AUDIO_PRESETS = [
  "No dialogue",
  "No dialogue, ambient sound only",
  "No dialogue, no music",
  "Soft ambient festive sound, distant temple bells",
  "Gentle instrumental music, no speech",
] as const

export const dollars = (cents: number | null | undefined) => `$${((cents ?? 0) / 100).toFixed(2)}`
