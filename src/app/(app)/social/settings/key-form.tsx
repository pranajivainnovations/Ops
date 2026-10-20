"use client"

import { useActionState, useState, useTransition } from "react"

import { forgetApiKey, saveApiKey, type Result } from "../actions"

const EMPTY: Result = {}

const box =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"

/**
 * Entering, replacing or removing the key.
 *
 * ── Why the field is always empty ─────────────────────────────────────────────────────────────
 * Not because the value is hidden — because it does not exist here. Nothing returns the stored key,
 * so there is no value to prefill, and a masked field showing dots would be pretending otherwise.
 * What the screen can prove is which key is saved, from its last four characters.
 */
export default function KeyForm({
  credential,
}: {
  credential: {
    model: string
    keyLast4: string
    monthlyCapCents: number
    spentThisMonthCents: number
  } | null
}) {
  const [state, action, pending] = useActionState(saveApiKey, EMPTY)
  const [forgetting, startForget] = useTransition()
  const [forgetResult, setForgetResult] = useState<Result | null>(null)

  const spent = credential?.spentThisMonthCents ?? 0
  const cap = credential?.monthlyCapCents ?? 2000
  const usedPct = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0

  return (
    <div className="space-y-4">
      {credential && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-semibold text-emerald-900">
              A key ending <span className="font-mono">…{credential.keyLast4}</span> is saved
            </p>
            <p className="text-xs tabular-nums text-emerald-800">
              ${(spent / 100).toFixed(2)} of ${(cap / 100).toFixed(2)} used this month
            </p>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-200">
            <div
              className={`h-full rounded-full ${usedPct >= 90 ? "bg-rose-500" : "bg-emerald-500"}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>

          <p className="mt-2 text-[11px] text-emerald-800">
            Model <span className="font-mono">{credential.model}</span>
            {credential.model.startsWith("veo-") && (
              /* Said here rather than refused at save: they are the operator's keys and their
                 choice, but a model that stops answering on a known date should not be a surprise
                 discovered mid-reel. */
              <span className="ml-1 font-semibold text-rose-700">
                — the Veo preview models shut down on 22 October 2026
              </span>
            )}
          </p>
        </section>
      )}

      <form action={action} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-slate-700">
              {credential ? "Replace the key" : "Gemini API key"}
            </span>
            <input
              name="apiKey"
              type="password"
              required
              autoComplete="off"
              placeholder="AIza…"
              className={`${box} font-mono`}
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              From Google AI Studio → Get API key. It needs billing enabled; video is paid-tier only.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Model</span>
            <select name="model" defaultValue={credential?.model ?? "gemini-omni-1.1-flash"} className={box}>
              <option value="gemini-omni-1.1-flash">gemini-omni-1.1-flash (current)</option>
              <option value="veo-3.1-generate-preview">veo-3.1-generate-preview (shutting down)</option>
              <option value="veo-3.1-fast-generate-preview">
                veo-3.1-fast-generate-preview (shutting down)
              </option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Monthly ceiling ($)</span>
            <input
              name="capDollars"
              inputMode="decimal"
              defaultValue={((credential?.monthlyCapCents ?? 2000) / 100).toFixed(0)}
              className={`${box} tabular-nums`}
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              Renders refuse once this is reached. About 10 reels at $20.
            </span>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : credential ? "Replace key" : "Save key"}
          </button>

          {credential && (
            <button
              type="button"
              disabled={forgetting}
              onClick={() => {
                if (!confirm("Remove the stored key? Nothing can be generated until another is added."))
                  return
                setForgetResult(null)
                startForget(async () => setForgetResult(await forgetApiKey()))
              }}
              className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              {forgetting ? "Removing…" : "Remove"}
            </button>
          )}

          {state.error && <span className="text-xs text-rose-700">{state.error}</span>}
          {state.ok && <span className="text-xs text-emerald-700">{state.ok}</span>}
          {forgetResult?.error && <span className="text-xs text-rose-700">{forgetResult.error}</span>}
          {forgetResult?.ok && <span className="text-xs text-emerald-700">{forgetResult.ok}</span>}
        </div>
      </form>
    </div>
  )
}
