import type { ReactNode } from "react"

/**
 * Presentational primitives for the handbook.
 *
 * Kept in one place so nine pages of documentation don't each invent their own spacing and
 * emphasis. Docs that look inconsistent read as untrustworthy, and a reader who is already unsure
 * about the system will assume the inconsistency is meaningful.
 */

export function PageHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <header className="mb-8 border-b border-slate-200 pb-6">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{intro}</p>
    </header>
  )
}

export function Section({
  id,
  title,
  children,
}: {
  id?: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="mb-10 scroll-mt-6">
      <h2 className="mb-3 text-base font-bold text-slate-900">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  )
}

export function SubSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-bold text-slate-800">{title}</h3>
      <div className="space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </div>
  )
}

/** Fixed-width block for paths, commands, SQL and ASCII diagrams. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700">
      {children}
    </pre>
  )
}

export function Term({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800">
      {children}
    </code>
  )
}

type CalloutTone = "info" | "warn" | "danger" | "good"

const TONE: Record<CalloutTone, { border: string; bg: string; title: string; body: string }> = {
  info: { border: "border-slate-300", bg: "bg-slate-50", title: "text-slate-900", body: "text-slate-700" },
  warn: { border: "border-amber-300", bg: "bg-amber-50", title: "text-amber-900", body: "text-amber-800" },
  danger: { border: "border-red-300", bg: "bg-red-50", title: "text-red-900", body: "text-red-800" },
  good: { border: "border-emerald-300", bg: "bg-emerald-50", title: "text-emerald-900", body: "text-emerald-800" },
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: CalloutTone
  title: string
  children: ReactNode
}) {
  const t = TONE[tone]
  return (
    <div className={`rounded-lg border ${t.border} ${t.bg} px-4 py-3`}>
      <p className={`text-sm font-bold ${t.title}`}>{title}</p>
      <div className={`mt-1 space-y-2 text-sm leading-relaxed ${t.body}`}>{children}</div>
    </div>
  )
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Numbered procedure. Use only where order genuinely matters — most lists are not steps. */
export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700">{item}</div>
        </li>
      ))}
    </ol>
  )
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}
