"use client"

import { useActionState } from "react"

import { markRefineHandled, type StudioGrantState } from "./actions"

/**
 * The refine queue, and the one button that clears an item from it.
 *
 * ── Why each row carries the customer's own words in full ──────────────────────────────────────
 * The temptation on a queue screen is to truncate to a line and make you click through. These
 * messages are short and they are the entire point of the table — what somebody wanted that the
 * generator could not give them. Reading all of them in one pass is the job; opening twelve detail
 * pages is not.
 *
 * ── Why the note is optional and the mobile is a link ──────────────────────────────────────────
 * The work is a phone call. Making the number tappable is the difference between this screen being
 * used and being a place requests go to sit, and a mandatory note after every call would slow it
 * down for a record nobody reads. What is not optional is who handled it — the database sees to
 * that.
 */

export interface QueueItem {
  id: string
  customer_id: string
  message: string
  contact: string | null
  email: string | null
  phone: string | null
  created_at: string
  generation_id: string | null
  design_id: string | null
}

const EMPTY: StudioGrantState = { ok: false, error: null, message: null }

function waitedFor(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (hours < 1) return "just now"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function RefineQueue({ items }: { items: QueueItem[] }) {
  const [state, action, pending] = useActionState(markRefineHandled, EMPTY)

  if (items.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
        Nobody is waiting. Requests land here when a customer asks us to refine a design, or runs out
        of generations and asks for more.
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-3">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {state.message}
        </p>
      )}

      {items.map((item) => {
        const number = item.contact || item.phone || (item.email || "").split("@")[0]
        const dialable = /^\d{10}$/.test(number || "")

        return (
          <article
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white p-4 ring-1 ring-amber-100"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {dialable ? (
                  <a href={`tel:+91${number}`} className="tabular-nums underline">
                    {number}
                  </a>
                ) : (
                  <span className="tabular-nums">{number || "no number on file"}</span>
                )}
              </span>
              <span className="text-xs text-slate-500">waiting {waitedFor(item.created_at)}</span>
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {item.message}
            </p>

            <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="requestId" value={item.id} />
              <input
                name="handledNote"
                placeholder="What happened on the call — optional"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Saving…" : "Mark handled"}
              </button>
            </form>
          </article>
        )
      })}
    </div>
  )
}
