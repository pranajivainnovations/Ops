/**
 * Readers for the four pipelines' control documents.
 *
 * Each one turns a document the pipelines already write into a structure OPS can render. They are
 * deliberately forgiving: every field is optional, an unrecognised document yields an empty result
 * rather than an exception, and the caller decides what to show when nothing was found. A pipeline
 * that reformats its output should make a screen go quiet, never make it crash.
 *
 * ── Why parse prose at all ──────────────────────────────────────────────────────────────────────
 * Because the state already exists and is already accurate. PIPELINE_STATUS knows there are 432
 * topics and how they split by priority and flag; the portfolio sheet knows which of 18 concepts is
 * rejected. Asking the pipelines to also emit JSON would be cleaner, but it would mean nothing
 * displayed until all four were changed. If a machine-readable sidecar ever appears alongside a
 * document, prefer it — these readers are the fallback that makes the section work today.
 */

import { firstInt, parseCsv, parseMarkdownTables, plain, type MarkdownTable } from "./text"

/* ────────────────────────────── P02 — Content Engine ────────────────────────────── */

export interface CountRow {
  label: string
  count: number
  /** Present on the priority table, which tracks how many of each priority are still outstanding. */
  remaining?: number
}

export interface HeadlineRow {
  label: string
  /**
   * The cell as written, because not every headline value is a number. "All topics at status" reads
   * `DISCOVERED`, and rendering that as the 0 a numeric parse produces would state the opposite of
   * what the pipeline said.
   */
  value: string
  /** The number in the cell, when there is one. */
  count: number | null
}

export interface ContentPipelineState {
  headline: HeadlineRow[]
  priorities: CountRow[]
  flags: CountRow[]
  attributes: CountRow[]
  /** DISCOVERED → RESEARCHED → … , as the pipeline document itself defines it. */
  workflow: string[]
  phase: string | null
  lastUpdated: string | null
}

/**
 * PIPELINE_STATUS, the P02 dashboard.
 *
 * Its tables are matched by their header text rather than their position, because a Google Doc gains
 * and loses tables as it is edited and an index-based reader would silently start reporting the
 * wrong numbers — the failure mode being plausible figures, not an error.
 */
