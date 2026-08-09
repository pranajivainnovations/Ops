import { getDbPool } from "@/lib/db"
import { STATUS_VALUES } from "../constants"
import {
  addContact,
  changeStage,
  logInteraction,
  rescheduleAppointment,
  resolveAppointment,
  scheduleAppointment,
  setConfidence,
  setContactActive,
  setPrimaryContact,
} from "./pipeline-actions"

/** Stages that mean the courtship is over, so the UI can stop nagging about follow-ups. */
const CLOSED_STAGES = new Set(["onboarded", "declined", "inactive"])

const KIND_LABELS: Record<string, string> = {
  note: "Note",
  call: "Call",
  whatsapp: "WhatsApp",
  email: "Email",
  visit: "Visit",
  meeting: "Meeting",
  other: "Other",
}

const OUTCOME_STYLES: Record<string, string> = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  negative: "bg-rose-50 text-rose-700 ring-rose-200",
  no_response: "bg-amber-50 text-amber-700 ring-amber-200",
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-emerald-600 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-slate-400 text-white",
}

const fmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
})

const fmtDay = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
})

function when(value: string | Date | null): string {
  return value ? fmt.format(new Date(value)) : "—"
}

function daysSince(value: string | Date | null): number | null {
  if (!value) return null
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
const labelClass = "mb-1 block text-xs font-semibold text-slate-600"
const buttonClass =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
const cardClass = "rounded-xl border border-slate-200 bg-white p-5"

interface Props {
  bakerId: string
  status: string
  confidence: string | null
  lastContactedAt: string | null
  error?: string
}

export default async function PipelinePanel({
  bakerId,
  status,
  confidence,
  lastContactedAt,
  error,
}: Props) {
  const db = getDbPool()
  const [contactsResult, interactionsResult, appointmentsResult, historyResult] = await Promise.all([
    db.query(
      `SELECT c.*, u.name AS created_by_name
         FROM baker_network.baker_contacts c
         LEFT JOIN baker_network.ops_users u ON u.id = c.created_by
        WHERE c.baker_id = $1
        ORDER BY c.is_primary DESC, c.is_active DESC, c.created_at`,
      [bakerId]
    ),
    db.query(
      `SELECT i.*, u.name AS author, c.name AS contact_name
         FROM baker_network.baker_interactions i
         LEFT JOIN baker_network.ops_users u ON u.id = i.created_by
         LEFT JOIN baker_network.baker_contacts c ON c.id = i.contact_id
        WHERE i.baker_id = $1
        ORDER BY i.occurred_at DESC`,
      [bakerId]
    ),
    db.query(
      `SELECT a.*, c.name AS contact_name, u.name AS owner
         FROM baker_network.baker_appointments a
         LEFT JOIN baker_network.baker_contacts c ON c.id = a.contact_id
         LEFT JOIN baker_network.ops_users u ON u.id = a.assigned_to
        WHERE a.baker_id = $1
        ORDER BY a.scheduled_for DESC`,
      [bakerId]
    ),
    db.query(
      `SELECT h.*, u.name AS actor
         FROM baker_network.baker_stage_history h
         LEFT JOIN baker_network.ops_users u ON u.id = h.changed_by
        WHERE h.baker_id = $1
        ORDER BY h.changed_at DESC`,
      [bakerId]
    ),
  ])

  const contacts = contactsResult.rows
  const activeContacts = contacts.filter((c) => c.is_active)
  const interactions = interactionsResult.rows
  const appointments = appointmentsResult.rows
  const history = historyResult.rows

  const upcoming = appointments.filter((a) => a.status === "scheduled")
  const resolved = appointments.filter((a) => a.status !== "scheduled")
  const staleDays = daysSince(lastContactedAt)
  const isClosed = CLOSED_STAGES.has(status)

  return (
    <section className="flex flex-col gap-4">
      {/* The tab already says "Pipeline" — this line carries the counts instead of repeating it. */}
      <p className="text-xs text-slate-400">
        {interactions.length} entr{interactions.length === 1 ? "y" : "ies"} · {contacts.length}{" "}
        contact{contacts.length === 1 ? "" : "s"} · {appointments.length} appointment
        {appointments.length === 1 ? "" : "s"}
      </p>

      {error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 ring-1 ring-rose-200">
          {error}
        </p>
      )}

      {/* ---------------------------------------------------------------- stage & confidence */}
      <div className={cardClass}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {status}
          </span>
          {confidence && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${CONFIDENCE_STYLES[confidence]}`}
            >
              {confidence} confidence
            </span>
          )}
          {!isClosed &&
            (staleDays === null ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                Never contacted
              </span>
            ) : (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  staleDays >= 14 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                Last contact {staleDays === 0 ? "today" : `${staleDays}d ago`}
              </span>
            ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <form action={changeStage.bind(null, bakerId)} className="flex flex-col gap-2">
            <div>
              <label className={labelClass} htmlFor="to_stage">
                Move to stage
              </label>
              <select id="to_stage" name="to_stage" defaultValue={status} className={inputClass}>
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              name="reason"
              placeholder="Why? (required when declining)"
              className={inputClass}
            />
            <button type="submit" className={buttonClass}>
              Change stage
            </button>
          </form>

          <form action={setConfidence.bind(null, bakerId)} className="flex flex-col gap-2">
            <div>
              <label className={labelClass} htmlFor="confidence">
                Confidence
              </label>
              <select
                id="confidence"
                name="confidence"
                defaultValue={confidence ?? ""}
                className={inputClass}
              >
                <option value="">Not set</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Your judgement, not a formula. Read it next to the last-contact figure — high
              confidence that nobody has called in three weeks is the one worth acting on.
            </p>
            <button type="submit" className={buttonClass}>
              Save confidence
            </button>
          </form>
        </div>

        {history.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-800">
              Stage history ({history.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {history.map((h) => (
                <li key={h.id} className="text-xs text-slate-600">
                  <span className="text-slate-400">{when(h.changed_at)}</span> ·{" "}
                  {h.from_stage ? `${h.from_stage} → ` : ""}
                  <strong>{h.to_stage}</strong>
                  {h.actor ? ` · ${h.actor}` : ""}
                  {h.reason ? ` — ${h.reason}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* -------------------------------------------------------------------------- contacts */}
      <div className={cardClass}>
        <h3 className="mb-3 text-sm font-bold text-slate-900">People ({contacts.length})</h3>

        {contacts.length === 0 ? (
          <p className="mb-3 text-sm text-slate-500">
            Nobody recorded yet. Add whoever actually answers the phone — that is rarely the number
            on Google.
          </p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2">
            {contacts.map((c) => (
              <li
                key={c.id}
                className={`rounded-lg border px-3 py-2 ${
                  c.is_active ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-slate-900">{c.name}</strong>
                  {c.role && <span className="text-xs text-slate-500">{c.role}</span>}
                  {c.is_primary && (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Primary
                    </span>
                  )}
                  {!c.is_active && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                      Retired
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  {[c.phone, c.whatsapp_number && `WA ${c.whatsapp_number}`, c.email]
                    .filter(Boolean)
                    .join(" · ") || "No contact details"}
                </p>
                {c.notes && <p className="mt-1 text-xs italic text-slate-500">{c.notes}</p>}
                <div className="mt-2 flex flex-wrap gap-3">
                  {c.is_active && !c.is_primary && (
                    <form action={setPrimaryContact.bind(null, bakerId, c.id)}>
                      <button
                        type="submit"
                        className="text-xs font-semibold text-slate-600 underline hover:text-slate-900"
                      >
                        Make primary
                      </button>
                    </form>
                  )}
                  <form action={setContactActive.bind(null, bakerId, c.id, !c.is_active)}>
                    <button
                      type="submit"
                      className="text-xs font-semibold text-slate-500 underline hover:text-slate-900"
                    >
                      {c.is_active ? "Retire" : "Restore"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <details>
          <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
            + Add a person
          </summary>
          <form action={addContact.bind(null, bakerId)} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="c_name">
                Name
              </label>
              <input id="c_name" name="name" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="c_role">
                Role
              </label>
              <input id="c_role" name="role" placeholder="Owner, manager…" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="c_phone">
                Phone
              </label>
              <input id="c_phone" name="phone" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="c_wa">
                WhatsApp
              </label>
              <input id="c_wa" name="whatsapp_number" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="c_email">
                Email
              </label>
              <input id="c_email" name="email" type="email" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="c_notes">
                Notes
              </label>
              <input
                id="c_notes"
                name="notes"
                placeholder="Best reached after 6pm…"
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="is_primary" className="h-4 w-4" />
              Primary contact
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className={buttonClass}>
                Add person
              </button>
            </div>
          </form>
        </details>
      </div>

      {/* ---------------------------------------------------------------------- appointments */}
      <div className={cardClass}>
        <h3 className="mb-3 text-sm font-bold text-slate-900">Appointments</h3>

        {upcoming.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {upcoming.map((a) => {
              const overdue = new Date(a.scheduled_for).getTime() < Date.now()
              return (
                <li
                  key={a.id}
                  className={`rounded-lg border px-3 py-2 ${
                    overdue ? "border-rose-200 bg-rose-50" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-slate-900">{when(a.scheduled_for)}</strong>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                      {KIND_LABELS[a.channel] ?? a.channel}
                    </span>
                    {overdue && (
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        Overdue
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700">{a.purpose}</p>
                  <p className="text-xs text-slate-500">
                    {[a.contact_name, a.location, a.owner && `owner ${a.owner}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900">
                      Resolve or reschedule
                    </summary>
                    <form
                      action={resolveAppointment.bind(null, bakerId, a.id)}
                      className="mt-2 flex flex-col gap-2"
                    >
                      <textarea
                        name="summary"
                        rows={2}
                        placeholder="What came out of it?"
                        className={inputClass}
                      />
                      <div className="flex flex-wrap gap-2">
                        <select name="status" defaultValue="completed" className={`${inputClass} max-w-[10rem]`}>
                          <option value="completed">Completed</option>
                          <option value="no_show">No show</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <select name="outcome" defaultValue="" className={`${inputClass} max-w-[10rem]`}>
                          <option value="">Outcome…</option>
                          <option value="positive">Positive</option>
                          <option value="neutral">Neutral</option>
                          <option value="negative">Negative</option>
                          <option value="no_response">No response</option>
                        </select>
                        <button type="submit" className={buttonClass}>
                          Save
                        </button>
                      </div>
                    </form>
                    <form
                      action={rescheduleAppointment.bind(null, bakerId, a.id)}
                      className="mt-2 flex flex-wrap gap-2"
                    >
                      <input
                        type="datetime-local"
                        name="scheduled_for"
                        className={`${inputClass} max-w-[14rem]`}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Reschedule
                      </button>
                    </form>
                  </details>
                </li>
              )
            })}
          </ul>
        )}

        <details className="mb-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
            + Schedule an appointment
          </summary>
          <form
            action={scheduleAppointment.bind(null, bakerId)}
            className="mt-3 grid gap-3 sm:grid-cols-2"
          >
            <div>
              <label className={labelClass} htmlFor="a_when">
                When
              </label>
              <input
                id="a_when"
                type="datetime-local"
                name="scheduled_for"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="a_channel">
                How
              </label>
              <select id="a_channel" name="channel" defaultValue="call" className={inputClass}>
                <option value="call">Call</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="visit">Visit</option>
                <option value="meeting">Meeting</option>
                <option value="email">Email</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="a_purpose">
                Purpose
              </label>
              <input
                id="a_purpose"
                name="purpose"
                required
                placeholder="Walk through commission terms"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="a_contact">
                With
              </label>
              <select id="a_contact" name="contact_id" defaultValue="" className={inputClass}>
                <option value="">—</option>
                {activeContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.role ? ` (${c.role})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="a_location">
                Where
              </label>
              <input id="a_location" name="location" placeholder="Their shop" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className={buttonClass}>
                Schedule
              </button>
            </div>
          </form>
        </details>

        {resolved.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-800">
              Past appointments ({resolved.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {resolved.map((a) => (
                <li key={a.id} className="text-xs text-slate-600">
                  <span className="text-slate-400">{fmtDay.format(new Date(a.scheduled_for))}</span> ·{" "}
                  {a.purpose} —{" "}
                  <strong
                    className={a.status === "completed" ? "text-emerald-700" : "text-slate-500"}
                  >
                    {a.status === "no_show" ? "no show" : a.status}
                  </strong>
                </li>
              ))}
            </ul>
          </details>
        )}

        {upcoming.length === 0 && resolved.length === 0 && (
          <p className="text-sm text-slate-500">Nothing scheduled.</p>
        )}
      </div>

      {/* -------------------------------------------------------------------------- timeline */}
      <div className={cardClass}>
        <h3 className="mb-3 text-sm font-bold text-slate-900">
          Conversation history ({interactions.length})
        </h3>

        <form
          action={logInteraction.bind(null, bakerId)}
          className="mb-4 rounded-lg bg-slate-50 p-4"
        >
          <label className={labelClass} htmlFor="i_summary">
            What happened?
          </label>
          <textarea
            id="i_summary"
            name="summary"
            rows={3}
            required
            placeholder="Spoke to Ramesh. Willing to start with 10 cakes/week, wants to see the commission terms in writing before committing."
            className={`${inputClass} mb-3`}
          />
          <div className="flex flex-wrap gap-2">
            <select name="kind" defaultValue="call" className={`${inputClass} max-w-[9rem]`}>
              <option value="call">Call</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="visit">Visit</option>
              <option value="meeting">Meeting</option>
              <option value="email">Email</option>
              <option value="note">Note</option>
              <option value="other">Other</option>
            </select>
            <select name="outcome" defaultValue="" className={`${inputClass} max-w-[9rem]`}>
              <option value="">Outcome…</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
              <option value="no_response">No response</option>
            </select>
            <select name="contact_id" defaultValue="" className={`${inputClass} max-w-[11rem]`}>
              <option value="">Spoke to…</option>
              {activeContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              name="occurred_at"
              title="Leave blank for now"
              className={`${inputClass} max-w-[13rem]`}
            />
            <button type="submit" className={buttonClass}>
              Log it
            </button>
          </div>
        </form>

        {interactions.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing logged yet. Every call recorded here is one your colleague does not have to
            repeat.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {interactions.map((i) => (
              <li key={i.id} className="border-l-2 border-slate-200 pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                    {KIND_LABELS[i.kind] ?? i.kind}
                  </span>
                  {i.outcome && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                        OUTCOME_STYLES[i.outcome] ?? ""
                      }`}
                    >
                      {i.outcome.replace("_", " ")}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{when(i.occurred_at)}</span>
                  {i.stage_at_time && i.stage_at_time !== status && (
                    <span
                      className="text-[10px] uppercase tracking-wide text-slate-400"
                      title="The stage this baker was in at the time"
                    >
                      during {i.stage_at_time}
                    </span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{i.summary}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {[i.contact_name && `with ${i.contact_name}`, i.author && `logged by ${i.author}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
