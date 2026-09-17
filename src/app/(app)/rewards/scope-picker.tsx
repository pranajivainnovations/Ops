"use client"

import { useState } from "react"

import type { ScopeCandidate } from "./types"

/**
 * Where an offer runs.
 *
 * ── Why this screen exists ─────────────────────────────────────────────────────────────────────
 * Switching a mechanic on used to mean switching it on in every onboarded pincode, and nothing said
 * so — the decision was invisible because it was the absence of one. The readiness bar hid the
 * consequence while only one pincode was live; it would have stopped hiding it the day the second
 * one opened.
 *
 * ── Why "every pincode" is still here ──────────────────────────────────────────────────────────
 * It is genuinely what a mature brand-wide offer wants, and removing it would push operators into
 * ticking twenty boxes and forgetting the twenty-first. What changed is that it has to be chosen.
 *
 * ── Why readiness is shown but does not disable anything ───────────────────────────────────────
 * A pincode with fewer than three published bakers will accept the offer and serve nobody, which is
 * worth knowing at the moment of choosing. It is not worth preventing: switching an offer on the week
 * before a pincode opens is a normal thing to do, and a checkbox that refuses to tick is a support
 * conversation about a rule nobody can see.
 */

const READINESS_BAKERS = 3

export default function ScopePicker({
  scopeMode,
  scopePincodes,
  candidates,
}: {
  scopeMode: "all" | "selected" | null
  scopePincodes: string[] | null
  candidates: ScopeCandidate[]
}) {
  /* Defaults to the narrow option for a mechanic that has never been scoped, so the first save of a
     new offer cannot quietly go everywhere. */
  const [mode, setMode] = useState<"all" | "selected">(scopeMode ?? "selected")
  const [selected, setSelected] = useState<string[]>(scopePincodes ?? [])

  const toggle = (pincode: string) =>
    setSelected((current) =>
      current.includes(pincode)
        ? current.filter((p) => p !== pincode)
        : [...current, pincode].sort()
    )

  /**
   * A pincode that is on the list but no longer trading still has to be shown.
   *
   * Otherwise offboarding a pincode would silently drop it from a saved scope the next time anybody
   * touched the form — an offer quietly narrowing because of an unrelated decision somewhere else.
   */
  const known = new Set(candidates.map((c) => c.pincode))
  const orphaned = selected.filter((p) => !known.has(p))

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Where it runs</p>

      {/* The chosen mode travels as a hidden field; the radios are presentation. */}
      <input type="hidden" name="scopeMode" value={mode} />

      <div className="mt-2 flex flex-wrap gap-4">
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <input
            type="radio"
            checked={mode === "selected"}
            onChange={() => setMode("selected")}
            className="h-4 w-4"
          />
          Selected pincodes
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <input
            type="radio"
            checked={mode === "all"}
            onChange={() => setMode("all")}
            className="h-4 w-4"
          />
          Every pincode
        </label>
      </div>

      {mode === "all" ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
          <strong className="font-semibold">This runs everywhere you trade</strong> — including
          pincodes onboarded after today, without anybody switching it on again. A pincode that is not
          ready still will not serve it, but readiness is a delay, not a decision.
        </p>
      ) : (
        <>
          {candidates.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              No pincodes are trading yet, so there is nowhere to select.
            </p>
          ) : (
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {candidates.map((c) => {
                const ready = c.readyBakers >= READINESS_BAKERS
                const on = selected.includes(c.pincode)
                return (
                  <label
                    key={c.pincode}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                      on
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="scopePincodes"
                      value={c.pincode}
                      checked={on}
                      onChange={() => toggle(c.pincode)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="font-medium tabular-nums">{c.pincode}</span>
                    {c.district && <span className="truncate text-slate-400">{c.district}</span>}
                    <span
                      className={`ml-auto shrink-0 tabular-nums ${
                        ready ? "text-emerald-600" : "text-amber-600"
                      }`}
                      title={
                        ready
                          ? "Enough bakers are live here for rewards to serve"
                          : `Needs ${READINESS_BAKERS} live bakers with a published product before ` +
                            `rewards serve here — it can still be selected now`
                      }
                    >
                      {c.readyBakers}/{READINESS_BAKERS}
                    </span>
                  </label>
                )
              })}
            </div>
          )}

          {orphaned.length > 0 && (
            <div className="mt-2">
              {orphaned.map((p) => (
                <label
                  key={p}
                  className="mr-1.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-500"
                >
                  <input
                    type="checkbox"
                    name="scopePincodes"
                    value={p}
                    checked
                    onChange={() => toggle(p)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="font-medium tabular-nums">{p}</span>
                  <span className="text-amber-600">no longer trading</span>
                </label>
              ))}
            </div>
          )}

          <p className="mt-2 text-[11px] text-slate-500">
            {selected.length === 0 ? (
              <span className="text-amber-700">
                Nothing selected — this offer will be switched on and run nowhere.
              </span>
            ) : (
              <>
                Runs in {selected.length} pincode{selected.length === 1 ? "" : "s"}. A pincode can
                still be switched on or off individually on its own page, which overrides this list.
              </>
            )}
          </p>
        </>
      )}
    </div>
  )
}
