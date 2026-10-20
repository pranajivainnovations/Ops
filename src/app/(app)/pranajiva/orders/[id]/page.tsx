import Link from "next/link"
import { notFound } from "next/navigation"

import {
  getOrder,
  nextSteps,
  opsUserNames,
  PAYMENT,
  PRANAJIVA_RAIL,
  rupees,
  STATUS,
  type OrderDetail,
} from "@/lib/pranajiva/orders"
import { SectionHeader } from "../../_components/section"
import MoveButton from "../move-button"

export const dynamic = "force-dynamic"

/**
 * One order, tracked.
 *
 * ── What "tracking" means on this screen ──────────────────────────────────────────────────────
 * Three records, which together answer every question a customer phoning up can ask:
 *
 *   the rail      where the parcel is now, in the three steps PranaJiva actually has
 *   the history   who moved it and when, from the append-only event log — not a status column
 *                 somebody could have edited into a tidier story
 *   the messages  what the customer was actually told, and what failed to reach them
 *
 * The third is the one no other screen has. A customer saying "nobody told me it shipped" is
 * answerable here with the minute it was sent and the number it went to — or with the provider's
 * own refusal, which is far more often the truth.
 */
export default async function PranajivaOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const order = await getOrder(id)

  /* Covers both "no such order" and "that is a CrossFriend order" — the second deliberately
     indistinguishable, because its steps and its buttons would be wrong here. */
  if (!order) notFound()

  const names = await opsUserNames(order.events.map((e) => e.actor))
  const status = STATUS[order.status]
  const payment = PAYMENT[order.paymentStatus] ?? {
    label: order.paymentStatus,
    tone: "text-slate-600",
  }
  const steps = nextSteps(order.status)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionHeader
        title={`Order #${order.displayId}`}
        description={`${order.customerName} · ${new Date(order.createdAt).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {steps
              .filter((s) => s !== "cancelled")
              .map((s) => (
                <MoveButton
                  key={s}
                  orderId={order.id}
                  next={s}
                  label={s === "out_for_delivery" ? "Mark on the way" : "Mark delivered"}
                />
              ))}
            {steps.includes("cancelled") && (
              <MoveButton orderId={order.id} next="cancelled" label="Cancel" tone="danger" />
            )}
            <Link
              href="/pranajiva/orders"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 px-6 py-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Panel title="Where it is">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.chip}`}>
                {status.label}
              </span>
              <p className="text-xs text-slate-500">{status.blurb}</p>
            </div>
            <Rail order={order} />
          </Panel>

          <Panel title="What was ordered">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="pb-2 font-semibold">Item</th>
                  <th className="pb-2 text-right font-semibold">Qty</th>
                  <th className="pb-2 text-right font-semibold">Each</th>
                  <th className="pb-2 text-right font-semibold">Line</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2 pr-2 font-medium text-slate-800">{i.title}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600">{i.qty}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600">
                      {rupees(i.unitPricePaise)}
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold text-slate-900">
                      {rupees(i.linePaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs">
              <Money label="Subtotal" value={order.subtotalPaise} />
              {order.deliveryPaise > 0 && <Money label="Delivery" value={order.deliveryPaise} />}
              {order.creditAppliedPaise > 0 && (
                <Money label="Wallet credit" value={-order.creditAppliedPaise} />
              )}
              <div className="flex items-baseline justify-between border-t border-slate-100 pt-1.5">
                <dt className="font-semibold text-slate-900">
                  {order.paymentMethod === "cod" ? "To collect" : "Paid"}
                </dt>
                <dd className="tabular-nums text-sm font-bold text-slate-900">
                  {rupees(order.payablePaise)}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel
            title="What the customer was told"
            hint="Every SMS this order caused. An empty list means no notification rule is switched on yet."
          >
            {order.messages.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nothing sent. Order messages are configured on the{" "}
                <Link href="/messaging" className="font-medium text-slate-700 underline">
                  messaging screen
                </Link>
                , and stay silent until a DLT-approved template is assigned and switched on.
              </p>
            ) : (
              <ul className="space-y-2">
                {order.messages.map((m, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs">
                    <span
                      className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        m.sentOk ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {m.sentOk ? "sent" : "failed"}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium text-slate-800">
                        {m.status.replace(/_/g, " ")}
                      </span>
                      <span className="text-slate-500">
                        {" "}
                        to {m.mobile} ·{" "}
                        {new Date(m.sentAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {m.templateLabel ? ` · ${m.templateLabel}` : ""}
                      </span>
                      {m.error && (
                        <span className="mt-0.5 block break-words text-[11px] text-rose-700">
                          {m.error}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Deliver to">
            <address className="space-y-0.5 text-xs not-italic leading-relaxed text-slate-700">
              <p className="font-semibold text-slate-900">{order.customerName}</p>
              {order.customerMobile && <p className="font-mono">{order.customerMobile}</p>}
              {[
                order.address.address_1,
                order.address.address_2,
                order.address.city,
                [order.address.province, order.address.postal_code].filter(Boolean).join(" "),
              ]
                .filter(Boolean)
                .map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
            </address>
          </Panel>

          <Panel title="Payment">
            <dl className="space-y-1.5 text-xs">
              <Pair label="Status" value={<span className={`font-semibold ${payment.tone}`}>{payment.label}</span>} />
              <Pair label="Method" value={order.paymentMethod === "cod" ? "Cash on delivery" : "Razorpay"} />
              {order.razorpayPaymentId && (
                <Pair
                  label="Payment id"
                  value={<span className="break-all font-mono text-[11px]">{order.razorpayPaymentId}</span>}
                />
              )}
              {order.razorpayOrderId && (
                <Pair
                  label="Razorpay order"
                  value={<span className="break-all font-mono text-[11px]">{order.razorpayOrderId}</span>}
                />
              )}
            </dl>
            {order.paymentMethod === "cod" && order.paymentStatus === "awaiting" && (
              <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-900">
                Marking this delivered also records {rupees(order.payablePaise)} as collected. Do it
                when the money is in hand, not when the parcel leaves.
              </p>
            )}
          </Panel>

          <Panel title="History" hint="Append-only. Nothing here can be edited or removed.">
            <ol className="space-y-2.5">
              {order.events.map((e, idx) => (
                <li key={idx} className="border-l-2 border-slate-200 pl-2.5 text-xs">
                  <p className="font-medium text-slate-800">
                    {STATUS[e.status as keyof typeof STATUS]?.label ?? e.status.replace(/_/g, " ")}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {new Date(e.at).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {e.actor === "system" ? "system" : (names[e.actor] ?? "an ops user")}
                  </p>
                  {e.note && <p className="mt-0.5 text-[11px] text-slate-600">{e.note}</p>}
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

/**
 * The three steps, with the one it has reached filled in.
 *
 * Built from PRANAJIVA_RAIL rather than from the history, so a parcel that was moved through an
 * unexpected status still draws a readable line. A cancelled order gets no rail at all — there is
 * no progress to show and a half-filled track would suggest it is still coming.
 */
function Rail({ order }: { order: OrderDetail }) {
  if (order.status === "cancelled") return null

  const reached = new Set(order.events.map((e) => e.status))
  const atIndex = PRANAJIVA_RAIL.indexOf(order.status as (typeof PRANAJIVA_RAIL)[number])

  return (
    <ol className="mt-3 flex items-center gap-1.5">
      {PRANAJIVA_RAIL.map((step, i) => {
        const done = reached.has(step) || (atIndex >= 0 && i <= atIndex)
        return (
          <li key={step} className="flex flex-1 items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <div className={`h-1.5 rounded-full ${done ? "bg-emerald-500" : "bg-slate-200"}`} />
              <p
                className={`mt-1 truncate text-[11px] font-medium ${
                  done ? "text-slate-700" : "text-slate-400"
                }`}
              >
                {STATUS[step].label}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Pair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-slate-800">{value}</dd>
    </div>
  )
}

/** A deduction reads as −₹600, not ₹-600 — the minus belongs to the amount, not inside it. */
function Money({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="tabular-nums text-slate-700">
        {value < 0 ? `−${rupees(-value)}` : rupees(value)}
      </dd>
    </div>
  )
}
