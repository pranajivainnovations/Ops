import Link from "next/link"

import { listOrders, PAYMENT, rupees, STATUS, type OrderListRow } from "@/lib/pranajiva/orders"
import { SectionHeader, StatCard } from "../_components/section"
import MoveButton from "./move-button"

export const dynamic = "force-dynamic"

/**
 * PranaJiva's orders.
 *
 * ── Why "To dispatch" is the first and loudest thing ──────────────────────────────────────────
 * It is the only group where nothing is happening and the clock is running. A jar on a shelf and a
 * paid order are two facts that only become a delivery when somebody puts them in a box, and that
 * is the single thing this screen exists to prompt. Everything else here is a record.
 *
 * ── Why the dispatch action is on the list, not only on the order ─────────────────────────────
 * Because the common day is five orders going out together, and making that five page loads and
 * five backs would be a worse tool than the spreadsheet it replaces. The order page is for the one
 * you need to look into.
 */
export default async function PranajivaOrdersPage() {
  const orders = await listOrders()

  const waiting = orders.filter(
    (o) => o.status === "placed" || o.status === "accepted" || o.status === "making"
  )

  /**
   * An order whose card payment never landed is not work.
   *
   * It is what a shopper leaves behind when they close the Razorpay window: a real order row with
   * nothing paid against it. Two of the first eight were exactly that. Left in the dispatch queue
   * they look identical to a paid order and the only thing standing between them and a parcel
   * posted for free is somebody reading the payment column — so they get their own group instead.
   *
   * Cash is the opposite case and stays in the queue: `awaiting` is the correct and permanent state
   * of a COD order until it is handed over.
   */
  const unpaid = waiting.filter(
    (o) => o.paymentMethod !== "cod" && o.paymentStatus !== "paid"
  )
  const toDispatch = waiting.filter((o) => !unpaid.includes(o))
  const onTheWay = orders.filter((o) => o.status === "out_for_delivery")
  const closed = orders.filter((o) => o.status === "delivered" || o.status === "cancelled")

  const takings = orders
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + o.payablePaise, 0)

  /* Cash still to collect at the door — money the business is owed, which is a different number
     from takings and the one that goes missing if an order is marked delivered without it. */
  const toCollect = orders
    .filter((o) => o.paymentMethod === "cod" && o.paymentStatus === "awaiting" && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.payablePaise, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionHeader
        title="Orders"
        description="Everything bought on pranajiva.in. Mark an order on its way when it leaves, and delivered when it lands — the customer is told at each step, and a cash order is also marked paid when you mark it delivered."
      />

      <div className="space-y-6 px-6 py-4">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="To dispatch"
            value={toDispatch.length}
            hint={toDispatch.length ? "Waiting on somebody to send them" : "Nothing waiting"}
          />
          <StatCard label="On the way" value={onTheWay.length} />
          <StatCard label="Paid, all time" value={rupees(takings)} />
          <StatCard
            label="Cash to collect"
            value={rupees(toCollect)}
            hint="On delivery, not yet received"
            tone={toCollect ? "default" : "muted"}
          />
        </section>

        <Group
          title="To dispatch"
          hint="Paid for, or cash on delivery, and not yet sent. Pressing On the way texts the customer."
          rows={toDispatch}
          emphasis
        />
        <Group
          title="Not paid — do not send"
          hint="The card payment never completed, usually because the shopper closed the payment window. Nothing is owed and nothing should go out. Cancel it once you are sure, or leave it as a record."
          rows={unpaid}
          action="cancel"
        />
        <Group
          title="On the way"
          hint="Sent. Mark delivered when it arrives — for a cash order that is also when the money is recorded."
          rows={onTheWay}
        />
        <Group title="Delivered and cancelled" rows={closed} />

        {orders.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-xs text-slate-500">
            No PranaJiva orders yet.
          </p>
        )}
      </div>
    </div>
  )
}

function Group({
  title,
  hint,
  rows,
  emphasis,
  action = "advance",
}: {
  title: string
  hint?: string
  rows: OrderListRow[]
  emphasis?: boolean
  /** `cancel` on the unpaid group, where moving the order forward is the wrong thing to offer. */
  action?: "advance" | "cancel"
}) {
  if (!rows.length) return null

  return (
    <section>
      <h2 className="flex items-baseline gap-2 text-sm font-semibold text-slate-900">
        {title}
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
            emphasis ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-700"
          }`}
        >
          {rows.length}
        </span>
      </h2>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}

      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Order</th>
                <th className="px-4 py-2 font-semibold">Customer</th>
                <th className="px-4 py-2 font-semibold">What</th>
                <th className="px-4 py-2 text-right font-semibold">Amount</th>
                <th className="px-4 py-2 font-semibold">Payment</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((o) => (
                <Row key={o.id} order={o} action={action} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function Row({
  order,
  action,
}: {
  order: OrderListRow
  action: "advance" | "cancel"
}) {
  const status = STATUS[order.status]
  const payment = PAYMENT[order.paymentStatus] ?? { label: order.paymentStatus, tone: "text-slate-600" }

  return (
    <tr className="align-top hover:bg-slate-50/60">
      <td className="px-4 py-3 whitespace-nowrap">
        <Link
          href={`/pranajiva/orders/${order.id}`}
          className="font-mono font-semibold text-slate-900 underline-offset-2 hover:underline"
        >
          #{order.displayId}
        </Link>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {new Date(order.createdAt).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </td>

      <td className="px-4 py-3">
        <p className="font-medium text-slate-800">{order.customerName}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {order.customerMobile ?? "no number"}
          {order.city ? ` · ${order.city}` : ""}
        </p>
      </td>

      <td className="max-w-xs px-4 py-3 text-slate-600">{order.itemSummary || "—"}</td>

      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">
        {rupees(order.payablePaise)}
        {order.creditAppliedPaise > 0 && (
          <p className="mt-0.5 text-[11px] font-normal text-slate-400">
            after {rupees(order.creditAppliedPaise)} credit
          </p>
        )}
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`font-semibold ${payment.tone}`}>{payment.label}</span>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {order.paymentMethod === "cod" ? "On delivery" : "Online"}
        </p>
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.chip}`}>
          {status.label}
        </span>
      </td>

      <td className="px-4 py-3 text-right whitespace-nowrap">
        {action === "cancel" ? (
          <MoveButton orderId={order.id} next="cancelled" label="Cancel" tone="danger" />
        ) : (
          <>
            {(order.status === "placed" ||
              order.status === "accepted" ||
              order.status === "making") && (
              <MoveButton orderId={order.id} next="out_for_delivery" label="On the way" />
            )}
            {order.status === "out_for_delivery" && (
              <MoveButton orderId={order.id} next="delivered" label="Delivered" />
            )}
          </>
        )}
      </td>
    </tr>
  )
}
