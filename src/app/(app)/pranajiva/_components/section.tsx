import Link from "next/link"

/**
 * Chrome shared by every screen in the Pranajiva section.
 *
 * There is no brand badge and no row of section tabs here. Both existed before the sidebar became a
 * brand switch, and both are now saying something the navigation already says louder — an operator
 * on these screens can see "Pranajiva Ops" at the top left and the five knowledge-base entries below
 * it. Repeating that in the page header would be the third answer to a question nobody is still
 * asking.
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

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string
  value: React.ReactNode
  hint?: string
  href?: string
  tone?: "default" | "muted"
}) {
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone === "muted" ? "text-slate-400" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  )

  const className = `rounded-xl border border-slate-200 bg-white p-4 ${
    href ? "transition hover:border-slate-300 hover:shadow-sm" : ""
  }`

  return href ? (
    <Link href={href} className={`block ${className}`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/**
 * The state every screen here needs and none of them should invent for themselves: a control
 * document the corpus was expected to contain could not be found.
 *
 * It says which file it looked for, because the fix is nearly always to check the name or the
 * sharing rather than anything in this app.
 */
export function MissingDocument({ what, filename }: { what: string; filename: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <p className="text-sm font-semibold text-slate-700">No {what} found in Drive</p>
      <p className="mx-auto mt-1 max-w-lg text-xs text-slate-500">
        OPS looks for a file whose name contains <code className="rounded bg-slate-100 px-1">{filename}</code>{" "}
        anywhere under the shared root. Nothing matched, so there is nothing to show — this is not an
        error, just an empty pipeline or a renamed file.
      </p>
    </div>
  )
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={99} className="px-4 py-8 text-center text-xs text-slate-500">
        {children}
      </td>
    </tr>
  )
}
