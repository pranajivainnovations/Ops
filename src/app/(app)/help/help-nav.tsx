"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

/**
 * Handbook contents.
 *
 * Sticky on desktop so the reader never loses their place in a long document — the most common
 * failure of internal docs is that people cannot tell how much is left or where they are.
 */
export default function HelpNav({
  pages,
}: {
  pages: { href: string; label: string }[]
}) {
  const pathname = usePathname()

  return (
    <nav aria-label="Handbook contents" className="lg:sticky lg:top-6 lg:self-start">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Contents
      </p>
      <ol className="space-y-0.5">
        {pages.map((page, i) => {
          const active = pathname === page.href
          return (
            <li key={page.href}>
              <Link
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-baseline gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-slate-900 font-semibold text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span
                  className={`text-[11px] tabular-nums ${active ? "text-white/60" : "text-slate-400"}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {page.label}
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
