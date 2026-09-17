import { setOrderStatus } from "./actions"

/**
 * Moving one baker's part of an order, from ops.
 *
 * ── Who owns delivery ──────────────────────────────────────────────────────────────────────────
 * CrossFriend does. A bakery makes the cake; getting it to the customer is ours, and so is saying it
 * arrived. That is why "Delivered" is a button of its own here rather than one option among six in a
 * dropdown — it is the routine act of this page, not an exception. The bakery can still record it if
 * they happen to hand it over themselves, but they are the second pair of hands, not the first.
 *
 * It is also the mark the whole reward chain hangs off: referral rewards are owed from delivery. When
 * the only party who could set it was an independent business, "when does a referrer get paid" was
 * really "whenever that bakery gets round to it".
 *
 * ── Why every other state is still offered ─────────────────────────────────────────────────────
 * The baker's own screen steps through the states in order and stops at delivered and declined. Ops
 * is the party those rules defer to — reopening a wrongly-declined order is exactly the case the
 * baker service's comments hand over. The dropdown is for those corrections; the button is for the
 * everyday.
 *
 * ── Why it is plain HTML with no JavaScript ────────────────────────────────────────────────────
 * A form that posts to a server action works before hydration, on a bad connection, and on whatever
 * device somebody is holding in a kitchen. There is nothing here that needs a click handler.
 */

const STATES: { value: string; label: string }[] = [
  { value: "new", label: "New" },
  { value: "accepted", label: "Accepted" },
  { value: "baking", label: "Baking" },
  { value: "ready", label: "Ready" },
  { value: "delivered", label: "Delivered" },
  { value: "rejected", label: "Declined" },
]

export default function StatusControl({
  orderId,
  bakerId,
  current,
}: {
  orderId: string
  bakerId: string
  current: string
}) {
  return (
    <span className="flex items-center gap-1.5">
      {/* The routine act, as its own one-click form. Offered whenever the order is not already
          delivered — including from states a baker has not moved through, because an order can arrive
          at a customer's door whatever a bakery did or did not tap. */}
      {current !== "delivered" && (
        <form action={setOrderStatus}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="bakerId" value={bakerId} />
          <input type="hidden" name="status" value="delivered" />
          <button
            type="submit"
            className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-slate-700"
            title="CrossFriend owns delivery. Recorded against your ops account, and the time is kept."
          >
            Delivered
          </button>
        </form>
      )}

      <form action={setOrderStatus} className="flex items-center gap-1">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="bakerId" value={bakerId} />

      <select
        name="status"
        defaultValue={current}
        aria-label="Set fulfilment state"
        className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700"
      >
        {STATES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
        title="Recorded against your ops account. The first time each step happened is kept, so a correction never rewrites when delivery actually occurred."
      >
        Set
      </button>
      </form>
    </span>
  )
}
