"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { logoutAction } from "@/app/login/actions"

/**
 * Sidebar, grouped by what the work IS rather than by which feature shipped when.
 *
 * The groups answer "what am I here to do today":
 *   Network   — the supply side: who bakes for us and where we deliver
 *   Catalogue — the rules that decide what a custom cake costs and what it can be
 *   Insights  — research and raw data; read-mostly, used when something needs explaining
 *   Settings  — infrequent administration
 *
 * Ungrouped flat lists stop scanning well at about six items, and this is now eight. Grouping also
 * makes the odd one out obvious: Database is a diagnostic tool, not a daily task, and putting it
 * under Insights says so without needing a tooltip.
 *
 * The Handbook sits last and visually separated — it is the thing you reach for when something else
 * on this list has confused you, so it should be findable without competing for attention with the
 * work itself.
 */
/**
 * Colour carries the grouping, so the eye finds a section before it reads a word.
 *
 * One hue per group, used consistently: a soft tint for the icon chip at rest, the solid hue when
 * the item is active. That is the whole system — colour means "which area of the tool am I in",
 * never decoration and never status. Semantic colours (a red error, an amber warning) stay
 * unclaimed by navigation so they still mean something when they appear in the page.
 *
 * Hues are chosen to be distinguishable rather than pretty: violet, amber, teal, slate. They stay
 * apart for the common forms of colour-blindness, and the icon shape plus the label carry the
 * meaning regardless — colour is a shortcut here, not the information.
 */
const NAV_GROUPS = [
  {
    label: "Network",
    accent: "violet",
    items: [
      { href: "/bakers", label: "Bakers", icon: "store" },
      { href: "/pincodes", label: "Pincodes", icon: "pin" },
    ],
  },
  {
    label: "Catalogue",
    accent: "amber",
    items: [
      { href: "/taxonomy", label: "Taxonomy", icon: "grid" },
      { href: "/pricing", label: "Pricing", icon: "tag" },
      { href: "/constraints", label: "Constraints", icon: "sliders" },
    ],
  },
  {
    label: "Insights",
    accent: "teal",
    items: [
      { href: "/rnd", label: "R&D", icon: "flask" },
      { href: "/designs", label: "AI Designs", icon: "image" },
      { href: "/database", label: "Database", icon: "database" },
    ],
  },
  {
    label: "Settings",
    accent: "slate",
    items: [
      { href: "/team", label: "Team", icon: "users" },
      { href: "/settings", label: "Site details", icon: "phone" },
    ],
  },
] as const

type Accent = (typeof NAV_GROUPS)[number]["accent"]

/**
 * Full class strings, never interpolated fragments — Tailwind scans source text, so
 * `bg-${accent}-100` would simply never be generated.
 */
const ACCENT: Record<Accent, { label: string; chip: string; activeChip: string; hover: string }> = {
  violet: {
    label: "text-violet-500",
    chip: "bg-violet-100 text-violet-600",
    activeChip: "bg-violet-500 text-white",
    hover: "hover:bg-violet-50 hover:text-violet-900",
  },
  amber: {
    label: "text-amber-600",
    chip: "bg-amber-100 text-amber-700",
    activeChip: "bg-amber-500 text-white",
    hover: "hover:bg-amber-50 hover:text-amber-900",
  },
  teal: {
    label: "text-teal-600",
    chip: "bg-teal-100 text-teal-700",
    activeChip: "bg-teal-500 text-white",
    hover: "hover:bg-teal-50 hover:text-teal-900",
  },
  slate: {
    label: "text-slate-500",
    chip: "bg-slate-200 text-slate-600",
    activeChip: "bg-slate-600 text-white",
    hover: "hover:bg-slate-100 hover:text-slate-900",
  },
}

