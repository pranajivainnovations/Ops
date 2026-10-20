/**
 * Chrome for the Social screens. Its own copy rather than an import from the Pranajiva section,
 * because Social is not inside that brand — reels are made for either one.
 */
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <header className="border-b border-slate-200 bg-white px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900">{title}</h1>
          <p className="mt-0.5 max-w-3xl text-xs text-slate-500">{description}</p>
        </div>
        {action}
      </div>
    </header>
  )
}

export function Panel({
  title,
  hint,
  children,
  action,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
          {hint && <p className="mt-0.5 max-w-2xl text-[11px] leading-snug text-slate-400">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}
