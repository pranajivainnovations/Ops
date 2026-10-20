"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { moveOrder } from "./actions"

/**
 * The one button that moves an order, wherever it appears.
 *
 * ── Why cancelling asks twice ─────────────────────────────────────────────────────────────────
 * Because it is the only move here that cannot be undone and that takes money back out of a
 * customer's wallet. Every other button goes forward, and a mis-click on "On the way" is fixed by
 * carrying on. There is no confirm on those, deliberately — a dialog on a button somebody presses
 * forty times a day is a dialog they stop reading.
 *
 * ── Why the error stays on screen ─────────────────────────────────────────────────────────────
 * "Somebody else moved that order. Reload and try again." is the message that matters most and the
 * one a toast would take away before it had been read. It sits under the button until the next
 * press.
 */
export default function MoveButton({
  orderId,
  next,
  label,
  tone = "primary",
}: {
  orderId: string
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
    if (next === "cancelled" && !confirm("Cancel this order? This cannot be undone.")) return

    setError(null)
    start(async () => {
      const result = await moveOrder(orderId, next)
      if (result.error) setError(result.error)
      /* revalidatePath marks the data stale; this is what makes the open page redraw with it. */
      else router.refresh()
    })
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={press} disabled={pending} className={`${className} disabled:opacity-50`}>
        {pending ? "Working…" : label}
      </button>
      {error && <span className="max-w-xs text-[11px] leading-snug text-rose-700">{error}</span>}
    </span>
  )
}