const ICONS: Record<string, React.ReactNode> = {
  store: <path d="M3 7l1.5-3h11L17 7M3 7h14M3 7v9h14V7M7 16v-4h6v4" />,
  pin: <path d="M10 17s5-4.6 5-8a5 5 0 1 0-10 0c0 3.4 5 8 5 8zM10 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />,
  tag: <path d="M3 9.5V4h5.5l8 8-5.5 5.5-8-8zM6.2 6.2h.01" />,
  sliders: <path d="M4 6h12M4 10h12M4 14h12M8 4v4M13 8v4M6 12v4" />,
  grid: <path d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z" />,
  phone: <path d="M6.5 3h-2A1.5 1.5 0 0 0 3 4.5C3 11.4 8.6 17 15.5 17A1.5 1.5 0 0 0 17 15.5v-2l-3.5-1.5-1.5 2a11 11 0 0 1-4.5-4.5l2-1.5L6.5 3z" />,
  flask: <path d="M8 3v5L4 16a1 1 0 0 0 .9 1.5h10.2A1 1 0 0 0 16 16l-4-8V3M7 3h6M6.5 12h7" />,
  image: <path d="M3 4.5h14v11H3zM3 13l4-4 3.5 3.5L13 10l4 4M7.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2" />,
  database: <path d="M10 3c3.9 0 7 1 7 2.2S13.9 7.5 10 7.5 3 6.5 3 5.2 6.1 3 10 3zM3 5.2v9.6C3 16.1 6.1 17 10 17s7-.9 7-2.2V5.2M3 10c0 1.3 3.1 2.2 7 2.2s7-.9 7-2.2" />,
  users: <path d="M13 16v-1.5a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3V16M7.5 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 16v-1.5a3 3 0 0 0-2.2-2.9M13.5 3.7a3 3 0 0 1 0 5.8" />,
  help: (
    <>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M7.9 7.7a2.1 2.1 0 1 1 2.9 1.95c-.5.22-.8.7-.8 1.25v.35" strokeLinecap="round" />
      <circle cx="10" cy="14.1" r=".75" fill="currentColor" stroke="none" />
    </>
  ),
}

function NavIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] ?? ICONS.help}
    </svg>
  )
}

const HELP_ITEM = { href: "/help", label: "Handbook", icon: "help" }

/**
 * One nav link.
 *
 * `startsWith(href + "/")` rather than a bare prefix match, so /bakers doesn't light up while you
 * are on /bakers-something-else, and detail pages like /bakers/[id] still highlight their parent.
 */
function NavLink({
  item,
  pathname,
  onNavigate,
  accent,
}: {
  item: { href: string; label: string; icon?: string }
  pathname: string
  onNavigate: () => void
  accent: Accent
}) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
  const a = ACCENT[accent]

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
        active ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : `text-slate-600 ${a.hover}`
      }`}
    >
      {/* The chip is what carries the colour. An active item goes solid; everything else keeps a
          quiet tint, so exactly one thing in the sidebar is ever loud. */}
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition ${
          active ? a.activeChip : a.chip
        }`}
      >
        <NavIcon name={item.icon ?? "help"} />
      </span>
      {item.label}
    </Link>
  )
}

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
        // A tinted surface, not white — the active item is a white "card" lifted off the sidebar,
        // which only reads as raised if the ground behind it is slightly darker.
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50 transition-transform duration-200 sm:static sm:z-auto sm:w-56 sm:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-5">
          <div className="flex items-center gap-2">
            {/* The one place the CrossFriend brand appears in an otherwise deliberately neutral
                internal tool — enough to say whose system this is, not enough to compete with the
                navigation colour below it. */}
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
              CF
            </span>
            <p className="text-sm font-bold text-slate-900">CrossFriend Ops</p>
          </div>
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
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p
                className={`mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider ${
                  ACCENT[group.accent].label
                }`}
              >
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    accent={group.accent}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Handbook and Sign out sit below the divider: reference and session, not work. */}
        <div className="space-y-0.5 border-t border-slate-200 p-3">
          <NavLink
            item={HELP_ITEM}
            pathname={pathname}
            accent="slate"
            onNavigate={() => setMobileOpen(false)}
          />
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
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
