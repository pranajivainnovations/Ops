"use client"

import { useState, useTransition } from "react"

import { assignOrderToBaker, moveOrder } from "./actions"

/**
 * One order, with the two decisions ops actually makes on it.
 *
 * ── Why only the next step is offered ──────────────────────────────────────────────────────────
 * The backend allows one step forward, or cancel. A dropdown of all six statuses would offer five
 * choices that get refused, and the refusal would arrive after the click. Showing the one move that
 * is legal makes the rule visible instead of making it a surprise — and the rule exists because the
 * customer's order page draws a progress timeline from these same rows.
 *
 * ── Why the spec is shown for a studio cake ────────────────────────────────────────────────────
 * It is what the baker has to make. Weight and flavour on the card mean ops can answer "can you do
 * this one on Friday" on the phone without opening anything else.
 */

export interface BakerOption {
  id: string
  name: string
  city: string | null
}

export interface LiveOrder {
  id: string
  displayId: number
  brand: string
  customerMobile: string | null
  subtotalPaise: number
  creditAppliedPaise: number
  payablePaise: number
  paymentStatus: string
  status: string
  address: Record<string, string>
  createdAt: string
  items: {
    id: string
    kind: string
    title: string
    qty: number
    linePaise: number
    spec: Record<string, unknown> | null
    bakerName: string | null
  }[]
  events: { status: string; at: string; note: string | null }[]
  unassigned: number
}

const NEXT_STEP: Record<string, { status: string; label: string } | null> = {
  placed: { status: "accepted", label: "Baker has accepted" },
  accepted: { status: "making", label: "Started making" },
  making: { status: "out_for_delivery", label: "Out for delivery" },
  out_for_delivery: { status: "delivered", label: "Delivered" },
  delivered: null,
  cancelled: null,
}

const STATUS_STYLE: Record<string, string> = {
  placed: "bg-amber-100 text-amber-900",
  accepted: "bg-sky-100 text-sky-900",
  making: "bg-indigo-100 text-indigo-900",
  out_for_delivery: "bg-violet-100 text-violet-900",
  delivered: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-slate-200 text-slate-600",
}

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

const readable = (s: string) => s.replace(/_/g, " ")

export default function OrderCard({
  order,
  bakers,
}: {
  order: LiveOrder
  bakers: BakerOption[]
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [bakerId, setBakerId] = useState("")

  const next = NEXT_STEP[order.status]
  const closed = order.status === "delivered" || order.status === "cancelled"

  const run = (fn: () => Promise<{ error: string | null }>) =>
    start(async () => {
      setError(null)
      const { error } = await fn()
      if (error) setError(error)
    })

  const addr = order.address ?? {}
  const name = [addr.first_name, addr.last_name].filter(Boolean).join(" ")

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
              #{order.displayId}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                STATUS_STYLE[order.status] ?? "bg-slate-100 text-slate-700"
              }`}
            >
              {readable(order.status)}
            </span>
            {/* Payment is a separate fact from the order's progress, and is shown as one. */}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                order.paymentStatus === "paid"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {order.paymentStatus === "paid" ? "paid" : `payment ${order.paymentStatus}`}
            </span>
            {order.brand !== "crossfriend" && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {order.brand}
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-slate-700">
            {name || "No name given"}
            {order.customerMobile && (
              <>
                {" · "}
                <a
                  href={`tel:${order.customerMobile}`}
                  className="font-mono tabular-nums text-slate-900 underline"
                >
                  {order.customerMobile}
                </a>
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {[addr.address_1, addr.city, addr.postal_code].filter(Boolean).join(", ") ||
              "No address"}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-slate-900">
            {rupees(order.payablePaise)}
          </p>
          {order.creditAppliedPaise > 0 && (
            <p className="text-xs tabular-nums text-violet-700">
              −{rupees(order.creditAppliedPaise)} credit
            </p>
          )}
          <p className="mt-0.5 text-xs text-slate-400">
            {new Date(order.createdAt).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="min-w-0 text-slate-700">
              {i.qty > 1 && <span className="tabular-nums">{i.qty}× </span>}
              {i.title}
              {i.kind === "studio_design" && i.spec && (
                <span className="ml-1 text-xs text-slate-500">
                  {[i.spec.weight, i.spec.flavor].filter(Boolean).join(", ")}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              {i.bakerName ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {i.bakerName}
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  no baker
                </span>
              )}
              <span className="tabular-nums text-slate-600">{rupees(i.linePaise)}</span>
            </span>
          </li>
        ))}
      </ul>

      {!closed && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {order.unassigned > 0 ? (
            <>
              <select
                value={bakerId}
                onChange={(e) => setBakerId(e.target.value)}
                disabled={pending || bakers.length === 0}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                <option value="">Choose a baker…</option>
                {bakers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.city ? ` — ${b.city}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={pending || !bakerId}
                onClick={() => run(() => assignOrderToBaker(order.id, bakerId))}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {pending ? "Assigning…" : "Assign"}
              </button>
            </>
          ) : (
            next && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => moveOrder(order.id, next.status))}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "Saving…" : next.label}
              </button>
            )
          )}

          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => moveOrder(order.id, "cancelled"))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-50"
          >
            Cancel order
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {order.events.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-slate-500">
            History ({order.events.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {order.events.map((e, n) => (
              <li key={n} className="flex gap-2">
                <span className="tabular-nums text-slate-400">
                  {new Date(e.at).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span>
                  {readable(e.status)}
                  {e.note ? ` — ${e.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  )
}
