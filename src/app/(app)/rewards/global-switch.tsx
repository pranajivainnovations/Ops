"use client"

import { useActionState } from "react"

import { setGlobalSwitch, EMPTY_SAVE_STATE } from "./actions"
import { isError, type GlobalSwitch } from "./types"

/**
 * The stop that covers everything.
 *
 * ── Why it is at the top and why it looks like this ────────────────────────────────────────────
 * It is the control somebody reaches for when something is going wrong, and the state it is most
 * often read in is a hurry. So it says what is true in one line, the action is one button, and the
 * only thing between deciding and its taking effect is a sentence saying why — which is required
 * because a week later "who stopped rewards on Saturday" is a question that gets asked and the
 * value alone cannot answer it.
 *
 * Stopping does not revoke anything. Credit already granted stays spendable; what stops is new
 * grants. That is written on the panel because it is the first thing anybody wonders when they
 * press it.
 */
export default function GlobalSwitchPanel({
  state: current,
}: {
  state: GlobalSwitch | { error: string }
}) {
  const [state, action, pending] = useActionState(setGlobalSwitch, EMPTY_SAVE_STATE)

  if (isError(current)) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
        The global reward switch could not be read: {current.error}
      </p>
    )
  }

  const on = current.enabled
  const last = current.history[0]

  return (
    <section
      className={`rounded-xl border p-5 ${
        on ? "border-slate-200 bg-white" : "border-red-300 bg-red-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            {on ? "Rewards are running" : "All rewards are stopped"}
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
            {on
              ? "Every reward, both brands, everywhere. Stopping here overrides every other switch and takes effect on the next order."
              : "Nothing is granting, on either brand. Credit customers already hold is untouched and still spendable — stopping stops issuing, it never takes anything back."}
          </p>
          {last && (
            <p className="mt-2 text-[11px] text-slate-500">
              Last changed {new Date(last.changedAt).toLocaleString("en-IN")} — “{last.reason}”
            </p>
          )}
        </div>

        <form action={action} className="flex flex-col items-end gap-2">
          <input type="hidden" name="enabled" value={on ? "false" : "true"} />
          <input
            name="reason"
            required
            placeholder={on ? "Why stop?" : "Why resume?"}
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              on ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {pending ? "Working…" : on ? "Stop all rewards" : "Resume rewards"}
          </button>
        </form>
      </div>

      {state.error && (
        <p className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800">{state.error}</p>
      )}

      {current.history.length > 1 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">
            Previous changes ({current.history.length})
          </summary>
          <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
            {current.history.map((h, i) => (
              <li key={i} className="flex gap-2">
                <span className="tabular-nums text-slate-400">
                  {new Date(h.changedAt).toLocaleDateString("en-IN")}
                </span>
                <span className="font-semibold">
                  {h.newValue === "false" ? "stopped" : "resumed"}
                </span>
                <span>— {h.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
