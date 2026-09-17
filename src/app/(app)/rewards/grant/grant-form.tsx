"use client"

import { useActionState } from "react"

import { grantCredit, type GrantState } from "./actions"

/**
 * The form behind a hand-written grant.
 *
 * ── Why the customer is found by mobile ────────────────────────────────────────────────────────
 * Nobody in ops has a customer id to hand. They have the number the customer signed in with, which
 * is usually the number the customer just quoted on the phone. The backend refuses rather than
 * guesses when a number matches more than one account, because granting money to the wrong one of
 * two matches is not a mistake that announces itself.
 *
 * ── Why the reason field is wide and unhelpfully placed ────────────────────────────────────────
 * It is the largest field on the screen on purpose. It is the only record of why this happened, and a
 * small box next to a Save button invites "goodwill" and nothing else. Its placeholder asks for the
 * thing a reader will actually want in three months: what went wrong, and what was agreed.
 */

const EMPTY: GrantState = { ok: false, error: null, message: null }

export default function GrantForm() {
  const [state, action, pending] = useActionState(grantCredit, EMPTY)

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
            placeholder="98xxxxxxxx"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Amount
          </span>
          <div className="mt-1 flex items-center rounded-lg border border-slate-200 px-3">
            <span className="text-sm text-slate-400">₹</span>
            <input
              name="amount"
              inputMode="decimal"
              placeholder="500"
              className="w-full px-2 py-2 text-sm tabular-nums focus:outline-none"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Brand</span>
          <select
            name="brand"
            defaultValue="crossfriend"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="crossfriend">CrossFriend</option>
            <option value="pranajiva">Pranajiva</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Expires in
          </span>
          <input
            name="expiryDays"
            inputMode="numeric"
            placeholder="days — leave blank for never"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] text-slate-500">
            Credit with no expiry stays on the books indefinitely. Give an apology a deadline unless
            you mean it to be permanent.
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
          placeholder="Order #1043 arrived two hours late for a birthday. Agreed ₹300 with the customer on the phone."
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-[11px] text-slate-500">
          Kept with the entry for good. This is the only record of why the money was given, and it is
          what anybody reviewing the books later will read.
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
          {pending ? "Giving…" : "Give credit"}
        </button>
        <span className="text-[11px] text-slate-500">
          Recorded against your ops account. It reaches their wallet immediately.
        </span>
      </div>
    </form>
  )
}
