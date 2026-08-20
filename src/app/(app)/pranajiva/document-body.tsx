import React from "react"

/**
 * Minimal Markdown renderer for research documents.
 *
 * Deliberately not a Markdown library. The pipelines emit ordinary prose — headings, lists, tables,
 * fenced code — and pulling in a parser plus a sanitiser to cover the long tail of the spec would be
 * a large dependency for a reading surface. What is not covered degrades to plain text, which for a
 * document viewer is an acceptable floor.
 *
 * Everything is built as React elements rather than an HTML string, so there is no
 * dangerouslySetInnerHTML anywhere and no escaping to get wrong. Content arrives from our own Drive,
 * but a viewer that renders untrusted markup by construction is a liability nobody revisits.
 */

/** Inline formatting: `code`, **bold**, *italic*, and [text](url), applied in that precedence. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    const key = `${keyPrefix}-i${index++}`

    if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800">
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      )
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (link) {
        // Only http(s) is followed. A javascript: or data: URL in a document should render as the
        // text it is, never as something clickable.
        const safe = /^https?:\/\//i.test(link[2])
        nodes.push(
          safe ? (
            <a
              key={key}
              href={link[2]}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-900"
            >
              {link[1]}
            </a>
          ) : (
            <span key={key}>{link[1]}</span>
          )
        )
      } else {
        nodes.push(token)
      }
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

const HEADING_CLASS: Record<number, string> = {
  1: "mt-8 text-xl font-bold text-slate-900 first:mt-0",
  2: "mt-7 text-lg font-bold text-slate-900 first:mt-0",
  3: "mt-6 text-base font-semibold text-slate-900 first:mt-0",
  4: "mt-5 text-sm font-semibold text-slate-800 first:mt-0",
}

/** A markdown table row split into cells, tolerating the optional leading and trailing pipes. */
function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim())
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes("-")
}

export default function DocumentBody({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code — consumed verbatim, never formatted.
    if (/^\s*```/.test(line)) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        body.push(lines[i])
        i++
      }
      i++ // closing fence
      blocks.push(
        <pre
          key={`b${key++}`}
          className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800"
        >
          <code>{body.join("\n")}</code>
        </pre>
      )
      continue
    }

    if (!line.trim()) {
      i++
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const Tag = (["h1", "h2", "h3", "h4"] as const)[level - 1]
      blocks.push(
        <Tag key={`b${key++}`} className={HEADING_CLASS[level]}>
          {renderInline(heading[2], `b${key}`)}
        </Tag>
      )
      i++
      continue
    }

    // Horizontal rule. Checked before lists so a `---` divider is not read as a bullet.
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      blocks.push(<hr key={`b${key++}`} className="mt-6 border-slate-200" />)
      i++
      continue
    }

    // Table: a header row followed by a divider row.
    if (line.includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const header = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]))
        i++
      }
      blocks.push(
        <div key={`b${key++}`} className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {header.map((cell, c) => (
                  <th key={c} className="px-3 py-2 font-semibold">
                    {renderInline(cell, `h${key}-${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-b border-slate-100 last:border-0">
                  {row.map((cell, c) => (
                    <td key={c} className="px-3 py-2 align-top text-slate-700">
                      {renderInline(cell, `c${key}-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Blockquote — consecutive `>` lines become one quote.
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ""))
        i++
      }
      blocks.push(
        <blockquote
          key={`b${key++}`}
          className="mt-4 border-l-2 border-teal-300 bg-teal-50/40 py-2 pl-4 text-sm italic text-slate-700"
        >
          {renderInline(body.join(" "), `q${key}`)}
        </blockquote>
      )
      continue
    }

    // Lists. Ordered and unordered are gathered the same way; only the wrapper differs.
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      const ordered = Boolean(numbered)
      const items: string[] = []
      while (i < lines.length) {
        const item = ordered
          ? /^\s*\d+[.)]\s+(.*)$/.exec(lines[i])
          : /^\s*[-*+]\s+(.*)$/.exec(lines[i])
        if (!item) break
        items.push(item[1])
        i++
      }
      const ListTag = ordered ? "ol" : "ul"
      blocks.push(
        <ListTag
          key={`b${key++}`}
          className={`mt-3 space-y-1 pl-5 text-sm leading-relaxed text-slate-700 ${
            ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {items.map((item, n) => (
            <li key={n}>{renderInline(item, `l${key}-${n}`)}</li>
          ))}
        </ListTag>
      )
      continue
    }

    // Paragraph — consecutive non-blank lines that matched nothing else.
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(#{1,4}\s|```|>|[-*+]\s|\d+[.)]\s)/.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1]))
    ) {
      para.push(lines[i])
      i++
    }
    if (para.length > 0) {
      blocks.push(
        <p key={`b${key++}`} className="mt-3 text-sm leading-relaxed text-slate-700">
          {renderInline(para.join(" "), `p${key}`)}
        </p>
      )
    } else {
      // Nothing consumed this line; skip it rather than loop forever.
      i++
    }
  }

  if (blocks.length === 0) {
    return <p className="text-sm text-slate-500">This document is empty.</p>
  }

  return <div className="max-w-3xl">{blocks}</div>
}
