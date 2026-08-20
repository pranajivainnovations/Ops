"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { logoutAction } from "@/app/login/actions"

/**
 * Two brands, one console.
 *
 * OPS started as CrossFriend's tool and then acquired a second body of work — the Pranajiva Ayurveda
 * knowledge base — that shares nothing with it: different products, different team, different source
 * of truth. Folding those five screens into the CrossFriend sidebar made the nav dishonest, because
 * "Documents" sitting under Insights implied it was about cakes.
 *
 * So the top-level switch is the brand, and everything below it belongs to exactly one. A person is
 * always in one world at a time and can see which; nothing has to be labelled "(Pranajiva)" further
 * down, because the answer is already at the top of the screen.
 *
 * Within a brand, groups answer "what am I here to do today":
 *   Network   — the supply side: who bakes for us and where we deliver
 *   Catalogue — the rules that decide what a custom cake costs and what it can be
 *   Insights  — research and raw data; read-mostly, used when something needs explaining
 *   Settings  — infrequent administration
 *
 * The Handbook and Sign out sit below the divider and belong to neither brand — they are reference
 * and session, not work.
 */

/**
 * Colour carries the grouping, so the eye finds a section before it reads a word.
 *
 * One hue per group, used consistently: a soft tint for the icon chip at rest, the solid hue when
 * the item is active. That is the whole system — colour means "which area of the tool am I in",
 * never decoration and never status. Semantic colours (a red error, an amber warning) stay
 * unclaimed by navigation so they still mean something when they appear in the page.
 *
 * Hues are chosen to be distinguishable rather than pretty: violet, amber, teal, emerald, slate.
 * They stay apart for the common forms of colour-blindness, and the icon shape plus the label carry
 * the meaning regardless — colour is a shortcut here, not the information.
 */
type Accent = "violet" | "amber" | "teal" | "emerald" | "slate"

interface NavItem {
  href: string
  label: string
  icon?: string
  /**
   * Highlight only on an exact path match. Needed for a section index like /pranajiva, which is a
   * prefix of every other item in its own group and would otherwise be permanently active.
   */
  exact?: boolean
}

interface NavGroup {
  label: string
  accent: Accent
  items: NavItem[]
}

interface Brand {
  key: string
  label: string
  /** Where the switcher lands when you pick this brand. */
  home: string
  initials: string
  /** Full class string — Tailwind cannot see an interpolated one. */
  logo: string
  groups: NavGroup[]
}

