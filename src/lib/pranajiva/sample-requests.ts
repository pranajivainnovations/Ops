import { getDbPool } from "@/lib/db"

/**
 * Reading and moving free-sample requests.
 *
 * ── Why this screen had to exist in the same change as the form ───────────────────────────────
 * Because there is no mail service anywhere in this stack — no SMTP credential, no transactional
 * provider, no sending domain. Nothing can email a staff member when a request arrives, so the row
 * in the table is not a record of a notification: it IS the notification. A sample form without
 * this screen collects addresses nobody ever reads, which is a quieter version of the bug the
 * contact form already had once.
 *
 * ── Why the writes here are plain UPDATEs and not backend calls ───────────────────────────────
 * The orders screen routes its transitions through the backend, and for good reasons: PranaJiva's
 * status rules live there, it writes the event the customer's own order page reads, it settles COD
 * cash, and it fires the SMS. None of that applies to a sachet. There is no customer-facing page
 * for a sample request, no money, no message, and the only rule is that whoever moved it is
 * recorded. An UPDATE does the whole job, and adding a backend route would be indirection with
 * nothing behind it.
 */

export type SampleStatus = "new" | "approved" | "dispatched" | "rejected"

export const SAMPLE_STATUS: Record<
  SampleStatus,
  { label: string; chip: string; blurb: string }
> = {
  new: {
    label: "New",
    chip: "bg-amber-100 text-amber-800",
    blurb: "Not looked at yet.",
  },
  approved: {
    label: "To post",
    chip: "bg-blue-100 text-blue-800",
    blurb: "Checked and in the pile for the next batch.",
  },
  dispatched: {
    label: "Posted",
    chip: "bg-emerald-100 text-emerald-800",
    blurb: "In the post.",
  },
  rejected: {
    label: "Declined",
    chip: "bg-slate-100 text-slate-600",
    blurb: "Not sending — the note says why.",
  },
}

/** What an operator can do next, given where a request is. */
export function nextStatuses(status: SampleStatus): SampleStatus[] {
  switch (status) {
    case "new":
      return ["approved", "rejected"]
    case "approved":
      return ["dispatched", "rejected"]
    case "dispatched":
      return []
    case "rejected":
      return ["approved"]
  }
}

export interface SampleRequestRow {
  id: string
  name: string
  phone: string
  email: string
  productHandle: string
  addressLine1: string
  addressLine2: string | null
  landmark: string | null
  city: string
  state: string
  pincode: string
  reason: string | null
  marketingOptIn: boolean
  customerId: string | null
  status: SampleStatus
  handledBy: string | null
  handledAt: string | null
  note: string
  dispatchedAt: string | null
  courierRef: string | null
  createdAt: string
  /** Whether this number has ordered from us before — worth knowing before posting a freebie. */
  hasOrdered: boolean
}

/**
 * True when the table exists.
 *
 * The migration is applied separately and deliberately in this project, so this screen can load
 * before the table does. It says so rather than throwing a 500 at whoever opened it.
 */
export async function sampleRequestsReady(): Promise<boolean> {
  try {
    const { rows } = await getDbPool().query<{ t: string | null }>(
      `SELECT to_regclass('support.sample_requests')::text AS t`
    )
    return Boolean(rows[0]?.t)
  } catch {
    return false
  }
}

/**
 * Every request, newest first.
 *
 * ── Why the order-history flag is a LEFT JOIN and not a second query ─────────────────────────
 * Whether a requester has bought before changes what an operator does with the row — a first-time
 * name is the whole point of the offer, and a repeat customer asking for a freebie is a different
 * conversation. Fetching it per row would be one query per request on a screen that lists all of
 * them.
 *
 * Matched on phone because that is the identity this stack uses: OTP login already treats one
 * mobile as one customer across both brands, and a sample request does not require signing in.
 */
