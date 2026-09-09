import React from "react"

/**
 * A board message's text, with links made clickable.
 *
 * ── Why this is not the Markdown renderer used for documents ───────────────────────────────────
 * A chat box is not a document. People type asterisks and underscores as punctuation, and a message
 * reading "the 2*3 tier" should not lose its numbers to an emphasis rule. So the only thing promoted
 * out of plain text here is a URL — which somebody pasted precisely because they wanted it followed.
 *
 * ── Why no dangerouslySetInnerHTML ─────────────────────────────────────────────────────────────
 * The pieces are assembled as React elements, so message text can never become markup no matter what
 * is in it. That matters more here than in the document viewer: this content is typed by people into
 * a box, and it is shown to the whole team.
 */

/* Deliberately narrow: an http(s) scheme and no whitespace. mailto:, tel: and bare "www." are
   omitted because each brings a false-positive class of its own, and none of them is what anybody
   is actually pasting into this box. */
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')]+/gi

/** How a long URL is shown. The whole thing is still the href — this is only what gets read. */
function displayUrl(raw: string): string {
  try {
    const url = new URL(raw)
    const shown = `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`
    return shown.length > 48 ? `${shown.slice(0, 47)}…` : shown
  } catch {
    return raw
  }
}

export default function MessageBody({
  text,
  muted = false,
}: {
  text: string
  /** A completed task is struck through, and its links should not shout for attention. */
  muted?: boolean
}) {
  if (!text) return null

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0

  // A fresh regex each call: /g patterns carry lastIndex between uses, and a shared one would skip
  // the first link of every other message.
  const pattern = new RegExp(URL_PATTERN.source, "gi")

  while ((match = pattern.exec(text)) !== null) {
    // Trailing punctuation nearly always belongs to the sentence, not the address. It is put back as
    // text so the message still reads correctly.
    const trailing = /[.,;:!?]+$/.exec(match[0])?.[0] ?? ""
    const href = match[0].slice(0, match[0].length - trailing.length)

    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))

    nodes.push(
      <a
        key={`l${index++}`}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={`break-all underline underline-offset-2 ${
          muted ? "text-slate-400" : "text-violet-700 hover:text-violet-900"
        }`}
      >
        {displayUrl(href)}
      </a>
    )
    if (trailing) nodes.push(trailing)

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))

  return <>{nodes}</>
}