const BRANDS: Brand[] = [
  {
    key: "crossfriend",
    label: "CrossFriend",
    home: "/orders",
    initials: "CF",
    logo: "bg-gradient-to-br from-violet-500 to-fuchsia-500",
    groups: [
      {
        label: "Network",
        accent: "violet",
        items: [
          // First in the group: an order with a clock running outranks anything else on this screen.
          { href: "/orders", label: "Orders", icon: "receipt" },
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
    ],
  },
  {
    key: "pranajiva",
    label: "Pranajiva",
    home: "/pranajiva",
    initials: "PJ",
    logo: "bg-gradient-to-br from-emerald-500 to-teal-600",
    groups: [
      {
        label: "Knowledge base",
        accent: "emerald",
        items: [
          { href: "/pranajiva", label: "Overview", icon: "leaf", exact: true },
          { href: "/pranajiva/formulas", label: "Formulas", icon: "flask" },
          { href: "/pranajiva/topics", label: "Content topics", icon: "docs" },
          { href: "/pranajiva/products", label: "Product concepts", icon: "tag" },
          { href: "/pranajiva/documents", label: "All documents", icon: "database" },
        ],
      },
    ],
  },
]

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
  emerald: {
    label: "text-emerald-600",
    chip: "bg-emerald-100 text-emerald-700",
    activeChip: "bg-emerald-500 text-white",
    hover: "hover:bg-emerald-50 hover:text-emerald-900",
  },
  slate: {
    label: "text-slate-500",
    chip: "bg-slate-200 text-slate-600",
    activeChip: "bg-slate-600 text-white",
    hover: "hover:bg-slate-100 hover:text-slate-900",
  },
}

const ICONS: Record<string, React.ReactNode> = {
  receipt: <path d="M5 2h10v16l-2.5-1.5L10 18l-2.5-1.5L5 18zM8 7h4M8 10h4" />,
  store: <path d="M3 7l1.5-3h11L17 7M3 7h14M3 7v9h14V7M7 16v-4h6v4" />,
  pin: <path d="M10 17s5-4.6 5-8a5 5 0 1 0-10 0c0 3.4 5 8 5 8zM10 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />,
  tag: <path d="M3 9.5V4h5.5l8 8-5.5 5.5-8-8zM6.2 6.2h.01" />,
  sliders: <path d="M4 6h12M4 10h12M4 14h12M8 4v4M13 8v4M6 12v4" />,
  grid: <path d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z" />,
  phone: <path d="M6.5 3h-2A1.5 1.5 0 0 0 3 4.5C3 11.4 8.6 17 15.5 17A1.5 1.5 0 0 0 17 15.5v-2l-3.5-1.5-1.5 2a11 11 0 0 1-4.5-4.5l2-1.5L6.5 3z" />,
  flask: <path d="M8 3v5L4 16a1 1 0 0 0 .9 1.5h10.2A1 1 0 0 0 16 16l-4-8V3M7 3h6M6.5 12h7" />,
  leaf: <path d="M4 16c0-6 4-10 12-11 1 8-3 12-9 12H4zM4 16c2-3 4-5 7-6.5" />,
  docs: <path d="M11 2H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 18h8a1.5 1.5 0 0 0 1.5-1.5V6.5L11 2zM11 2v4.5h4.5M7.5 11h5M7.5 14h5" />,
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

const HELP_ITEM: NavItem = { href: "/help", label: "Handbook", icon: "help" }

/** The brand a path belongs to. Anything not claimed by a brand's prefix is CrossFriend's. */
function brandForPath(pathname: string): Brand {
  const match = BRANDS.find(
    (brand) => brand.key !== "crossfriend" && pathname.startsWith(`/${brand.key}`)
  )
  return match ?? BRANDS[0]
}

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
  item: NavItem
  pathname: string
  onNavigate: () => void
  accent: Accent
}) {
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`)
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

/**
 * The brand switch.
 *
 * Two tabs rather than a dropdown: there are two of them, and a dropdown would hide the fact that a
 * second world exists behind a click. Each tab is a plain link to that brand's home, so switching is
 * a normal navigation — no client state to get out of step with the URL, and a bookmarked Pranajiva
 * page opens with Pranajiva selected because the path is what decides.
 */
function BrandSwitch({
  active,
  onNavigate,
}: {
  active: Brand
  onNavigate: () => void
}) {
  return (
    <div className="mx-3 mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
      {BRANDS.map((brand) => {
        const isActive = brand.key === active.key
        return (
          <Link
            key={brand.key}
            href={brand.home}
            onClick={onNavigate}
            aria-current={isActive ? "true" : undefined}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold transition ${
              isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold text-white ${
                isActive ? brand.logo : "bg-slate-400"
              }`}
            >
              {brand.initials}
            </span>
            {brand.label}
          </Link>
        )
      })}
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const brand = brandForPath(pathname)
  const close = () => setMobileOpen(false)

  return (
    <div className="flex min-h-screen flex-1 flex-col sm:flex-row">
      {/* Mobile top bar — hamburger only shows below the sm breakpoint */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:hidden">
        <p className="text-sm font-bold text-slate-900">{brand.label} Ops</p>
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
          onClick={close}
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
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white ${brand.logo}`}
            >
              {brand.initials}
            </span>
            <p className="text-sm font-bold text-slate-900">{brand.label} Ops</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 sm:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <BrandSwitch active={brand} onNavigate={close} />

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-2">
          {brand.groups.map((group) => (
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
                    onNavigate={close}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Handbook and Sign out sit below the divider: reference and session, not work — and they
            belong to the console rather than to either brand. */}
        <div className="space-y-0.5 border-t border-slate-200 p-3">
          <NavLink item={HELP_ITEM} pathname={pathname} accent="slate" onNavigate={close} />
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
