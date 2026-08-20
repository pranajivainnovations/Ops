/**
 * The commands the Cowork content pipeline understands, for a given topic.
 *
 * ── Why OPS prints commands instead of running them ─────────────────────────────────────────────
 * Cowork has no API to call. The pipeline is driven by a person typing into a Cowork session, and
 * nothing about that is reachable from a server action. Pretending otherwise — a "Generate" button
 * that queued something OPS could not actually deliver — would produce a screen that lies about
 * whether work has started.
 *
 * So OPS does the part it genuinely can: it holds the corpus, it holds the decision about which
 * topic is next, and it hands over the exact string to paste. The topic ID is the join between the
 * two systems, and it is stable — `PJ-C01-T01` means the same thing in master_index.csv, in the
 * Evidence Pack filename, and in the Cowork session.
 *
 * If a trigger endpoint ever exists, this file is where the command text already lives, and the
 * button can call it instead of offering it for copying.
 */

export interface CoworkCommand {
  /** What to type into Cowork. */
  command: string
  /** What Cowork does with it — the pipeline's own description, not a paraphrase. */
  effect: string
  /** True when the command writes files to Drive, which is worth flagging before someone runs it. */
  writes: boolean
}

/**
 * Ordered by increasing commitment: look, then research, then write.
 *
 * That ordering is the advice. "Show evidence" costs nothing and answers "is there anything here";
 * "Research" builds the Evidence Pack and stops, which is the right move when the topic looks
 * promising but the article is not yet wanted; "Generate" produces the article and SEO package and
 * is the only one that ends with something publishable.
 */
export function coworkCommandsFor(topicKey: string): CoworkCommand[] {
  return [
    {
      command: `Show evidence for ${topicKey}`,
      effect: "Displays what the corpus holds for this topic. Writes nothing.",
      writes: false,
    },
    {
      command: `Research ${topicKey}`,
      effect:
        "Pulls every reference across the corpus and builds the Evidence Pack, then stops. No article.",
      writes: true,
    },
    {
      command: `Generate ${topicKey}`,
      effect: "Builds the Evidence Pack first, then the full article and SEO package.",
      writes: true,
    },
  ]
}
