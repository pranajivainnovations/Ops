import Link from "next/link"

/**
 * One record as a card, for phones.
 *
 * OPS list pages are tables, and tables answer "compare many rows on one column" well. On a phone
 * they answered nothing: seven of ten columns were hidden behind breakpoints, so a baker showed up
 * as a name, a status and an edit link — which is not enough to decide anything, and the team is
 * expected to work from a phone.
 *
 * Cards rather than a sideways-scrolling table because the job on a phone is looking ONE bakery up,
 * usually just before calling it. Scrolling sideways through ten columns to assemble that in your
 * head is slower than reading a block, and it costs you your place in the list.
 *
 * Used alongside the table, not instead of it: the card list is `sm:hidden` and the table is
 * `hidden sm:block`, so each screen size gets the layout that suits it and neither is a compromise.
 * Both render from the same row data, so they cannot fall out of step.
 */

export interface CardField {
  label: string
  /** Rendered as-is, so a page can pass a badge or a Yes/No link rather than only text. */
  value: React.ReactNode
}

export default function RecordCard({
  title,
  subtitle,
  href,
  linkLabel = "Open",
  fields,
  accent,
  children,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  href?: string
  linkLabel?: string
  fields: CardField[]
  /** Tailwind border class for a card that needs attention — e.g. a brand-new order. */
  accent?: string
  /** Actions or anything else that belongs below the fields. */
  children?: React.ReactNode
}) {
  return (
    <article className={`rounded-xl border bg-white p-4 ${accent ?? "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-900"
          >
            {linkLabel} →
          </Link>
        )}
      </div>

      {/* A two-column grid rather than a definition list on its side: the labels line up, so the eye
          runs down one column to find "Website" instead of reading every row. */}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-xs">
        {fields.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-slate-400">{f.label}</dt>
            <dd className="min-w-0 text-slate-800">{f.value}</dd>
          </div>
        ))}
      </dl>

      {children && <div className="mt-3 border-t border-slate-100 pt-3">{children}</div>}
    </article>
  )
}

/** Wraps a card list so only phones see it — the table takes over from `sm` up. */
export function CardList({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 sm:hidden">{children}</div>
}

/** Wraps a table so phones never see it — the cards take over below `sm`. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">{children}</div>
}