export function parseContentPipeline(text: string): ContentPipelineState {
  const tables = parseMarkdownTables(text)

  const headerLooksLike = (table: MarkdownTable, pattern: RegExp): boolean =>
    table.headers.some((h) => pattern.test(plain(h)))

  const twoColumnCounts = (table: MarkdownTable | undefined): CountRow[] => {
    if (!table) return []
    return table.rows
      .map((row) => ({ label: plain(row[0] ?? ""), count: firstInt(row[1] ?? "") ?? 0 }))
      .filter((r) => r.label !== "")
  }

  /**
   * The headline table has no header text at all — it is a bare two-column key/value block, so it
   * is identified by its content ("Topics discovered", "Blogs published") instead.
   */
  const headlineTable = tables.find((t) =>
    t.rows.some((row) => /topics discovered|chapters processed|blogs/i.test(plain(row[0] ?? "")))
  )

  const priorityTable = tables.find((t) => headerLooksLike(t, /^priority$/i))
  const flagTable = tables.find((t) => headerLooksLike(t, /^flag$/i))
  const attributeTable = tables.find((t) => headerLooksLike(t, /content attribute/i))

  const priorities: CountRow[] = (priorityTable?.rows ?? [])
    .map((row) => ({
      label: plain(row[0] ?? ""),
      count: firstInt(row[1] ?? "") ?? 0,
      remaining: firstInt(row[2] ?? "") ?? undefined,
    }))
    .filter((r) => r.label !== "")

  /**
   * The workflow is read from under the document's own `## WORKFLOW` heading, not from the first
   * mention of DISCOVERED anywhere in the file.
   *
   * That distinction matters: the word DISCOVERED appears much earlier, in the status table's "All
   * topics at status" row, and a window anchored there captures that one word and nothing else — so
   * the pipeline rendered as a single-step workflow instead of the seven-stage one it defines.
   */
  const workflowSection = /^##\s+WORKFLOW\s*$([\s\S]*?)(?=^##\s|\Z)/im.exec(text)
  const workflow = workflowSection
    ? Array.from(
        new Set(
          workflowSection[1].match(
            /\b(DISCOVERED|RESEARCHED|EVIDENCE READY|DRAFTED|REVIEW|APPROVED|PUBLISHED)\b/g
          ) ?? []
        )
      )
    : []

  const phase = /\*\*Phase:\*\*\s*([^\n*]+)/i.exec(text)?.[1]?.trim() ?? null
  const lastUpdated = /\*\*Last updated:\*\*\s*([^\n*(]+)/i.exec(text)?.[1]?.trim() ?? null

  const headline: HeadlineRow[] = (headlineTable?.rows ?? [])
    .map((row) => {
      // The parenthetical is dropped from the display value only: "30 of 30 (Sutrasthana, complete)"
      // is useful prose and a terrible stat-card heading.
      const raw = plain(row[1] ?? "")
      return {
        label: plain(row[0] ?? ""),
        value: raw.replace(/\s*\(.*\)\s*$/, "").trim() || raw,
        count: firstInt(raw),
      }
    })
    .filter((r) => r.label !== "")

  return {
    headline,
    priorities,
    flags: twoColumnCounts(flagTable),
    attributes: twoColumnCounts(attributeTable),
    workflow,
    phase,
    lastUpdated,
  }
}

/* ────────────────────────────── P01 — Formula Engine ────────────────────────────── */

export interface ClassicalFormula {
  /** The corpus's own stable identifier, e.g. AH-SU-0042. Used as the decision key. */
  id: string
  name: string
  chapter: string | null
  reference: string | null
  ingredients: string | null
  quantities: string | null
  processing: string | null
  purpose: string | null
  /** A, B, C or D — the corpus's evidence grading. A is a complete formulation. */
  evidenceLevel: string | null
  category: string | null
  uncertainties: string | null
  contraindication: string | null
  safetyQuestions: string | null
}

/**
 * The classical formula library — 76 entries, each an `### AH-SU-####` heading followed by a
 * `- **Field:** value` list.
 *
 * Fields are collected into a map and then looked up by prefix, because the field names are prose
 * and vary between entries: "Sanskrit" and "Sanskrit (as given)", "Contraindication" and
 * "Contraindication (source-stated)". Matching on a prefix reads both; matching exactly would drop
 * a contraindication from some entries and keep it in others, which is the worst possible outcome
 * for a safety field.
 */
export function parseFormulaLibrary(text: string): ClassicalFormula[] {
  const formulas: ClassicalFormula[] = []
  const lines = text.split(/\r?\n/)

  let chapter: string | null = null
  let current: { id: string; name: string; fields: Map<string, string> } | null = null

  const flush = () => {
    if (!current) return
    const get = (...prefixes: string[]): string | null => {
      for (const prefix of prefixes) {
        for (const [key, value] of current!.fields) {
          if (key.startsWith(prefix)) return value || null
        }
      }
      return null
    }

    const evidence = get("evidence")
    formulas.push({
      id: current.id,
      name: current.name,
      chapter,
      reference: get("sthana", "sthāna", "chapter"),
      ingredients: get("ingredient"),
      quantities: get("quantit"),
      processing: get("processing", "preparation"),
      purpose: get("traditional purpose", "purpose", "use"),
      // "A (Formulation-level — …)" → "A". The grade is the first letter; the rest is commentary.
      evidenceLevel: evidence ? (/^([A-D])\b/.exec(evidence.trim())?.[1] ?? null) : null,
      category: get("modern product"),
      uncertainties: get("uncertaint"),
      contraindication: get("contraindication"),
      safetyQuestions: get("safety"),
    })
    current = null
  }

  for (const line of lines) {
    const chapterHeading = /^##\s+(Chapter\s+.+)$/i.exec(line)
    if (chapterHeading) {
      flush()
      chapter = plain(chapterHeading[1])
      continue
    }

    // `### AH-SU-0001 — Danta Dhavana (tooth-cleaning twigs)` — em dash, en dash or hyphen.
    const entryHeading = /^###\s+([A-Z]{2,}-[A-Z]{2,}-\d+)\s*[—–-]?\s*(.*)$/.exec(line)
    if (entryHeading) {
      flush()
      current = { id: entryHeading[1], name: plain(entryHeading[2]) || entryHeading[1], fields: new Map() }
      continue
    }

    if (!current) continue

    const field = /^[-*]\s+\*\*(.+?):?\*\*:?\s*(.*)$/.exec(line)
    if (field) {
      current.fields.set(plain(field[1]).toLowerCase(), plain(field[2]))
    }
  }

  flush()
  return formulas
}

/**
 * A formula's "modern product-relevant category" is often several categories in one cell —
 * "Skin/Glow-complexion, Pastes", "Ghrita, Other (medicinal, not cosmetic)".
 *
 * Taken whole, 76 formulas produce 39 distinct values, most of them combinations, and a filter built
 * from them cannot answer "show me everything for skin" — the one question it exists for. Split, the
 * same corpus yields a short list of real categories, and a formula shows up under each of them.
 *
 * The trailing parenthetical is kept, because "Other (medicinal, not cosmetic)" is not "Other".
 */
export function splitCategories(category: string | null): string[] {
  if (!category) return []
  return category
    .split(/,(?![^(]*\))/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * A topic's type is a semicolon-joined list — "FOUNDATION; HISTORICAL", "DOSHA; AYURVEDIC CONCEPT".
 *
 * Left whole, 432 topics produce 122 distinct values and a filter nobody can use. Split, they
 * collapse to a workable set of real types, and a topic appears under each one it carries.
 */
export function splitTopicTypes(value: string | null): string[] {
  if (!value) return []
  return value
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/* ──────────────────────── P04 — Product Concept Research ──────────────────────── */

export interface ProductConcept {
  /** The row number in the portfolio sheet — its stable identity and the decision key. */
  number: number
  name: string
  originalIngredients: string | null
  evolved: string | null
  primaryNeed: string | null
  source: string | null
  status: string | null
  researchOrder: number | null
}

/**
 * The product portfolio sheet.
 *
 * Columns are found by walking backwards from the end of the row rather than by header index,
 * because the sheet has at least one row whose unquoted commas spill a single cell across three
 * columns — row 1's "Hair nourishment, scalp/hair care, regular oiling" — and a fixed index reads
 * that row's status as "regular oiling" and its order as a sentence.
 *
 * The invariant that survives the spill: the last numeric cell in a row is its research order, and
 * the cell before it is its status. Anchoring on that reads the malformed row correctly and the
 * well-formed rows identically, without needing the sheet to be cleaned up first.
 */
export function parseProductPortfolio(raw: string): ProductConcept[] {
  const rows = parseCsv(raw)
  if (rows.length < 2) return []

  return rows
    .slice(1)
    .map((row) => {
      const number = firstInt(row[0] ?? "")
      if (number === null) return null

      const cells = row.map((c) => c.trim())

      let orderIndex = -1
      for (let i = cells.length - 1; i >= 1; i--) {
        if (cells[i] !== "" && /^\d+$/.test(cells[i])) {
          orderIndex = i
          break
        }
      }

      const researchOrder = orderIndex > 0 ? Number(cells[orderIndex]) : null
      const status = orderIndex > 1 ? cells[orderIndex - 1] || null : null

      return {
        number,
        name: cells[1] || `Concept ${number}`,
        originalIngredients: cells[2] || null,
        evolved: cells[3] || null,
        primaryNeed: cells[4] || null,
        // Only trustworthy when the row is well-formed; on the spilled row it lands on a fragment,
        // which is why it is shown as supporting detail rather than anything the UI filters on.
        source: orderIndex > 2 ? cells[orderIndex - 2] || null : null,
        status,
        researchOrder,
      }
    })
    .filter((p): p is ProductConcept => p !== null)
}

/**
 * Group the portfolio's free-text statuses into the three states the team actually works in.
 *
 * The sheet's status column is prose written by the pipeline — "Completed", "Rejected as conceived",
 * "To research", "Opportunity — not yet researched as product". Matching on substrings keeps a new
 * wording from falling out of the counts entirely; anything unrecognised counts as queued, which
 * over-reports work remaining rather than under-reporting it.
 */
export function classifyProductStatus(status: string | null): "done" | "rejected" | "queued" {
  const value = (status ?? "").toLowerCase()
  if (/reject|dropped|abandon/.test(value)) return "rejected"
  if (/complete|done|finished/.test(value)) return "done"
  return "queued"
}

/* ───────────────────────────── The 432-topic index ───────────────────────────── */

export interface TopicRow {
  key: string
  title: string
  /** "01 — Ayuskamiya (Desire for Long Life)". See parseTopicIndex for why they are joined. */
  chapter: string | null
  chapterNumber: string | null
  chapterName: string | null
  status: string | null
  priority: string | null
  flags: string | null
  description: string | null
  /** "FOUNDATION; HISTORICAL" — one topic can carry several. */
  topicType: string | null
  /** Y/N. The single most useful filter for choosing what to write about. */
  consumerRelevant: string | null
  evidenceStrength: string | null
  /** Set once the pipeline has produced the artefact; empty means the stage has not run. */
  evidencePack: string | null
  blog: string | null
  /** Every column as read, so the detail view can show fields this reader does not model. */
  raw: Record<string, string>
}

export interface TopicIndex {
  columns: string[]
  topics: TopicRow[]
}

/**
 * master_index.csv — the machine state behind the 432 topics.
 *
 * Columns are located by matching their header text rather than by position, and every column is
 * kept in `raw` regardless of whether this reader models it. A header it does not recognise costs
 * one filter, never the table.
 *
 * The real schema, confirmed against the file, is 19 columns:
 *   Topic ID · Chapter Number · Chapter Name · Topic Number · Topic Name · Topic Type ·
 *   Short Description · Primary Source Reference · Related References · Formula Present ·
 *   Procedure Present · Consumer Relevant · Evidence Strength · Priority · Status · Flags ·
 *   Evidence Pack Location · Blog Location · Last Updated
 *
 * Two of those pairs are why the patterns below are ordered rather than merely permissive: a bare
 * /chapter/ matches "Chapter Number" first and would label every row "01", and a bare /topic/
 * matches "Topic ID" before "Topic Name". The specific pattern is always tried before the loose one.
 */
export function parseTopicIndex(rawCsv: string): TopicIndex {
  const rows = parseCsv(rawCsv)
  if (rows.length < 2) return { columns: [], topics: [] }

  const headers = rows[0].map((h) => h.trim())

  /** First header matching the first pattern that matches anything — order is the priority. */
  const findColumn = (...patterns: RegExp[]): number => {
    for (const pattern of patterns) {
      const index = headers.findIndex((h) => pattern.test(h))
      if (index >= 0) return index
    }
    return -1
  }

  const idIndex = findColumn(/^(topic[_ ]?id|id|key)$/i, /topic[_ ]?id/i)
  const titleIndex = findColumn(/^topic[_ ]?name$/i, /topic[_ ]?(title|name)/i, /^(title|name)$/i)
  const chapterNameIndex = findColumn(/^chapter[_ ]?name$/i, /chapter[_ ]?(name|title)/i)
  const chapterNumberIndex = findColumn(/^chapter[_ ]?number$/i, /chapter[_ ]?(number|no)/i)
  const statusIndex = findColumn(/^status$/i, /status/i)
  const priorityIndex = findColumn(/^priority$/i, /priority/i)
  const flagIndex = findColumn(/^flags?$/i, /flag/i)
  const descriptionIndex = findColumn(/^short[_ ]?description$/i, /description|summary/i)
  const typeIndex = findColumn(/^topic[_ ]?type$/i, /^type$/i)
  const consumerIndex = findColumn(/^consumer[_ ]?relevant$/i, /consumer/i)
  const evidenceIndex = findColumn(/^evidence[_ ]?strength$/i, /evidence[_ ]?(strength|level)/i)
  const packIndex = findColumn(/^evidence[_ ]?pack[_ ]?location$/i, /evidence[_ ]?pack/i)
  const blogIndex = findColumn(/^blog[_ ]?location$/i, /^blog/i)

  const at = (row: string[], index: number): string | null =>
    index >= 0 ? row[index]?.trim() || null : null

  const topics = rows.slice(1).map((row, rowNumber) => {
    const raw: Record<string, string> = {}
    headers.forEach((header, index) => {
      const value = row[index]?.trim()
      if (header && value) raw[header] = value
    })

    const chapterName = at(row, chapterNameIndex)
    const chapterNumber = at(row, chapterNumberIndex)

    return {
      key: at(row, idIndex) ?? `row-${rowNumber + 1}`,
      title: at(row, titleIndex) ?? at(row, idIndex) ?? `Topic ${rowNumber + 1}`,
      /**
       * Number and name joined into one label, used for both display and filtering.
       *
       * The name alone is what a person recognises, but the corpus is ordered — topics cite "AH Su
       * 1.2", the chapters run 1–30 in a fixed sequence, and a filter list sorted alphabetically by
       * name scatters that order beyond recovery. Zero-padded numbers sort as the text they are, so
       * one joined string gives a readable label and chapter order for free.
       */
      chapter:
        chapterNumber && chapterName
          ? `${chapterNumber} — ${chapterName}`
          : chapterName ?? chapterNumber,
      chapterNumber,
      chapterName,
      status: at(row, statusIndex),
      priority: at(row, priorityIndex),
      flags: at(row, flagIndex),
      description: at(row, descriptionIndex),
      topicType: at(row, typeIndex),
      consumerRelevant: at(row, consumerIndex),
      evidenceStrength: at(row, evidenceIndex),
      evidencePack: at(row, packIndex),
      blog: at(row, blogIndex),
      raw,
    }
  })

  return { columns: headers.filter(Boolean), topics }
}
