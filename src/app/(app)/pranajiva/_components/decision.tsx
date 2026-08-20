import {
  decisionChip,
  decisionOptionsFor,
  type Decision,
  type SubjectKind,
} from "@/lib/pranajiva/decisions"
import { recordDecision } from "../actions"

/**
 * The one control that writes anything in this section.
 *
 * A plain form posting to a server action, matching the rest of OPS: no client JavaScript, so it
 * works on a slow phone in a kitchen and cannot get stuck in a half-saved state. The explicit Save
 * is the cost of that — a select that submitted on change would need JS, and would also make an
 * accidental keyboard scroll through the options fire four writes.
 */
export function DecisionControl({
  kind,
  subjectKey,
  decision,
  returnTo,
  withNote = false,
}: {
  kind: SubjectKind
  subjectKey: string
  decision: Decision | undefined
  returnTo: string
  /** Formula and product detail screens get a note field; dense boards do not have room. */
  withNote?: boolean
}) {
  const options = decisionOptionsFor(kind)

  return (
    <form action={recordDecision} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="subjectKey" value={subjectKey} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {!withNote && <input type="hidden" name="note" value={decision?.note ?? ""} />}

      <select
        name="status"
        defaultValue={decision?.status ?? ""}
        aria-label="Decision"
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value || "none"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {withNote && (
        <input
          type="text"
          name="note"
          defaultValue={decision?.note ?? ""}
          placeholder="Note (optional)"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
      )}

      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-slate-700"
      >
        Save
      </button>
    </form>
  )
}

/** The stored decision, read-only — for lists where editing every row would be noise. */
export function DecisionChip({
  kind,
  decision,
}: {
  kind: SubjectKind
  decision: Decision | undefined
}) {
  const option = decisionChip(kind, decision?.status ?? null)
  if (!decision?.status) {
    return <span className="text-xs text-slate-300">—</span>
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${option.chip}`}
      title={decision.decidedBy ? `${option.label} — ${decision.decidedBy}` : option.label}
    >
      {option.label}
    </span>
  )
}
