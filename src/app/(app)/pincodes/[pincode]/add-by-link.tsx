"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { addDiscoveryByUrl, type AddByUrlResult } from "../discovery-actions"

/**
 * Adds one specific business by pasting its Google Maps link.
 *
 * The escape hatch for the hard limit in sweeps: Google's Text Search returns at most 60 results per
 * query, so in a dense area a genuine bakery can be permanently unreachable no matter how the search
 * is ranked. Asking for it by name always works.
 *
 * The result deliberately reports which pincode the business actually belongs to, and links there
 * when it isn't this one — otherwise a successful add would look like nothing happened, since this
 * page lists candidates by their real postal code rather than by where they were entered.
 */
export default function AddByLink({ pincode }: { pincode: string }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [result, setResult] = useState<AddByUrlResult | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = () => {
    if (!value.trim()) return
    setResult(null)
    startTransition(async () => {
      const r = await addDiscoveryByUrl(value)
      setResult(r)
      if (!r.error) setValue("")
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-800"
      >
        Add a specific bakery by Google Maps link
      </button>
    )
  }

  const elsewhere = result?.pincode && result.pincode !== pincode

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-slate-700">Add by Google Maps link</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] font-semibold text-slate-400 hover:text-slate-700"
        >
          Close
        </button>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        For bakeries a sweep cannot reach. Google returns at most 60 results per search, so a real
        bakery in a crowded area can stay invisible however the search is ranked — but it can always
        be fetched directly. Paste the URL from Google Maps, a share link, or a place id.
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit()
          }}
          disabled={pending}
          placeholder="https://www.google.com/maps/place/..."
          className="min-w-64 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim()}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Looking up..." : "Add"}
        </button>
      </div>

      {result?.error && <p className="mt-2 text-[11px] text-red-600">{result.error}</p>}

      {result && !result.error && (
        <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
          <p>
            <span className="font-bold text-slate-900">{result.name}</span>
            {result.rating != null && ` · ⭐ ${result.rating}`}
            {result.reviews != null && ` (${result.reviews} reviews)`}
            {" — "}
            {result.outcome === "added"
              ? "added as a new candidate."
              : result.outcome === "refreshed"
                ? "already known; details refreshed."
                : "already onboarded or dismissed, so left untouched."}
          </p>
          {result.address && <p className="mt-0.5 text-slate-500">{result.address}</p>}
          {elsewhere && (
            <p className="mt-1 text-amber-700">
              Its postal code is {result.pincode}, not {pincode}, so it is listed on{" "}
              <Link href={`/pincodes/${result.pincode}`} className="font-semibold underline">
                that pincode&apos;s page
              </Link>
              .
            </p>
          )}
          {!result.pincode && (
            <p className="mt-1 text-amber-700">
              Google returned no postal code for this business, so it stays on the discoveries list
              rather than any pincode page.
            </p>
          )}
          {result.notABakery && (
            <p className="mt-1 text-amber-700">
              Google does not categorise this as a food business — worth a check before onboarding.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
