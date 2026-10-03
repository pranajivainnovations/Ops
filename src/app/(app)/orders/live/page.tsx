import Link from "next/link"

import { getDbPool } from "@/lib/db"
import OrderCard, { type LiveOrder, type BakerOption } from "./order-card"

export const dynamic = "force-dynamic"

/**
 * Orders from the new pipeline — the ones the rebuilt checkout actually produces.
 *
 * ── Why this screen had to be built ────────────────────────────────────────────────────────────
 * /orders queries public."order", which is Medusa's table. The checkout was moved onto
 * orders.orders, so from the day that shipped every real order landed somewhere no screen looked.
 * Customers could place orders; nobody could see them, assign them or move them. The pipeline
 * worked and the business could not run it.
 *
 * ── Why unassigned orders sort to the top ──────────────────────────────────────────────────────
 * An order with no baker is the only kind where nothing is happening and the clock is running. Date
 * order would bury today's unmade cake under last week's delivered ones; this puts the thing that
 * needs a person first, and the rest in the order it arrived.
 *
 * ── Why payment is shown but never blocks ──────────────────────────────────────────────────────
 * A UPI collect can settle minutes after the order exists, so an order reading `awaiting` is often
 * simply early rather than unpaid. Ops gets the fact and makes the call; the backend does not refuse
 * the move. What it does refuse is accepting an order nobody is making — see the service.
 */

interface Row {
  id: string
  display_id: number
  brand: string
  customer_mobile: string | null
  subtotal_paise: number
  credit_applied_paise: number
  payable_paise: number
  payment_status: string
  status: string
  address: Record<string, string> | null
  created_at: string
  items: LiveOrder["items"] | null
  events: LiveOrder["events"] | null
}

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export default async function LiveOrdersPage() {
  const db = getDbPool()

  /**
   * One statement, items and history included.
   *
   * The screen cannot decide anything without knowing what is in the order and who has it, so
   * fetching those per row would be a round trip per order on a page that exists to be scanned.
   * baker_id is varchar on the item while bakers.id is uuid — the uuid is cast, not the column.
   */
  const { rows } = await db.query<Row>(
    `SELECT o.id, o.display_id, o.brand,
            c.phone AS customer_mobile,
            o.subtotal_paise, o.credit_applied_paise, o.payable_paise,
            o.payment_status, o.status, o.address, o.created_at,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'id', i.id, 'kind', i.kind, 'title', i.title, 'qty', i.qty,
                       'linePaise', i.qty * i.unit_price_paise,
                       'spec', i.spec, 'bakerName', b.name
                     ) ORDER BY i.id)
                FROM orders.order_items i
                LEFT JOIN baker_network.bakers b ON b.id::text = i.baker_id
               WHERE i.order_id = o.id
            ), '[]'::json) AS items,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'status', e.status, 'at', e.at, 'note', e.note
                     ) ORDER BY e.at DESC)
                FROM orders.order_events e WHERE e.order_id = o.id
            ), '[]'::json) AS events
       FROM orders.orders o
       LEFT JOIN public.customer c ON c.id = o.customer_id
      ORDER BY o.created_at DESC
      LIMIT 200`
  )

  const orders: LiveOrder[] = rows.map((r) => {
    const items = r.items ?? []
    return {
      id: r.id,
      displayId: r.display_id,
      brand: r.brand,
      customerMobile: r.customer_mobile,
      subtotalPaise: r.subtotal_paise,
      creditAppliedPaise: r.credit_applied_paise,
      payablePaise: r.payable_paise,
      paymentStatus: r.payment_status,
      status: r.status,
      address: r.address ?? {},
      createdAt: r.created_at,
      items,
      events: r.events ?? [],
      unassigned: items.filter((i) => !i.bakerName).length,
    }
  })

  /* The same rule the storefront's finder applies, so ops cannot hand work to a bakery a customer
     would never have been offered. */
  const bakers = (
    await db.query<BakerOption>(
      `SELECT id, name, city FROM baker_network.bakers
        WHERE is_active AND status = 'onboarded' ORDER BY name`
    )
  ).rows

  const live = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled")
  const needsBaker = live.filter((o) => o.unassigned > 0)
  const inFlight = live.filter((o) => o.unassigned === 0)
  const done = orders.filter((o) => o.status === "delivered" || o.status === "cancelled")

  const takings = orders
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + o.payablePaise, 0)

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-lg font-semibold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Everything placed through the current checkout. Assign a baker, then move the order as it
            progresses — the customer sees each step on their own order page.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Orders placed before the pipeline changed live on the{" "}
            <Link href="/orders" className="font-medium text-slate-700 underline">
              legacy orders screen
            </Link>
            .
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <section className="grid gap-3 sm:grid-cols-4">
          <Stat label="Needs a baker" value={String(needsBaker.length)} tone={needsBaker.length ? "warn" : "plain"} />
          <Stat label="In progress" value={String(inFlight.length)} />
          <Stat label="Completed" value={String(done.length)} />
          <Stat label="Paid, all time" value={rupees(takings)} />
        </section>

        {bakers.length === 0 && (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No baker is onboarded and active, so nothing can be assigned. A baker has to reach{" "}
            <span className="font-mono text-xs">onboarded</span> on the{" "}
            <Link href="/bakers" className="font-medium underline">
              bakers screen
            </Link>{" "}
            before they can be given work — the same rule the storefront&rsquo;s finder applies.
          </p>
        )}

        <Group
          title="Needs a baker"
          hint="Nobody is making these yet. The customer has been told we are matching them with a baker."
          count={needsBaker.length}
          urgent
        >
          {needsBaker.map((o) => (
            <OrderCard key={o.id} order={o} bakers={bakers} />
          ))}
        </Group>

        <Group title="In progress" count={inFlight.length}>
          {inFlight.map((o) => (
            <OrderCard key={o.id} order={o} bakers={bakers} />
          ))}
        </Group>

        <Group title="Completed and cancelled" count={done.length}>
          {done.map((o) => (
            <OrderCard key={o.id} order={o} bakers={bakers} />
          ))}
        </Group>

        {orders.length === 0 && (
          <p className="mt-8 rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            No orders yet on this pipeline.
          </p>
        )}
      </div>
    </main>
  )
}

function Stat({
  label,
  value,
  tone = "plain",
}: {
  label: string
  value: string
  tone?: "plain" | "warn"
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        tone === "warn" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className={`text-xs ${tone === "warn" ? "text-amber-800" : "text-slate-500"}`}>{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          tone === "warn" ? "text-amber-900" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function Group({
  title,
  hint,
  count,
  urgent,
  children,
}: {
  title: string
  hint?: string
  count: number
  urgent?: boolean
  children: React.ReactNode
}) {
  if (count === 0) return null

  return (
    <section className="mt-8">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold text-slate-900">
        {title}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
            urgent ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-700"
          }`}
        >
          {count}
        </span>
      </h2>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}
