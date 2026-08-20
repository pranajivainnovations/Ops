"use server"

import { revalidatePath } from "next/cache"

import { getCurrentSession } from "@/lib/auth"
import { getDbPool } from "@/lib/db"
import { isKnownStatus, type SubjectKind } from "@/lib/pranajiva/decisions"

const KINDS: SubjectKind[] = ["document", "formula", "product", "topic"]

/**
 * Record — or clear — what OPS decided about one item of the corpus.
 *
 * Upsert on (subject_kind, subject_key) so a person changing their mind updates the existing row
 * rather than accumulating a history nothing reads. The only fact worth keeping is the current
 * decision and who last made it; if an audit trail is ever wanted, it should be a deliberate second
 * table, not a side effect of forgetting a conflict clause.
 *
 * An empty status deletes the row instead of storing NULL. "No decision" and "a decision that has
 * been cleared" are the same state to every screen, and one representation cannot drift from the
 * other.
 */
export async function recordDecision(formData: FormData) {
  const session = await getCurrentSession()

  const kind = String(formData.get("kind") ?? "") as SubjectKind
  const subjectKey = String(formData.get("subjectKey") ?? "").trim()
  const status = String(formData.get("status") ?? "").trim()
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000)
  const returnTo = String(formData.get("returnTo") ?? "/pranajiva")

  // Validated against the vocabulary rather than trusted: the kind and status arrive from a form,
  // and an unrecognised value would be stored happily and then render as a mystery chip forever.
  if (!KINDS.includes(kind) || !subjectKey) return
  if (status && !isKnownStatus(kind, status)) return

  const db = getDbPool()

  try {
    if (!status && !note) {
      await db.query(
        `DELETE FROM pranajiva.decisions WHERE subject_kind = $1 AND subject_key = $2`,
        [kind, subjectKey]
      )
    } else {
      await db.query(
        `INSERT INTO pranajiva.decisions (subject_kind, subject_key, status, note, decided_by, decided_at)
         VALUES ($1, $2, NULLIF($3, ''), $4, $5, NOW())
         ON CONFLICT (subject_kind, subject_key)
         DO UPDATE SET status = EXCLUDED.status,
                       note = EXCLUDED.note,
                       decided_by = EXCLUDED.decided_by,
                       decided_at = NOW()`,
        [kind, subjectKey, status, note, session?.userId ?? null]
      )
    }
  } catch (error) {
    // 42P01 undefined_table — the migration has not been applied on this database yet. The screens
    // already say so in a banner, so failing the whole request would only replace a clear
    // explanation with a stack trace. Anything else is a real fault and still throws.
    if ((error as { code?: string }).code !== "42P01") throw error
    console.error(
      "[pranajiva] decision not saved — pranajiva.decisions does not exist. Run migration 1724100000000-CreatePranajivaResearchSchema."
    )
  }

  // Only paths inside this section: returnTo comes from a form field, and revalidating an arbitrary
  // caller-supplied path would let a crafted request flush unrelated pages.
  revalidatePath(returnTo.startsWith("/pranajiva") ? returnTo : "/pranajiva")
}
