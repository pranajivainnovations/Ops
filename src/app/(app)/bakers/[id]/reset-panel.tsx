"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"

import { resetBakerAction } from "./reset-actions"
import { EMPTY_RESET_STATE, type ResetState } from "./reset-types"

/**
 * Undoing a bakery's onboarding.
 *
 * Collapsed by default and styled as the danger zone it is, because nothing here is part of a normal
 * day — it exists for bakeries onboarded to test with, claimed by the wrong person, or whose
 * activation link has been passed around.
 *
 * The two switches are separate and default to neither. Resetting access is the routine one and is
 * offered first; deleting the catalogue is irreversible and is described as such rather than being
 * softened. Confirmation is by typing the bakery's name — a generic "are you sure" is answered
 * reflexively, whereas typing the name requires reading which bakery this actually is.
 */
export default function ResetPanel({
  bakerId,
  bakerName,
  productCount,
  isClaimed,
}: {
  bakerId: string
  bakerName: string
  productCount: number
  isClaimed: boolean
}) {
  const [open, setOpen] = useState(false)
  const [access, setAccess] = useState(false)
  const [data, setData] = useState(false)
  const [result, formAction] = useActionState<ResetState, FormData>(
    resetBakerAction.bind(null, bakerId, bakerName),
    EMPTY_RESET_STATE
  )

  if (!open) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Reset this bakery</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Undo onboarding — take back portal access, or clear out test listings.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
          >
            Open reset options
          </button>
        </div>
        {result.done.length > 0 && <DoneList done={result.done} />}
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-red-300 bg-red-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-red-900">Reset this bakery</h2>
          <p className="mt-0.5 text-xs text-red-800">
            Choose what to undo. Nothing happens until you confirm below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>

      <form action={formAction} className="mt-4 space-y-3">
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3">
          <input
            type="checkbox"
            name="access"
            checked={access}
            onChange={(e) => setAccess(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-xs leading-relaxed text-slate-700">
            <span className="font-bold text-slate-900">Reset portal access</span>
            <br />
            Signs out and deactivates their login, and kills any unused invite. The bakery becomes
            invitable again, so you can send a fresh activation link.
            {!isClaimed && (
              <span className="mt-1 block text-slate-500">
                This bakery hasn&apos;t claimed an account yet — this would only revoke unused
                invites.
              </span>
            )}
            <span className="mt-1 block text-slate-500">Their products are not touched.</span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3">
          <input
            type="checkbox"
            name="data"
            checked={data}
            onChange={(e) => setData(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-xs leading-relaxed text-slate-700">
            <span className="font-bold text-slate-900">
              Delete all {productCount} product{productCount === 1 ? "" : "s"}
            </span>
            <br />
            Permanently removes their listings. This cannot be undone.
            <span className="mt-1 block text-slate-500">
              Blocked automatically if any of them has ever been ordered — deleting those would erase
              the items from a customer&apos;s order history.
            </span>
          </span>
        </label>

        {(access || data) && (
          <div className="rounded-lg border border-red-300 bg-white p-3">
            <label
              htmlFor="reset-confirm"
              className="block text-xs font-semibold text-red-900"
            >
              Type <span className="font-mono">{bakerName}</span> to confirm
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                id="reset-confirm"
                name="confirm"
                autoComplete="off"
                placeholder={bakerName}
                className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <SubmitButton />
            </div>
          </div>
        )}
      </form>

      {result.error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-xs text-red-800"
        >
          {result.error}
        </p>
      )}
      {result.done.length > 0 && <DoneList done={result.done} />}
    </section>
  )
}

function DoneList({ done }: { done: string[] }) {
  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
      <p className="text-xs font-bold text-emerald-900">Reset complete</p>
      <ul className="mt-1 space-y-0.5">
        {done.map((line) => (
          <li key={line} className="text-xs text-emerald-800">
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
    >
      {pending ? "Resetting…" : "Reset"}
    </button>
  )
}
