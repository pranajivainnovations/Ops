/**
 * Small parsing primitives shared by the corpus readers.
 *
 * The Cowork pipelines write prose documents, not an API. Everything structured that OPS shows —
 * topic counts, formula records, the product portfolio — is read out of Markdown tables and CSV
 * exports. These two helpers are the whole of that machinery; the pipeline-specific readers in
 * parse.ts are built from them.
 */

/**
 * CSV, handling quoted fields, embedded commas, embedded newlines and doubled quotes.
 *
 * Written out rather than pulled in: the product portfolio is a Google Sheet exported to CSV, and
 * Sheets emits exactly the RFC 4180 shape below. A dependency would be more code than this, and the
 * failure mode of a naive `split(",")` is not an error but a silently wrong table — the portfolio's
 * longest field is a comma-laden product description, so every row would shift.
 */
export function parseCsv(raw: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]

    if (inQuotes) {
      if (char === '"') {
        // A doubled quote inside a quoted field is a literal quote, not the end of the field.
        if (raw[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else if (char !== "\r") {
      field += char
    }
  }

  // A file that does not end in a newline still has one last field to flush.
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""))
}

export interface MarkdownTable {
  headers: string[]
  rows: string[][]
}

/**
 * Every Markdown table in a document, in order.
 *
 * Google Docs exported as Markdown write their alignment row as `| :---- | :---- |` rather than the
 * `| --- |` most authors type, so the divider test accepts any run of dashes with optional colons.
 * Without that, a Google Doc's tables parse as ordinary paragraphs and every count reads as zero —
 * which looks like an empty pipeline rather than a parser that did not recognise the format.
 */
export function parseMarkdownTables(text: string): MarkdownTable[] {
  const tables: MarkdownTable[] = []
  const lines = text.split(/\r?\n/)

  const cells = (line: string): string[] =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim())

  const isDivider = (line: string): boolean =>
    /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim())

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim().startsWith("|")) continue
    if (i + 1 >= lines.length || !isDivider(lines[i + 1])) continue

    const headers = cells(line)
    const rows: string[][] = []

    let j = i + 2
    while (j < lines.length && lines[j].trim().startsWith("|")) {
      rows.push(cells(lines[j]))
      j++
    }

    tables.push({ headers, rows })
    i = j - 1
  }

  return tables
}

/** Strip the Markdown emphasis and escaping a Google Docs export sprinkles through table cells. */
export function plain(value: string): string {
  return value
    .replace(/\\([_*`#])/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim()
}

/** The first integer in a string, or null. Counts arrive as "30 of 30" and "142 topics". */
export function firstInt(value: string): number | null {
  const match = /-?\d+/.exec(value.replace(/,/g, ""))
  return match ? Number(match[0]) : null
}
