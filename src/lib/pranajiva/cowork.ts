/**
 * The commands the PranaJiva content pipeline understands, for a given topic.
 *
 * ── Why OPS prints commands instead of running them ─────────────────────────────────────────────
 * The pipeline is driven by a person typing into a chat session in the `pranajiva_wellness`
 * project, and nothing about that is reachable from a server action. Pretending otherwise — a
 * "Generate" button that queued something OPS could not actually deliver — would produce a screen
 * that lies about whether work has started.
 *
 * So OPS does the part it genuinely can: it holds the corpus, it holds the decision about which
 * topic is next, and it hands over the exact string to paste. The topic ID is the join between the
 * two systems, and it is stable — `PJ-C12-T04` means the same thing in master_index.csv, in the
 * evidence pack filename, and in the chat session.
 *
 * If a trigger endpoint ever exists, this file is where the command text already lives, and the
 * button can call it instead of offering it for copying.
 *
 * ── These strings must match the pipeline's actual vocabulary ──────────────────────────────────
 * They previously did not. This file said "Show evidence for", "Research" and "Generate", which the
 * pipeline stopped understanding when it became bilingual and gained the blog/video split — so OPS
 * was confidently handing operators commands that no longer worked. A printed command that fails is
 * worse than no button at all, because the operator reasonably assumes the pipeline is broken
 * rather than the label. Anything changed on the pipeline side has to be changed here in the same
 * breath.
 */

export interface CoworkCommand {
  /** What to type into the pipeline chat. */
  command: string
  /** What the pipeline does with it — its own description, not a paraphrase. */
  effect: string
  /** True when the command writes files to Drive, which is worth flagging before someone runs it. */
  writes: boolean
  /** Set when the command pauses for a human decision partway through. */
  pauses?: boolean
}

/**
 * Ordered by increasing commitment: look, then build the record, then write, then film.
 *
 * That ordering is the advice. "evidence for" costs nothing and answers "is there anything here";
 * "blog" produces something publishable and stops; "run" goes all the way to video packs but pauses
 * for approval before it does. Reaching for `run` first is rarely wrong, but it is the one that
 * will interrupt you.
 */
export function coworkCommandsFor(topicKey: string): CoworkCommand[] {
  return [
    {
      command: `evidence for ${topicKey}`,
      effect:
        "Builds the sourced evidence pack alone — verses, commentary, disputes, what the passage does NOT say, and how each finding may be phrased. Files to evidence_packs. Never published.",
      writes: true,
    },
    {
      command: `blog ${topicKey}`,
      effect:
        "Evidence pack, then the English and Hindi blogs — each written natively, not translated, 1,100–1,300 words. Files to blogs/drafts as _EN.md and _HI.md. Stops there.",
      writes: true,
    },
    {
      command: `blog ${topicKey} in English only`,
      effect:
        "One language instead of both. Works the same for Hindi, and for reels.",
      writes: true,
    },
    {
      command: `run ${topicKey}`,
      effect:
        "Everything: evidence pack, both blogs, then it STOPS for your approval before writing the video packs. Nothing is built on top of a blog nobody has read.",
      writes: true,
      pauses: true,
    },
    {
      command: `reels for ${topicKey}`,
      effect:
        "Five short-video scripts in each language from blogs that already exist, plus the voiceover job and the Shotstack edit files. Files to scripts/drafts in P05.",
      writes: true,
    },
    {
      command: `re-cut R2 for ${topicKey} with 5 new hooks`,
      effect:
        "Fresh hook variants for one script, appended to the existing pack. Nothing else in the pack is rewritten, and only that script's render files are regenerated.",
      writes: true,
    },
    {
      command: `render files for ${topicKey.replace(/^PJ-/, "PJV-")}`,
      effect:
        "Regenerates the voiceover job and the Shotstack edit from a pack that already exists, without rewriting a word of the scripts. Note the PJV- prefix — video files carry it.",
      writes: true,
    },
  ]
}

/**
 * Commands that are not about one topic.
 *
 * `verify chapter N` is the one worth knowing in advance. The Tripathi volumes are photographs of
 * pages rather than text, so a verse can only be checked by looking at the page — and the first
 * topic run from an unverified chapter will stop and ask for that PDF. Verifying the chapter up
 * front turns one interruption during a run into a deliberate act beforehand.
 */
export const PIPELINE_COMMANDS: CoworkCommand[] = [
  {
    command: "verify chapter 12",
    effect:
      "Reads that chapter's pages once and banks every verse, so later topics from it need no PDF. Clears the one interruption a run can hit.",
    writes: true,
  },
  {
    command: "where does everything stand",
    effect: "Status of all topics, read live from Drive.",
    writes: false,
  },
  {
    command: "what topics are in chapter 12",
    effect: "The chapter's topics with their IDs, so you can pick one.",
    writes: false,
  },
  {
    command: "overwrite",
    effect:
      "Replaces what already exists — the run refuses to do this on its own. Also: overwrite EN, overwrite HI, overwrite blog only.",
    writes: true,
  },
]