export async function listSampleRequests(limit = 200): Promise<SampleRequestRow[]> {
  const { rows } = await getDbPool().query(
    `SELECT s.id,
            s.name,
            s.phone,
            s.email,
            s.product_handle,
            s.address_line1,
            s.address_line2,
            s.landmark,
            s.city,
            s.state,
            s.pincode,
            s.reason,
            s.marketing_opt_in,
            s.customer_id,
            s.status,
            s.handled_by,
            s.handled_at,
            s.note,
            s.dispatched_at,
            s.courier_ref,
            s.created_at,
            EXISTS (
              SELECT 1 FROM customer c
               WHERE c.phone IS NOT NULL
                 AND right(regexp_replace(c.phone, '\\D', '', 'g'), 10) = s.phone
            ) AS has_ordered
       FROM support.sample_requests s
      WHERE s.brand = 'pranajiva'
      ORDER BY s.created_at DESC
      LIMIT $1`,
    [limit]
  )

  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    phone: r.phone,
    email: r.email,
    productHandle: r.product_handle,
    addressLine1: r.address_line1,
    addressLine2: r.address_line2,
    landmark: r.landmark,
    city: r.city,
    state: r.state,
    pincode: r.pincode,
    reason: r.reason,
    marketingOptIn: Boolean(r.marketing_opt_in),
    customerId: r.customer_id,
    status: r.status as SampleStatus,
    handledBy: r.handled_by,
    handledAt: r.handled_at ? new Date(r.handled_at).toISOString() : null,
    note: r.note ?? "",
    dispatchedAt: r.dispatched_at ? new Date(r.dispatched_at).toISOString() : null,
    courierRef: r.courier_ref,
    createdAt: new Date(r.created_at).toISOString(),
    hasOrdered: Boolean(r.has_ordered),
  }))
}

/**
 * Move one request, recording who did it.
 *
 * `handled_by` and `handled_at` are written together because the table's own CHECK constraint
 * requires it — a row claiming it was dealt with but not by whom is worse than an untouched one.
 * `dispatched_at` is set only on the move to dispatched, and only the first time, so a correction
 * later does not rewrite when the sachet actually went out.
 *
 * ── Why $2 is cast to ::text at BOTH of its uses ──────────────────────────────────────────────
 * Because it appears twice and Postgres deduces a type from each use independently: assigning it to
 * `status` makes it `character varying`, comparing it to the literal 'dispatched' makes it `text`,
 * and it then refuses the whole statement with 42P08, "inconsistent types deduced for parameter
 * $2". Casting only one of the two does not help — the other use still disagrees. Both are cast so
 * the parameter has exactly one deduced type, and assigning text into a varchar(32) column coerces
 * on the way in.
 *
 * This type-checked cleanly and failed only when run, so it would have thrown the first time
 * anybody pressed "Mark posted". It was caught by executing the statement against the real schema
 * inside a rolled-back transaction, which is the only thing that does catch this class of bug.
 */
export async function setSampleStatus(
  id: string,
  status: SampleStatus,
  opsUserId: string,
  note?: string
): Promise<void> {
  await getDbPool().query(
    `UPDATE support.sample_requests
        SET status        = $2::text,
            handled_by    = $3,
            handled_at    = NOW(),
            note          = COALESCE(NULLIF($4, ''), note),
            dispatched_at = CASE
                              WHEN $2::text = 'dispatched' THEN COALESCE(dispatched_at, NOW())
                              ELSE dispatched_at
                            END
      WHERE id = $1`,
    [id, status, opsUserId, note ?? ""]
  )
}

/** One address block, as a courier label would read it. */
export function addressLines(r: SampleRequestRow): string[] {
  return [
    r.name,
    r.addressLine1,
    r.addressLine2,
    r.landmark ? `Near ${r.landmark}` : null,
    `${r.city}, ${r.state} ${r.pincode}`,
    `Ph: ${r.phone}`,
  ].filter((l): l is string => Boolean(l))
}
