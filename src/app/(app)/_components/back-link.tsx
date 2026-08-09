"use client"

import { useRouter } from "next/navigation"

/**
 * "Back" that returns to the page you were actually on, not to the section's front door.
 *
 * Every back link in OPS used to be a hardcoded `<Link href="/pincodes">`. If you searched for a
 * pincode, opened one, then hit Back, you landed on an empty search form and had to type the query
 * again — and the same on every other detail page. The link was honest about where it went; it just
 * went somewhere useless.
 *
 * Using history also restores scroll position, which a fresh navigation cannot.
 *
 * `fallbackHref` covers the case where there is no history to go back to — someone opening a deep
 * link from a chat message, or the first page of a new tab. OPS is behind a login and almost always
 * navigated from inside, so this is the rare path, but landing on a dead button is worse than
 * landing on the section index.
 */
export default function BackLink({
  fallbackHref,
  label,
  className = "",
}: {
  fallbackHref: string
  label: string
  className?: string
}) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back()
        else router.push(fallbackHref)
      }}
      className={`text-xs font-semibold text-slate-500 transition hover:text-slate-800 ${className}`}
    >
      ← {label}
    </button>
  )
}
