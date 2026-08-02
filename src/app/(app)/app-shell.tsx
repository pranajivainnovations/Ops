"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { logoutAction } from "@/app/login/actions"

const NAV_ITEMS = [
  { href: "/bakers", label: "Bakers" },
  { href: "/pincodes", label: "Pincodes" },
  { href: "/pricing", label: "Pricing" },
  { href: "/rnd", label: "R&D" },
  { href: "/team", label: "Team" },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen flex-1 flex-col sm:flex-row">
      {/* Mobile top bar — hamburger only shows below the sm breakpoint */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:hidden">
        <p className="text-sm font-bold text-slate-900">CrossFriend Ops</p>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Backdrop, mobile only, while drawer is open */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 sm:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — static in normal flow on desktop, an off-canvas drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 sm:static sm:z-auto sm:w-56 sm:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-5">
          <p className="text-sm font-bold text-slate-900">CrossFriend Ops</p>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 sm:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
