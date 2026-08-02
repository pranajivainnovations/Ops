"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/pricing", label: "Rule Set" },
  { href: "/pricing/attributes", label: "Attributes" },
  { href: "/pricing/regions", label: "Regions" },
]

export default function PricingTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 border-b border-slate-200 bg-white px-6 pt-2">
      {TABS.map((tab) => {
        // /pricing must match exactly (else it'd stay "active" on every sub-route including /pricing/regions/[id])
        const active = tab.href === "/pricing" ? pathname === tab.href : pathname.startsWith(tab.href)
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
