import { ageInDays, probeAll, type ProbeResult, type ProbeStatus } from "@/lib/deploys/probe"
import { recheck } from "./actions"

/** Never cached: a cached answer defeats the entire purpose. */
export const dynamic = "force-dynamic"

const fmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
})

const STATUS: Record<ProbeStatus, { chip: string; dot: string; label: string }> = {
  ok: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", label: "Live" },
  "stale-image": {
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
    label: "No stamp",
  },
  "no-endpoint": {
    chip: "bg-slate-100 text-slate-600 ring-slate-200",
    dot: "bg-slate-400",
    label: "Not deployed yet",
  },
  unreachable: { chip: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500", label: "Unreachable" },
}

function explain(result: ProbeResult): string {
  switch (result.status) {
    case "ok":
      return result.info?.tree === "dirty"
        ? "Built with uncommitted changes, so the commit below is approximate."
        : "The commit below is exactly what is serving traffic."
    case "stale-image":
      return "Responding, but built before the provenance args existed. Redeploy to stamp it."
    case "no-endpoint":
      return "Up, but this build predates /api/build. It appears after the next deploy."
    case "unreachable":
      return result.error ?? "No response."
  }
}

function Row({ result }: { result: ProbeResult }) {
  const style = STATUS[result.status]
  const age = ageInDays(result.info?.builtAt)

  return (
    <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${style.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {style.label}
          </span>
          <span className="text-sm font-semibold text-slate-900">{result.service.label}</span>
          {result.info?.tree === "dirty" ? (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              dirty tree
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-slate-500">{explain(result)}</p>
        <p className="mt-1 font-mono text-[11px] text-slate-400">
          {result.service.host} · {result.ms} ms
        </p>
      </div>

      <div className="font-mono text-xs text-slate-700 sm:text-right">
        {result.info?.commit && result.info.commit !== "unknown" ? (
          <>
            <div className="font-semibold text-slate-900">
              {result.info.commit}
              {result.info.branch && result.info.branch !== "unknown" ? (
                <span className="font-normal text-slate-400"> ({result.info.branch})</span>
              ) : null}
            </div>
            <div className="mt-0.5 text-slate-500">
              {result.info.builtAt && result.info.builtAt !== "unknown"
                ? fmt.format(new Date(result.info.builtAt))
                : "no timestamp"}
            </div>
            {age !== null ? (
              <div className={`mt-0.5 ${age > 14 ? "text-amber-700" : "text-slate-400"}`}>
                {age === 0 ? "today" : age === 1 ? "1 day ago" : `${age} days ago`}
              </div>
            ) : null}
          </>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </div>
    </div>
  )
}

export default async function DeploysPage() {
  const { results, checkedAt } = await probeAll()

  const live = results.filter((r) => r.status === "ok").length
  const down = results.filter((r) => r.status === "unreachable").length
  const unstamped = results.filter(
    (r) => r.status === "no-endpoint" || r.status === "stale-image"
  ).length

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">Deployments</h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">
              Each service is asked directly what it was built from. This reflects the container
              actually running — a rollback shows the rolled-back commit, and a deploy from anyone
              else&apos;s machine is still reported correctly.
            </p>
          </div>
          <form action={recheck}>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              Re-check
            </button>
          </form>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            {live} reporting
          </span>
          {unstamped ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              {unstamped} awaiting a deploy
            </span>
          ) : null}
          {down ? (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
              {down} unreachable
            </span>
          ) : null}
          <span className="text-slate-400">checked {fmt.format(checkedAt)} IST</span>
        </div>
      </header>

      <div className="p-6">
        <section className="rounded-xl border border-slate-200 bg-white">
          {results.map((result) => (
            <Row key={result.service.key} result={result} />
          ))}
        </section>

        <p className="mt-4 max-w-2xl text-xs text-slate-500">
          <span className="font-semibold text-slate-700">dirty tree</span> means uncommitted files
          were built into that image, so the commit identifies roughly what shipped rather than
          exactly. Commit it and redeploy to make the stamp precise.
        </p>
      </div>
    </main>
  )
}
