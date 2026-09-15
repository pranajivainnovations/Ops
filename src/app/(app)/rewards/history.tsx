import {
  formatValue,
  isError,
  type AuditEntry,
  type Brand,
  type FieldSpec,
  type Mechanic,
} from "./types"
import { getRewardHistory } from "./data"

/**
 * Who changed this, when, and what moved.
 *
 * ── Why it shows differences and not snapshots ─────────────────────────────────────────────────
 * Nobody has ever wanted to know what all eleven settings were in March. The question is what
 * changed and who changed it, and a list of complete versions answers that only after somebody
 * compares two dense blocks by eye — which is precisely the work a log is supposed to save.
 *
 * ── Why the note is given as much room as the numbers ──────────────────────────────────────────
 * The numbers say a rate went from 5% to 3%. The note is the only place that ever says why, and it
 * is the half that cannot be reconstructed later from anything else.
 */
export default async function RewardHistory({
  brand,
  pincode,
  mechanic,
  fields,
}: {
  brand: Brand
  pincode: string | null
  mechanic: Mechanic
  fields: FieldSpec[]
}) {
  const entries = await getRewardHistory(brand, pincode, mechanic)

  if (isError(entries)) {
    return <p className="text-[11px] text-amber-700">History unavailable: {entries.error}</p>
  }
  if (entries.length === 0) {
    return <p className="text-[11px] text-slate-400">No versions yet.</p>
  }

  const specByKey = new Map(fields.map((f) => [f.key, f]))

  /** Renders a changed value in its own unit, so "5%" does not appear as "500". */
  const show = (field: string, value: AuditEntry["changes"][number]["from"]) => {
    if (value === null) return "not set"
    if (typeof value === "string" && value.includes("T")) {
      return new Date(value).toLocaleDateString("en-IN")
    }
    const spec = specByKey.get(field)
    if (spec && (typeof value === "number" || typeof value === "boolean")) {
      return formatValue(spec, value)
    }
    if (field === "budget") return `₹${(Number(value) / 100).toLocaleString("en-IN")}`
    if (typeof value === "boolean") return value ? "on" : "off"
    return String(value)
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.version} className="border-l-2 border-slate-200 pl-3">
          <div className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">v{entry.version}</span>
            <span className="tabular-nums">
              {new Date(entry.createdAt).toLocaleString("en-IN")}
            </span>
            <span>
              {entry.createdByName ?? (
                /* A version written by a migration or a script has no ops user behind it, and
                   saying so is better than printing a blank where a name belongs. */
                <span className="italic text-slate-400">not attributed</span>
              )}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 font-semibold ${
                entry.isEnabled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {entry.isEnabled ? "on" : "off"}
            </span>
          </div>

          {entry.note && (
            <p className="mt-1 text-xs leading-relaxed text-slate-700">{entry.note}</p>
          )}

          {entry.changes.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {entry.changes.map((c, i) => (
                <li key={i} className="text-[11px] text-slate-600">
                  <span className="font-medium">
                    {specByKey.get(c.field)?.label ?? c.field}
                  </span>{" "}
                  <span className="text-slate-400">{show(c.field, c.from)}</span>
                  <span className="mx-1 text-slate-400">→</span>
                  <span className="font-semibold text-slate-800">{show(c.field, c.to)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-slate-400">First version.</p>
          )}
        </li>
      ))}
    </ol>
  )
}
