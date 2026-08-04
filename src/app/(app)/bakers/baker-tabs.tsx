"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/bakers", label: "All Bakers" },
  { href: "/bakers/discoveries", label: "Discoveries" },
  { href: "/bakers/assignments", label: "Assignments" },
]

export default function BakerTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 border-b border-slate-200 bg-white px-6 pt-2">
      {TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              active
                ? "border-b-2 border-slate-900 text-slate-900"
                : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
