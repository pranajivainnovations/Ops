"use client"

import { useTransition, useState } from "react"
import { useRouter } from "next/navigation"
import { runResearchSearch } from "./actions"

export default function ResearchTrigger({
  category,
  pincode,
  lastSearchedAt,
}: {
  category: string
  pincode: string
  lastSearchedAt: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [pages, setPages] = useState(1)
  const router = useRouter()

  const handleClick = () => {
    if (lastSearchedAt) {
      const ok = window.confirm(
        `"${category}" in ${pincode} was last searched on ${new Date(lastSearchedAt).toLocaleString("en-IN")}. ` +
          `Searching again makes ${pages} fresh billed Google Places API call${pages === 1 ? "" : "s"}. Continue?`
      )
      if (!ok) return
    }
    setMessage(null)
    startTransition(async () => {
      const result = await runResearchSearch(category, pincode, pages)
      if (result.error) {
        setMessage(`Error: ${result.error}`)
        return
      }
      setMessage(
        `Found ${result.found} result${result.found === 1 ? "" : "s"} across ${result.pagesSearched} page(s)` +
          (result.moreMayExist ? " — Google indicates even more may exist beyond its own limit." : ".")
      )
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-slate-500">
        Pages:{" "}
        <select
          value={pages}
          onChange={(e) => setPages(Number(e.target.value))}
          disabled={pending}
          className="rounded border border-slate-300 px-1 py-0.5 text-xs"
        >
          <option value={1}>1 (up to 20 results)</option>
          <option value={2}>2 (up to 40 results)</option>
          <option value={3}>3 (up to 60 results)</option>
        </select>
      </label>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Searching..." : lastSearchedAt ? "Search again" : "Search"}
      </button>
      {message && <p className="text-[11px] text-slate-500">{message}</p>}
    </div>
  )
}
