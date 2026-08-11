"use client"

import { useState, useTransition } from "react"
import { runBakeryDiscovery } from "../discovery-actions"
import type { RankPreference } from "@/lib/google-places"

/**
 * Two ranking modes are offered rather than one being hardcoded because they behave like
 * complementary sweeps rather than better/worse: measured on 201016 with an identical search area,
 * only 30 of each mode's 60 results overlapped. Running both is the cheapest way to widen coverage,
 * and it is safe to do — place_id is the upsert conflict key, so a place returned by both sweeps
 * updates its existing row instead of creating a second one.
 *
 * The result line leads with how many places were genuinely new, because that is the number that
 * says whether the run earned its API cost. Running the same mode twice in a row will report
 * "0 new", which is itself the answer to "have I already done this one?".
 */

const MODES: { value: RankPreference; label: string; hint: string }[] = [
  {
    value: "DISTANCE",
    label: "Nearest first",
    hint: "Best coverage of this pincode itself. Google fills its 60 slots with the closest bakeries.",
  },
  {
    value: "RELEVANCE",
    label: "Most prominent first",
    hint: "Google's default. Favours well-known bakeries, including ones several km away in other pincodes.",
  },
]

export default function DiscoveryTrigger({
  pincode,
  lastSearchedAt,
}: {
  pincode: string
  lastSearchedAt: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<RankPreference>("DISTANCE")
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  const activeMode = MODES.find((m) => m.value === mode)!

  const handleClick = () => {
    if (lastSearchedAt) {
      const ok = window.confirm(
        `This pincode was last searched on ${new Date(lastSearchedAt).toLocaleString("en-IN")}. ` +
          `Searching again makes fresh billed Google Places API calls (up to 3). ` +
          `Running a different ranking mode is worthwhile — it finds different bakeries and cannot ` +
          `create duplicates. Re-running the same mode will mostly just refresh what you already have. ` +
          `Continue?`
      )
      if (!ok) return
    }
    setMessage(null)
    setIsError(false)
    startTransition(async () => {
      const result = await runBakeryDiscovery(pincode, mode)
      if (result.error) {
        setIsError(true)
        setMessage(`Error: ${result.error}`)
        return
      }
      const parts = [
        `${result.added} new`,
        `${result.refreshed} refreshed`,
        ...(result.skipped > 0 ? [`${result.skipped} left alone (already triaged)`] : []),
      ]
      setMessage(
        `${result.found} result${result.found === 1 ? "" : "s"} from Google — ${parts.join(", ")}.` +
          (result.moreMayExist ? " Google indicates more exist beyond its own 60-result limit." : "")
      )
    })
  }

  return (
    <div className="text-right">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="sr-only" htmlFor="rank-mode">
          Ranking mode
        </label>
        <select
          id="rank-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as RankPreference)}
          disabled={pending}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Searching (up to ~15s)..." : lastSearchedAt ? "Search again" : "Find bakeries here"}
        </button>
      </div>
      <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-slate-400">{activeMode.hint}</p>
      {message && (
        <p className={`mt-1 max-w-sm text-[11px] ${isError ? "text-red-600" : "text-slate-600"}`}>
          {message}
        </p>
      )}
    </div>
  )
}
