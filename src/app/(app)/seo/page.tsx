import {
  GROUP_LABELS,
  runAudit,
  scoreOf,
  type AuditRow,
  type CheckGroup,
  type CheckStatus,
} from "@/lib/seo/checks"
import { verifyAll, verifyCheck } from "./actions"

/**
 * Never cached. Every render fetches crossfriend.in, because a stale pass is the failure mode this
 * page exists to prevent.
 */
export const dynamic = "force-dynamic"

const fmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Kolkata",
})

const STATUS: Record<CheckStatus, { dot: string; chip: string; label: string }> = {
  pass: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Pass" },
  warn: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 ring-amber-200", label: "Warn" },
  fail: { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700 ring-rose-200", label: "Fail" },
  error: { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600 ring-slate-200", label: "Error" },
}

const GROUP_ORDER: CheckGroup[] = ["crawl", "onpage", "schema", "aeo"]

function StatusChip({ status }: { status: CheckStatus }) {
  const style = STATUS[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${style.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  )
}

function Row({ row, focused }: { row: AuditRow; focused: boolean }) {
  const { check, result } = row
  return (
    <div
      id={check.id}
      className={`flex flex-col gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 ${
        focused ? "bg-slate-50 ring-1 ring-inset ring-slate-900/10" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={result.status} />
            <span className="text-sm font-semibold text-slate-900">{check.label}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{check.why}</p>
          <p className="mt-1.5 font-mono text-xs text-slate-700">{result.detail}</p>
        </div>

        <form action={verifyCheck} className="shrink-0">
          <input type="hidden" name="id" value={check.id} />
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
          >
            Verify
          </button>
        </form>
      </div>

      {/* Evidence stays collapsed until the row is the focused one — twenty expanded blocks of raw
          HTML would bury the statuses this page exists to show. */}
      {focused && result.evidence ? (
        <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
          {result.evidence}
        </pre>
      ) : null}
    </div>
  )
}

export default async function SeoPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string; error?: string }>
}) {
  const { focus, error } = await searchParams
  const { rows, ranAt, base } = await runAudit()
  const score = scoreOf(rows)

  const blocking = rows.filter((r) => r.result.status === "fail")

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">Search &amp; answer engines</h1>
            <p className="mt-1 text-xs text-slate-500">
              Live audit of{" "}
              <a
                href={base}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-slate-700 underline underline-offset-2"
              >
                {base.replace(/^https?:\/\//, "")}
              </a>
              . Every check fetches the real site — nothing is read from the repo, so a change that
              was never deployed shows as a failure here.
            </p>
          </div>
          <form action={verifyAll}>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              Re-run all
            </button>
          </form>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            {score.pass} passing
          </span>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
            {score.warn} warnings
          </span>
          <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
            {score.fail} failing
          </span>
          {score.error ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
              {score.error} could not run
            </span>
          ) : null}
          <span className="text-slate-400">checked {fmt.format(ranAt)} IST</span>
        </div>
      </header>

      {error ? (
        <div className="mx-6 mt-4 rounded-lg bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
          {error}
        </div>
      ) : null}

      <div className="space-y-4 p-6">
        {blocking.length ? (
          <section className="rounded-xl border border-rose-200 bg-white">
            <div className="border-b border-rose-100 bg-rose-50/60 px-4 py-2.5">
              <h2 className="text-sm font-bold text-rose-900">
                Fix first — {blocking.length} failing
              </h2>
              <p className="mt-0.5 text-xs text-rose-700">
                Ordered as they appear below. Everything here is something an engine looks for and
                does not find.
              </p>
            </div>
            <ul className="divide-y divide-rose-50">
              {blocking.map(({ check, result }) => (
                <li key={check.id} className="flex items-baseline gap-3 px-4 py-2 text-xs">
                  <a
                    href={`#${check.id}`}
                    className="font-semibold text-slate-900 underline underline-offset-2"
                  >
                    {check.label}
                  </a>
                  <span className="font-mono text-slate-500">{result.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {GROUP_ORDER.map((group) => {
          const groupRows = rows.filter((r) => r.check.group === group)
          if (!groupRows.length) return null
          const meta = GROUP_LABELS[group]
          const groupScore = scoreOf(groupRows)

          return (
            <section key={group} className="rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{meta.title}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{meta.blurb}</p>
                </div>
                <span className="font-mono text-xs text-slate-400">
                  {groupScore.pass}/{groupRows.length} passing
                </span>
              </div>
              <div>
                {groupRows.map((row) => (
                  <Row key={row.check.id} row={row} focused={focus === row.check.id} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
