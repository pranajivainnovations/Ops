/**
 * What OPS decided about a piece of the research corpus.
 *
 * Drive holds the research; this holds the judgement on it. The two are kept apart deliberately —
 * see the migration comment on pranajiva.decisions for why writing back into Drive is both wrong in
 * principle and impossible in practice.
 *
 * The status vocabulary lives here rather than as a CHECK constraint so that adding a state is a
 * one-line change instead of a migration. It is still closed: the server action writes only values
 * from these lists, so a crafted form cannot invent a status that no screen knows how to display.
 */

import { getDbPool } from "@/lib/db"

/** The kinds of thing a decision can be about. Free text in the database, closed here. */
export type SubjectKind = "document" | "formula" | "product" | "topic"

export interface DecisionOption {
  value: string
  label: string
  /** Tailwind classes for the chip, so one status looks the same on every screen. */
  chip: string
}

const CLEARED: DecisionOption = {
  value: "",
  label: "No decision",
  chip: "bg-slate-100 text-slate-500",
}

/**
 * Vocabularies differ by subject because the work does.
 *
 * A formula is judged on whether it is worth productising; a product concept moves through a
 * research queue; a topic follows the content pipeline's own workflow. Forcing one list on all three
 * would mean every screen showing statuses that make no sense for what is on it.
 */
export const DECISION_OPTIONS: Record<SubjectKind, DecisionOption[]> = {
  formula: [
    { value: "shortlisted", label: "Shortlisted", chip: "bg-violet-100 text-violet-700" },
    { value: "investigating", label: "Investigating", chip: "bg-amber-100 text-amber-700" },
    { value: "productise", label: "Productise", chip: "bg-emerald-100 text-emerald-700" },
    { value: "parked", label: "Parked", chip: "bg-slate-200 text-slate-600" },
  ],
  product: [
    { value: "next", label: "Research next", chip: "bg-violet-100 text-violet-700" },
    { value: "in_progress", label: "In progress", chip: "bg-amber-100 text-amber-700" },
    { value: "approved", label: "Approved", chip: "bg-emerald-100 text-emerald-700" },
    { value: "dropped", label: "Dropped", chip: "bg-rose-100 text-rose-700" },
  ],
  topic: [
    { value: "selected", label: "Selected", chip: "bg-violet-100 text-violet-700" },
    { value: "researching", label: "Researching", chip: "bg-amber-100 text-amber-700" },
    { value: "done", label: "Done", chip: "bg-emerald-100 text-emerald-700" },
    { value: "skipped", label: "Skipped", chip: "bg-slate-200 text-slate-600" },
  ],
  document: [
    { value: "reviewed", label: "Reviewed", chip: "bg-emerald-100 text-emerald-700" },
    { value: "needs_attention", label: "Needs attention", chip: "bg-rose-100 text-rose-700" },
  ],
}

export function decisionOptionsFor(kind: SubjectKind): DecisionOption[] {
  return [CLEARED, ...DECISION_OPTIONS[kind]]
}

export function decisionChip(kind: SubjectKind, status: string | null): DecisionOption {
  if (!status) return CLEARED
  return DECISION_OPTIONS[kind].find((o) => o.value === status) ?? {
    // A status written before a vocabulary change still renders, labelled as it was stored, rather
    // than vanishing from the screen as if no decision had ever been made.
    value: status,
    label: status,
    chip: "bg-slate-200 text-slate-600",
  }
}

export function isKnownStatus(kind: SubjectKind, status: string): boolean {
  return DECISION_OPTIONS[kind].some((o) => o.value === status)
}

export interface Decision {
  subjectKey: string
  status: string | null
  note: string
  decidedBy: string | null
  decidedAt: Date
}

/**
 * Postgres `undefined_table`.
 *
 * OPS and the Backend deploy separately, so OPS can be running a version whose migration has not
 * been applied yet — which is exactly what happened the first time these screens were opened. The
 * research half of this section reads Drive and needs no database at all, so one unapplied migration
 * should cost the decision column, not the whole page.
 *
 * Caught narrowly on this one code. Any other database error is a real fault and still throws.
 */
const UNDEFINED_TABLE = "42P01"

function isMissingTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === UNDEFINED_TABLE
}

/**
 * Whether the decisions table exists.
 *
 * A single cheap catalogue lookup, so a screen can say "run the migration" rather than showing a
 * decision column that silently swallows every save.
 */
export async function decisionsSchemaReady(): Promise<boolean> {
  try {
    const db = getDbPool()
    const { rows } = await db.query<{ table: string | null }>(
      `SELECT to_regclass('pranajiva.decisions')::text AS table`
    )
    return Boolean(rows[0]?.table)
  } catch {
    return false
  }
}

/**
 * Every decision of one kind, keyed by subject.
 *
 * All of them at once rather than one query per row: a board renders hundreds of items, and the
 * table holds one row per decision actually made — a few dozen at most, and only for things someone
 * has looked at.
 */
export async function loadDecisions(kind: SubjectKind): Promise<Map<string, Decision>> {
  try {
    const db = getDbPool()
    const { rows } = await db.query<{
      subject_key: string
      status: string | null
      note: string
      email: string | null
      decided_at: Date
    }>(
      `SELECT d.subject_key, d.status, d.note, u.email, d.decided_at
         FROM pranajiva.decisions d
         LEFT JOIN baker_network.ops_users u ON u.id = d.decided_by
        WHERE d.subject_kind = $1`,
      [kind]
    )

    return new Map(
      rows.map((row) => [
        row.subject_key,
        {
          subjectKey: row.subject_key,
          status: row.status,
          note: row.note,
          decidedBy: row.email,
          decidedAt: row.decided_at,
        },
      ])
    )
  } catch (error) {
    if (isMissingTable(error)) return new Map()
    throw error
  }
}

/** Counts by status for one kind, for the overview cards. */
export async function countDecisions(kind: SubjectKind): Promise<Map<string, number>> {
  try {
    const db = getDbPool()
    const { rows } = await db.query<{ status: string | null; count: string }>(
      `SELECT status, COUNT(*)::text AS count
         FROM pranajiva.decisions
        WHERE subject_kind = $1 AND status IS NOT NULL
        GROUP BY status`,
      [kind]
    )
    return new Map(rows.map((row) => [row.status as string, Number(row.count)]))
  } catch (error) {
    if (isMissingTable(error)) return new Map()
    throw error
  }
}
