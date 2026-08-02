"use client"

import { useState, useTransition } from "react"
import { runBakeryDiscovery } from "../discovery-actions"

export default function DiscoveryTrigger({
  pincode,
  lastSearchedAt,
}: {
  pincode: string
  lastSearchedAt: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const handleClick = () => {
    if (lastSearchedAt) {
      const ok = window.confirm(
        `This pincode was last searched on ${new Date(lastSearchedAt).toLocaleString("en-IN")}. ` +
          `Searching again makes fresh billed Google Places API calls (up to 3). Continue?`
      )
      if (!ok) return
    }
    setMessage(null)
    startTransition(async () => {
      const result = await runBakeryDiscovery(pincode)
      if (result.error) {
        setMessage(`Error: ${result.error}`)
        return
      }
      const pageWord = result.pagesSearched === 1 ? "page" : "pages"
      setMessage(
        `Found ${result.found} result${result.found === 1 ? "" : "s"} across ${result.pagesSearched} ${pageWord}` +
          (result.moreMayExist ? " — Google indicates even more may exist beyond its own limit." : ".")
      )
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Searching (up to ~15s)..." : lastSearchedAt ? "Search again" : "Find bakeries here"}
      </button>
      {message && <p className="mt-1.5 text-[11px] text-slate-500">{message}</p>}
    </div>
  )
}
