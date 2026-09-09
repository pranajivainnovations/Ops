/**
 * PIPELINE_LEDGER.md — the pipeline's own record of where every topic stands.
 *
 * ── Why this file exists, and why the old status documents are no longer read ───────────────────
 * Until 2026-09-06 the pipelines published a family of PIPELINE_STATUS documents, and OPS read them
 * by name pattern. On that date all of them were retired into 99_ARCHIVE, renamed
 * `ARCHIVED_2026-09-06_…_superseded-by-PIPELINE_LEDGER`, and replaced by a single ledger.
 *
 * The rename did not save OPS: `/pipeline[_ ]?status/i` still matches
 * `ARCHIVED_2026-09-06_PIPELINE_STATUS_md_superseded-by-PIPELINE_LEDGER.md`, so the overview went on
 * rendering counts from three documents that say in their own first paragraph that they are
 * superseded. A screen reading retired data looks exactly like a screen reading current data, which
 * is the whole problem. Archived documents are now excluded at the source and this parser reads the
 * ledger instead.
 *
 * ── Why parse the ledger at all, when the files are the fact ────────────────────────────────────
 * Elsewhere in this section OPS deliberately trusts Drive over anything written down — master_index's
 * `Blog Location` column is empty on all 432 rows while the blogs demonstrably exist. That rule still
 * holds and file matching is still what fills the boards.
 *
 * But the ledger carries three things no filename can: the corrected verse reference, whether a blog
 * is in the current bilingual format or the retired scholarly one, and what the pipeline is waiting
 * for ("awaiting `overwrite EN`"). Those are judgements, not artifacts. So: files decide what exists,
 * the ledger annotates it, and the two are shown side by side rather than merged — where they
 * disagree, that disagreement is itself worth seeing.
 */

/** Rows carrying an em dash mean "nothing here" in the ledger's own notation. */
const EMPTY_CELL = /^(—|-|–|n\/a|none)?$/i

export interface LedgerArtifact {
  /** The Drive file id the ledger records, when it records one. */
  id: string | null
  /** Everything the cell says besides the id — "(old format)", "**format standard**", a warning. */
  note: string | null
}

export interface LedgerRow {
  topicKey: string
  topic: string
  /** The verse reference *after* verification. The master index's is provisional and often wrong. */
  verseRef: string | null
  evidencePack: LedgerArtifact
  blogEn: LedgerArtifact
  blogHi: LedgerArtifact
  videoPack: LedgerArtifact
  /** EVIDENCE → BLOG_DRAFT → BLOG_APPROVED → PACK_DRAFT → PUBLISHED. */
  stage: string | null
  updated: string | null
}

export interface Ledger {
  rows: LedgerRow[]
  /** The ledger's own tally table — "Blogs in current format | 3". */
  counts: { label: string; value: string }[]
  /** Unresolved questions the pipeline has recorded against itself. */
  openItems: { title: string; detail: string }[]
  lastUpdated: string | null
}

/** The ledger's stage vocabulary, in the order work moves through it. */
const STAGE_ORDER = ["EVIDENCE", "BLOG_DRAFT", "BLOG_APPROVED", "PACK_DRAFT", "PUBLISHED"]

export function ledgerStageRank(stage: string | null): number {
  if (!stage) return STAGE_ORDER.length
  const index = STAGE_ORDER.indexOf(stage.trim().toUpperCase())
  return index === -1 ? STAGE_ORDER.length : index
}

/**
 * Split one Markdown table row into its cells.
 *
 * Leading and trailing pipes are optional in the wild, so both are trimmed before splitting rather
 * than producing phantom empty cells at each end.
 */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
}

function isDivider(line: string): boolean {
  return /^\|?\s*:?-{2,}/.test(line.trim())
}

/**
 * Pull a Drive id and a human note out of one artifact cell.
 *
 * The ledger's convention is a backticked id followed by optional prose:
 * `` `1hbCh5…` (old format — **awaiting `overwrite EN`**) ``. The id is the first backticked run of
 * id-shaped characters; anything else in the cell is the note, with Markdown emphasis stripped so it
 * renders as text rather than as literal asterisks.
 *
 * Note the trap: the note itself can contain backticks (the `overwrite EN` above), so "first
 * backtick pair" is not enough — the run has to look like a Drive id, which is long and has no
 * spaces.
 */
