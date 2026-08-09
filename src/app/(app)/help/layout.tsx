import Link from "next/link"

import HelpNav from "./help-nav"

export const HELP_PAGES = [
  { href: "/help", label: "Overview", blurb: "What the system is, and the whole flow on one page" },
  { href: "/help/blueprint", label: "Blueprint", blurb: "Business model, tech stack, topology, scale — the single-source view" },
  { href: "/help/architecture", label: "Architecture", blurb: "The four apps and how data moves between them" },
  { href: "/help/bakers", label: "Baker onboarding", blurb: "Discovery, invitation, activation, login" },
  { href: "/help/taxonomy", label: "Taxonomy", blurb: "Occasion × Product Type — what appears where on the storefront" },
  { href: "/help/products", label: "Products", blurb: "Creation, publication, and reaching the marketplace" },
  { href: "/help/storefront", label: "Storefront", blurb: "What customers see and how they buy" },
  { href: "/help/operations", label: "Operations", blurb: "Daily tasks, setup, secrets, deployment" },
  { href: "/help/troubleshooting", label: "Troubleshooting", blurb: "Symptoms, causes, where to look" },
  { href: "/help/reference", label: "Reference", blurb: "Routes, limits, environment, known gaps" },
] as const

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-base font-bold text-slate-900">CrossFriend Handbook</h1>
          <p className="text-xs text-slate-500">
            Written against the running system. If something here disagrees with what you see, trust
            what you see and{" "}
            <Link href="/help/troubleshooting" className="underline">
              check troubleshooting
            </Link>
            .
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-8 px-6 py-8 lg:grid-cols-[240px_1fr]">
        <HelpNav pages={HELP_PAGES.map((p) => ({ href: p.href, label: p.label }))} />
        <article className="min-w-0 max-w-4xl">{children}</article>
      </div>
    </main>
  )
}
