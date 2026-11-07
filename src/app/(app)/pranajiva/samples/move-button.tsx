"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { moveSampleRequest } from "./actions"

/**
 * The button that moves a sample request.
 *
 * ── Why declining prompts for a reason ────────────────────────────────────────────────────────
 * Because it is the one move somebody may ask about afterwards, and a declined row with no note
 * leaves the next person to open it unable to answer them. The server refuses it without a note
 * too, so this prompt is the convenience and not the rule.
 *
 * Every other move goes forward and has no dialog, deliberately — a confirm on a button pressed
 * forty times in a batch is a confirm nobody reads.
 *
 * ── Why the error stays on screen ─────────────────────────────────────────────────────────────
 * It is the message that matters most, and a toast would take it away before it had been read.
 */
export default function MoveButton({
  id,
  next,
  label,
  tone = "primary",
}: {
  id: string
  next: string
  label: string
  tone?: "primary" | "quiet" | "danger"
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const className =
    tone === "danger"
      ? "rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
      : tone === "quiet"
        ? "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        : "rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"

  function press() {
    let note: string | undefined

    if (next === "rejected") {
      const given = prompt("Why are you declining this one? It is kept on the row.")
      /* Cancelling the prompt returns null, which means they changed their mind — not an empty
         reason. Only an actually-empty string is an error worth stating. */
      if (given === null) return
      if (!given.trim()) {
        setError("A reason is needed, so this is answerable later.")
        return
      }
      note = given
    }

    setError(null)
    start(async () => {
      const result = await moveSampleRequest(id, next, note)
      if (result.error) setError(result.error)
      /* revalidatePath marks the data stale; this is what redraws the open page with it. */
      else router.refresh()
    })
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={press}
        disabled={pending}
        className={`${className} disabled:opacity-50`}
      >
        {pending ? "Working…" : label}
      </button>
      {error && <span className="max-w-xs text-[11px] leading-snug text-rose-700">{error}</span>}
    </span>
  )
}