function parseArtifactCell(cell: string): LedgerArtifact {
  const trimmed = cell.trim()
  if (EMPTY_CELL.test(trimmed)) return { id: null, note: null }

  const idMatch = /`([A-Za-z0-9_-]{20,})`/.exec(trimmed)
  const id = idMatch ? idMatch[1] : null

  const note = (id ? trimmed.replace(idMatch![0], "") : trimmed)
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^[\s(]+|[\s)]+$/g, "")
    .trim()

  return { id, note: note || null }
}

function plain(cell: string): string | null {
  const value = cell.replace(/\*\*/g, "").replace(/`/g, "").trim()
  return EMPTY_CELL.test(value) ? null : value
}

/**
 * Read the ledger.
 *
 * Every section is optional. A ledger that has lost its Counts table is still a usable ledger, and
 * the screens that show counts simply show nothing rather than the whole page failing — the same
 * posture the rest of this section takes toward documents that move, change shape or briefly break.
 */
export function parseLedger(text: string): Ledger {
  const lines = text.split(/\r?\n/)

  const rows: LedgerRow[] = []
  const counts: { label: string; value: string }[] = []
  const openItems: { title: string; detail: string }[] = []
  let lastUpdated: string | null = null

  /**
   * Which `##` section we are inside.
   *
   * The file holds several Markdown tables — the overwrite-protocol table, the companion-files
   * table, the ledger itself — and they are told apart by their heading, not by their shape. Keying
   * on shape would make the protocol table's "Stage of the existing file | What happens" rows parse
   * as topics.
   */
  let section: string | null = null
  let openItem: { title: string; detail: string } | null = null

  const flushOpenItem = () => {
    if (openItem) {
      openItem.detail = openItem.detail.trim()
      openItems.push(openItem)
      openItem = null
    }
  }

  for (const raw of lines) {
    const line = raw.trim()

    const heading = /^##\s+(.+)$/.exec(line)
    if (heading) {
      flushOpenItem()
      section = heading[1].replace(/\\/g, "").trim().toLowerCase()
      continue
    }

    const updated = /^last updated:\s*(.+)$/i.exec(line)
    if (updated) {
      lastUpdated = updated[1].replace(/\*\*/g, "").trim()
      continue
    }

    if (section === "ledger") {
      if (!line.startsWith("|") || isDivider(line)) continue
      const parts = cells(line)
      // Header row and anything that is not a topic row. The topic id is the join key everywhere in
      // this section, so a row without one is not a row about a topic.
      if (!/^PJV?-C\d+-T\d+$/i.test(parts[0] ?? "")) continue

      rows.push({
        topicKey: parts[0].trim().toUpperCase(),
        topic: plain(parts[1] ?? "") ?? "",
        verseRef: plain(parts[2] ?? ""),
        evidencePack: parseArtifactCell(parts[3] ?? ""),
        blogEn: parseArtifactCell(parts[4] ?? ""),
        blogHi: parseArtifactCell(parts[5] ?? ""),
        videoPack: parseArtifactCell(parts[6] ?? ""),
        stage: plain(parts[7] ?? ""),
        updated: plain(parts[8] ?? ""),
      })
      continue
    }

    if (section === "counts") {
      if (!line.startsWith("|") || isDivider(line)) continue
      const parts = cells(line)
      const label = plain(parts[0] ?? "")
      const value = plain(parts[1] ?? "")
      // The table opens with an empty `| | |` header, which parses to two nulls and is skipped.
      if (label && value) counts.push({ label, value })
      continue
    }

    if (section === "open items") {
      const bullet = /^[-*]\s+(.+)$/.exec(line)
      if (bullet) {
        flushOpenItem()
        // The convention is `- **Title — state.** detail…`, so the bold run is the title and
        // everything after it is the explanation.
        const titled = /^\*\*(.+?)\*\*\s*(.*)$/.exec(bullet[1])
        openItem = titled
          ? { title: titled[1].trim(), detail: titled[2].trim() }
          : { title: bullet[1].replace(/\*\*/g, "").trim(), detail: "" }
        continue
      }
      // Open items wrap across lines; a non-bullet line continues the one above it.
      if (openItem && line) {
        openItem.detail = `${openItem.detail} ${line.replace(/\*\*/g, "")}`.trim()
        continue
      }
      if (!line) flushOpenItem()
      continue
    }
  }

  flushOpenItem()

  return { rows, counts, openItems, lastUpdated }
}
