"use client"

import { useActionState } from "react"

import { grantStudioGenerations, type StudioGrantState } from "./actions"

/**
 * The form behind a Studio top-up.
 *
 * Deliberately the same shape as the wallet grant form, because it is the same act: a person
 * decided, and the record of why has to survive them. Mobile number rather than customer id,
 * because that is what ops has in front of them when the customer is on the phone.
 */

const EMPTY: StudioGrantState = { ok: false, error: null, message: null }

export default function StudioGrantForm({ prefillMobile }: { prefillMobile?: string }) {
  const [state, action, pending] = useActionState(grantStudioGenerations, EMPTY)

  return (
    <form action={action} className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Customer&rsquo;s mobile
          </span>
          <input
            name="mobile"
            inputMode="numeric"
            defaultValue={prefillMobile}
            placeholder="98xxxxxxxx"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            How many more
          </span>
          <input
            name="amount"
            inputMode="numeric"
            placeholder="5"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
          />
          <span className="mt-1 block text-[11px] text-slate-500">
            Added on top of what they already have. Each one costs us real compute, so give what the
            conversation warrants rather than a round number.
          </span>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Why — required
        </span>
        <textarea
          name="reason"
          rows={3}
          placeholder="Called about a wedding cake, wanted to try a few more styles before ordering. Agreed 5 more."
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-[11px] text-slate-500">
          Kept with the grant for good, and it cannot be edited afterwards. This is the only record
          of the conversation that produced it.
        </span>
      </label>

      {state.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {state.message}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add generations"}
        </button>
        <span className="text-[11px] text-slate-500">
          Recorded against your ops account. It applies to their next design.
        </span>
      </div>
    </form>
  )
}
