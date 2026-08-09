import Link from "next/link"

import { getDbPool } from "@/lib/db"
import BakerTabs from "../baker-tabs"

export const dynamic = "force-dynamic"

/**
 * The pipeline as a board. Deliberately shows only the five stages a baker is actively moving
 * through — declined and inactive are outcomes, not work, and putting them on the board would
 * make a healthy pipeline look cluttered with the dead.
 */
const BOARD_STAGES = ["prospect", "contacted", "negotiating", "agreed", "onboarded"] as const

const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  negotiating: "Negotiating",
  agreed: "Agreed",
  onboarded: "Onboarded",
}

const CONFIDENCE_DOT: Record<string, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
}

/** After this long with no contact, a baker in an open stage is going cold. */
const STALE_DAYS = 14

const fmtDay = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
})

function daysSince(value: string | Date | null): number | null {
  if (!value) return null
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
}

interface BoardRow {
  id: string
  name: string
  city: string | null
  status: string
  confidence: string | null
  last_contacted_at: string | null
  assigned_to: string | null
  interaction_count: number
  next_appointment: string | null
  overdue_appointments: number
  primary_contact: string | null
}

export default async function PipelineBoardPage() {
  const db = getDbPool()
  const result = await db.query<BoardRow>(
    `SELECT
       b.id, b.name, b.city, b.status, b.confidence, b.last_contacted_at, b.assigned_to,
       (SELECT count(*)::int FROM baker_network.baker_interactions i WHERE i.baker_id = b.id)
         AS interaction_count,
       (SELECT min(a.scheduled_for) FROM baker_network.baker_appointments a
          WHERE a.baker_id = b.id AND a.status = 'scheduled')
         AS next_appointment,
       (SELECT count(*)::int FROM baker_network.baker_appointments a
          WHERE a.baker_id = b.id AND a.status = 'scheduled' AND a.scheduled_for < NOW())
         AS overdue_appointments,
       (SELECT c.name FROM baker_network.baker_contacts c
          WHERE c.baker_id = b.id AND c.is_primary AND c.is_active LIMIT 1)
         AS primary_contact
     FROM baker_network.bakers b
     WHERE b.status = ANY($1::varchar[])
     ORDER BY b.name`,
    [BOARD_STAGES as unknown as string[]]
  )

  const rows = result.rows

  // The two things worth interrupting someone's morning for.
  const overdue = rows.filter((r) => r.overdue_appointments > 0)
  const goingCold = rows.filter(
    (r) =>
      r.status !== "onboarded" &&
      r.overdue_appointments === 0 &&
      !r.next_appointment &&
      (daysSince(r.last_contacted_at) ?? Infinity) >= STALE_DAYS
  )

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 pt-4">
        <h1 className="mb-3 text-base font-bold text-slate-900">Bakers</h1>
        <BakerTabs />
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {(overdue.length > 0 || goingCold.length > 0) && (
          <div className="mb-6 flex flex-col gap-2">
            {overdue.length > 0 && (
              <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-rose-200">
                <strong>{overdue.length}</strong> baker{overdue.length === 1 ? " has" : "s have"} an
                appointment that has passed without being resolved:{" "}
                {overdue.map((r, i) => (
                  <span key={r.id}>
                    {i > 0 && ", "}
                    <Link href={`/bakers/${r.id}`} className="font-semibold underline">
                      {r.name}
                    </Link>
                  </span>
                ))}
              </p>
            )}
            {goingCold.length > 0 && (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
                <strong>{goingCold.length}</strong> going cold — no contact in {STALE_DAYS}+ days and
                nothing scheduled:{" "}
                {goingCold.map((r, i) => (
                  <span key={r.id}>
                    {i > 0 && ", "}
                    <Link href={`/bakers/${r.id}`} className="font-semibold underline">
                      {r.name}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {BOARD_STAGES.map((stage) => {
            const inStage = rows
              .filter((r) => r.status === stage)
              // Most urgent first: overdue, then longest since anyone spoke to them.
              .sort(
                (a, b) =>
                  b.overdue_appointments - a.overdue_appointments ||
                  (daysSince(b.last_contacted_at) ?? Infinity) -
                    (daysSince(a.last_contacted_at) ?? Infinity)
              )

            return (
              <section key={stage} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                  <h2 className="text-sm font-bold text-slate-900">{STAGE_LABELS[stage]}</h2>
                  <span className="text-xs font-semibold text-slate-400">{inStage.length}</span>
                </div>

                {inStage.length === 0 ? (
                  <p className="py-4 text-xs text-slate-400">Empty</p>
                ) : (
                  inStage.map((r) => {
                    const stale = daysSince(r.last_contacted_at)
                    return (
                      <Link
                        key={r.id}
                        href={`/bakers/${r.id}`}
                        className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-400 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <strong className="text-sm leading-tight text-slate-900">{r.name}</strong>
                          {r.confidence && (
                            <span
                              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${CONFIDENCE_DOT[r.confidence]}`}
                              title={`${r.confidence} confidence`}
                            />
                          )}
                        </div>

                        {(r.city || r.primary_contact) && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {[r.primary_contact, r.city].filter(Boolean).join(" · ")}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap gap-1">
                          {r.overdue_appointments > 0 ? (
                            <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                              {r.overdue_appointments} overdue
                            </span>
                          ) : r.next_appointment ? (
                            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                              {fmtDay.format(new Date(r.next_appointment))}
                            </span>
                          ) : null}

                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              stale === null
                                ? "bg-slate-100 text-slate-500"
                                : stale >= STALE_DAYS
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {stale === null
                              ? "no contact yet"
                              : stale === 0
                                ? "today"
                                : `${stale}d ago`}
                          </span>

                          {r.interaction_count > 0 && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                              {r.interaction_count} log{r.interaction_count === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })
                )}
              </section>
            )
          })}
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Declined and inactive bakeries are not shown — find them in{" "}
          <Link href="/bakers" className="underline">
            All Bakers
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
