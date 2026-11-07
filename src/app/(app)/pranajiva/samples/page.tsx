import { EmptyRow, SectionHeader, StatCard } from "../_components/section"
import MoveButton from "./move-button"
import {
  addressLines,
  listSampleRequests,
  nextStatuses,
  SAMPLE_STATUS,
  sampleRequestsReady,
  type SampleRequestRow,
} from "@/lib/pranajiva/sample-requests"

export const dynamic = "force-dynamic"

/**
 * Free-sample requests from pranajiva.in/sample.
 *
 * ── Why this screen is the whole feature ──────────────────────────────────────────────────────
 * There is no mail service anywhere in this stack — no SMTP credential, no transactional provider,
 * no sending domain — so nothing can email anyone when a request arrives. The row in the table is
 * not a record of a notification; it IS the notification, and this is the only place it can be
 * read. A sample form without this screen collects addresses nobody opens.
 *
 * ── Why "To post" is the first and loudest group ──────────────────────────────────────────────
 * Same reason the orders screen leads with "To dispatch": it is the only group where somebody is
 * waiting and nothing is happening. Everything else here is a record.
 *
 * ── Why the whole address is on the list and not behind a detail page ─────────────────────────
 * Because the job this screen exists for is writing out a batch of envelopes, and that is one
 * screen with ten addresses on it, not ten page loads. There is deliberately no detail route.
 */
export default async function PranajivaSamplesPage() {
  if (!(await sampleRequestsReady())) {
    return (
      <div>
        <SectionHeader
          title="Free samples"
          description="Requests from the sample page on pranajiva.in."
        />
        <div className="p-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">
              The table has not been created yet.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Apply <code className="font-mono">1729200000000-CreateSampleRequests</code> on the
              backend and this screen fills in. Until then the form on the site answers 503 and
              tells visitors to message on WhatsApp instead — nothing is being collected and
              nothing is being lost.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const requests = await listSampleRequests()

  const isNew = requests.filter((r) => r.status === "new")
  const toPost = requests.filter((r) => r.status === "approved")
  const done = requests.filter((r) => r.status === "dispatched" || r.status === "rejected")

  return (
    <div>
      <SectionHeader
        title="Free samples"
        description="Requests from pranajiva.in/sample. One sachet per mobile number, posted in batches."
      />

      <div className="grid gap-3 p-6 sm:grid-cols-3">
        <StatCard
          label="To post"
          value={toPost.length}
          hint={toPost.length ? "Write these envelopes" : "Nothing waiting"}
          tone={toPost.length ? "default" : "muted"}
        />
        <StatCard
          label="New"
          value={isNew.length}
          hint={isNew.length ? "Not looked at yet" : "All triaged"}
          tone={isNew.length ? "default" : "muted"}
        />
        <StatCard label="Posted or declined" value={done.length} tone="muted" />
      </div>

      <div className="space-y-8 px-6 pb-10">
        <Group
          title="To post"
          blurb="Checked and waiting for the next batch. Mark each one as posted when it goes out."
          rows={toPost}
        />
        <Group
          title="New"
          blurb="Not triaged. Check the address looks real and whether they have ordered before, then approve or decline."
          rows={isNew}
        />
        <Group
          title="Posted and declined"
          blurb="The record. Nothing here needs doing."
          rows={done}
          quiet
        />
      </div>
    </div>
  )
}

function Group({
  title,
  blurb,
  rows,
  quiet = false,
}: {
  title: string
  blurb: string
  rows: SampleRequestRow[]
  quiet?: boolean
}) {
  return (
    <section>
      <h2 className="text-sm font-bold text-slate-900">
        {title}{" "}
        <span className="font-mono text-xs font-normal tabular-nums text-slate-400">
          {rows.length}
        </span>
      </h2>
      <p className="mt-0.5 max-w-2xl text-xs text-slate-500">{blurb}</p>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white">
          <EmptyRow>Nothing here.</EmptyRow>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Row row={r} quiet={quiet} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Row({ row, quiet }: { row: SampleRequestRow; quiet: boolean }) {
  const status = SAMPLE_STATUS[row.status]
  const moves = quiet ? [] : nextStatuses(row.status)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.chip}`}>
              {status.label}
            </span>
            <span className="text-sm font-semibold text-slate-900">{row.productHandle}</span>
            {/* Whether they have bought before changes what you do with a freebie, so it is on
                the row rather than a click away. */}
            {row.hasOrdered ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                has ordered before
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                new to us
              </span>
            )}
            {row.marketingOptIn && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                opted in
              </span>
            )}
          </div>

          {/* The address, as a label would read it — this screen exists to be copied from. */}
          <address className="mt-2 whitespace-pre-line font-mono text-xs not-italic leading-relaxed text-slate-700">
            {addressLines(row).join("\n")}
          </address>

          <p className="mt-2 text-xs text-slate-500">
            {row.email}
            {" · "}
            {new Date(row.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
          </p>

          {row.reason && (
            <p className="mt-2 max-w-2xl border-l-2 border-slate-200 pl-3 text-xs italic leading-relaxed text-slate-600">
              {row.reason}
            </p>
          )}

          {row.note && (
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-700">
              <span className="font-semibold">Note:</span> {row.note}
            </p>
          )}
        </div>

        {moves.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {moves.map((next) => (
              <MoveButton
                key={next}
                id={row.id}
                next={next}
                label={
                  next === "approved"
                    ? "Approve"
                    : next === "dispatched"
                      ? "Mark posted"
                      : "Decline"
                }
                tone={next === "rejected" ? "danger" : next === "approved" ? "primary" : "primary"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
