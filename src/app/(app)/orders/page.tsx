import { getDbPool } from "@/lib/db"
import { assignBakerFromOrder } from "./actions"

export const dynamic = "force-dynamic"

/**
 * Orders, with the baker attribution Medusa admin cannot show.
 *
 * Medusa knows the order and the money and knows nothing about which bakery is meant to be making
 * it — that link lives in two places outside Medusa's world: `line_item.metadata->>'bakerId'` for
 * AI Studio cakes, and baker_products for Ready to Order. Joining them is the only way to answer
 * "who is late", which is the question this page exists for.
 *
 * ── The three ways a cake reaches this page ─────────────────────────────────────────────────────
 *
 *   1. Designed, baker chosen, contacted directly       never reaches CrossFriend, so no order
 *                                                        exists and nothing appears here. Correct.
 *   2. Designed, baker chosen, ordered via CrossFriend   metadata.bakerId is set at add-to-cart, so
 *                                                        it lands with its baker already attached.
 *   3. Designed, ordered via CrossFriend, no baker       metadata carries needsBakerAssignment:true
 *                                                        and no bakerId. It appears here under
 *                                                        "Needs a baker" and nowhere else until ops
 *                                                        assigns one — at which point it shows up in
 *                                                        that baker's portal on their next load.
 *
 * Nothing is copied between systems for (3). Membership is derived from line_item metadata on every
 * read, so assigning a baker IS the act of handing the order over; there is no second write that
 * could fail and leave the two disagreeing.
 *
 * ── Why "no baker" and "needs a baker" are different ────────────────────────────────────────────
 * An order can have no baker for two unrelated reasons: it is a cake still waiting to be assigned,
 * or it contains nothing a baker makes (candles, gift wrap). The first needs someone to act today;
 * the second is finished. Collapsing them into one count would bury the urgent case inside the
 * harmless one, so they are counted separately and only the first is offered as a filter.
 *
 * Reads the database directly rather than the backend, like every other OPS page.
 */

type Status = "new" | "accepted" | "baking" | "ready" | "delivered" | "rejected"

const STATUS: Record<Status, { label: string; chip: string }> = {
  new: { label: "New", chip: "bg-amber-100 text-amber-900" },
  accepted: { label: "Accepted", chip: "bg-sky-100 text-sky-800" },
  baking: { label: "Baking", chip: "bg-violet-100 text-violet-800" },
  ready: { label: "Ready", chip: "bg-emerald-100 text-emerald-800" },
  delivered: { label: "Delivered", chip: "bg-slate-100 text-slate-600" },
  rejected: { label: "Declined", chip: "bg-red-100 text-red-700" },
}

const PAYMENT_TONE: Record<string, string> = {
  captured: "text-emerald-700",
  awaiting: "text-amber-700",
  not_paid: "text-red-700",
  refunded: "text-slate-500",
}

interface BakerOnOrder {
  bakerId: string
  bakerName: string
  status: Status
  itemCount: number
}

/** A cake the customer left to CrossFriend to place — flow 3, waiting on ops. */
interface AwaitingItem {
  lineItemId: string
  title: string
}

interface OrderRow {
  id: string
  display_id: number
  created_at: string
  email: string | null
  customer_name: string | null
  city: string | null
  postal_code: string | null
  payment_status: string
  order_total: number
  add_on_count: number
  bakers: BakerOnOrder[]
  awaiting: AwaitingItem[]
}

/** Terminal for the baker — nothing on this order is waiting on them any more. */
const CLOSED: Status[] = ["delivered", "rejected"]

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

/** How long it has been sitting. The number ops actually acts on. */
function age(iso: string): { text: string; stale: boolean } {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return { text: `${mins}m`, stale: mins > 30 }
  const hours = Math.round(mins / 60)
  if (hours < 24) return { text: `${hours}h`, stale: hours > 2 }
  const days = Math.round(hours / 24)
  return { text: `${days}d`, stale: true }
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter } = await searchParams
  const view = filter === "open" || filter === "unassigned" ? filter : "all"
  const db = getDbPool()

  // NULLIF guards the metadata path: an empty-string bakerId is not a baker and would otherwise be
  // cast to uuid and fail the whole statement rather than falling through to product ownership.
  const BAKER_OF = `COALESCE(NULLIF(li.metadata->>'bakerId','')::uuid, bp.baker_id)`

  const { rows } = await db.query(
    `WITH attributed AS (
       SELECT li.order_id, li.id AS line_item_id, li.title,
              li.unit_price * li.quantity AS line_total,
              ${BAKER_OF} AS baker_id,
              -- Set by the storefront when the customer picked "Order via CrossFriend" instead of
              -- naming a bakery. This is what separates "waiting on us" from "nobody bakes candles".
              COALESCE((li.metadata->>'needsBakerAssignment')::boolean, false) AS needs_assignment
         FROM public.line_item li
         LEFT JOIN public.product_variant pv ON pv.id = li.variant_id
         LEFT JOIN baker_network.baker_products bp ON bp.medusa_product_id = pv.product_id
        WHERE li.order_id IS NOT NULL
     )
     SELECT o.id, o.display_id, o.created_at, o.email,
            o.payment_status, o.fulfillment_status,
            addr.city, addr.postal_code,
            NULLIF(TRIM(COALESCE(addr.first_name,'') || ' ' || COALESCE(addr.last_name,'')), '') AS customer_name,
            (SELECT COALESCE(SUM(a.line_total),0)/100.0 FROM attributed a WHERE a.order_id = o.id) AS order_total,
            -- Split deliberately: an item with no baker is either a cake still waiting to be
            -- assigned, or something nobody bakes. Only the first is work.
            (SELECT COUNT(*) FROM attributed a
              WHERE a.order_id = o.id AND a.baker_id IS NULL AND NOT a.needs_assignment)::int AS add_on_count,
            COALESCE((
              SELECT json_agg(json_build_object('lineItemId', a.line_item_id, 'title', a.title)
                              ORDER BY a.title)
                FROM attributed a
               WHERE a.order_id = o.id AND a.baker_id IS NULL AND a.needs_assignment
            ), '[]'::json) AS awaiting,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'bakerId', x.baker_id, 'bakerName', b.name,
                       'status', COALESCE(bo.status,'new'), 'itemCount', x.n
                     ) ORDER BY b.name)
                FROM (SELECT a.baker_id, COUNT(*)::int AS n
                        FROM attributed a
                       WHERE a.order_id = o.id AND a.baker_id IS NOT NULL
                       GROUP BY a.baker_id) x
                JOIN baker_network.bakers b ON b.id = x.baker_id
                LEFT JOIN baker_network.baker_orders bo
                       ON bo.order_id = o.id AND bo.baker_id = x.baker_id
            ), '[]'::json) AS bakers
       FROM public."order" o
       LEFT JOIN public.address addr ON addr.id = o.shipping_address_id
      ORDER BY o.created_at DESC
      LIMIT 200`
  )

  // Mapped field by field rather than spread: `rows` is untyped, and spreading it widened `bakers`
  // back to `any`, which silently turned every status lookup below into an unchecked index.
  const all: OrderRow[] = rows.map((r) => ({
    id: r.id,
    display_id: r.display_id,
    created_at: r.created_at,
    email: r.email,
    customer_name: r.customer_name,
    city: r.city,
    postal_code: r.postal_code,
    payment_status: r.payment_status,
    order_total: Number(r.order_total),
    add_on_count: r.add_on_count,
    bakers: (r.bakers ?? []) as BakerOnOrder[],
    awaiting: (r.awaiting ?? []) as AwaitingItem[],
  }))

  // The bakers ops may hand a cake to. Same rule as the assignment queue: either badge counts, since
  // a Blue Tick bakery with its own store is as legitimate a match as a Trust Badge partner.
  const bakerOptions = (
    await db.query<{ id: string; name: string; city: string | null }>(
      `SELECT id, name, city FROM baker_network.bakers
        WHERE (trust_badge OR blue_tick) AND is_active
        ORDER BY name`
    )
  ).rows

  const orders =
    view === "open"
      ? all.filter((o) => o.bakers.some((b) => !CLOSED.includes(b.status)))
      : view === "unassigned"
        ? all.filter((o) => o.awaiting.length > 0)
        : all

  const counts = {
    all: all.length,
    open: all.filter((o) => o.bakers.some((b) => !CLOSED.includes(b.status))).length,
    unassigned: all.filter((o) => o.awaiting.length > 0).length,
  }

  const tab = (key: string, label: string, n: number) => (
    <a
      key={key}
      href={key === "all" ? "/orders" : `/orders?filter=${key}`}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
        view === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label} <span className="tabular-nums opacity-70">{n}</span>
    </a>
  )

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Orders</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Every order with the bakery responsible for it — the mapping Medusa admin doesn&apos;t
          have. Money, refunds and shipping labels still live in Medusa admin.
        </p>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {tab("all", "All", counts.all)}
          {tab("open", "In progress", counts.open)}
          {/* Flow 3: the customer left the choice to CrossFriend. Nothing happens on these until
              someone here picks a bakery, so this is the one tab that represents work. */}
          {counts.unassigned > 0 && tab("unassigned", "Needs a baker", counts.unassigned)}
        </div>

        {orders.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            {all.length === 0 ? "No orders yet." : "Nothing matches this filter."}
          </p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const a = age(o.created_at)
              const openBaker = o.bakers.some(
                (b) => !CLOSED.includes(b.status)
              )

              return (
                <article
                  key={o.id}
                  // An order waiting on us is outlined. It is the only card on this page where the
                  // next move belongs to ops rather than to a baker.
                  className={`rounded-xl border bg-white p-4 ${
                    o.awaiting.length > 0 ? "border-amber-300" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">
                        #{o.display_id}
                        <span className="ml-2 font-normal text-slate-500">
                          {o.customer_name || o.email || "—"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {new Date(o.created_at).toLocaleString("en-IN")}
                        {o.city ? ` · ${o.city}` : ""}
                        {o.postal_code ? ` ${o.postal_code}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold tabular-nums text-slate-900">
                        {inr(o.order_total)}
                      </span>
                      <span
                        className={`font-semibold ${PAYMENT_TONE[o.payment_status] ?? "text-slate-500"}`}
                      >
                        {o.payment_status.replace(/_/g, " ")}
                      </span>
                      {/* Only meaningful while something is still open — a delivered order being
                          "3d" old is just its age, not a problem. */}
                      <span
                        className={`rounded px-1.5 py-0.5 font-bold tabular-nums ${
                          openBaker && a.stale
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                        title="Time since the order was placed"
                      >
                        {a.text}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    {o.bakers.length === 0 && o.awaiting.length === 0 ? (
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                        Nothing here needs a baker
                      </span>
                    ) : (
                      o.bakers.map((b) => (
                        <a
                          key={b.bakerId}
                          href={`/bakers/${b.bakerId}`}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50"
                        >
                          <span className="font-semibold text-slate-800">{b.bakerName}</span>
                          <span className={`rounded px-1.5 py-0.5 font-bold ${STATUS[b.status].chip}`}>
                            {STATUS[b.status].label}
                          </span>
                          <span className="text-slate-400">
                            {b.itemCount} item{b.itemCount === 1 ? "" : "s"}
                          </span>
                        </a>
                      ))
                    )}

                    {o.add_on_count > 0 && (
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                        + {o.add_on_count} add-on{o.add_on_count === 1 ? "" : "s"}
                      </span>
                    )}

                    {/* More than one baker means a cart rule was never enforced. The pipeline shows
                        it rather than hiding it, because seeing it is the point. */}
                    {o.bakers.length > 1 && (
                      <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                        {o.bakers.length} bakeries in one order — check this
                      </span>
                    )}
                  </div>

                  {/* Flow 3. The customer designed a cake and left the choice of bakery to us, so
                      nothing moves until someone picks one. Assigning here rather than sending ops
                      to a separate queue keeps the decision next to the things that inform it —
                      where it's going, when it was placed, what else is in the order.

                      One control per item, not per order: an order could in principle carry two
                      unassigned cakes, and they need not go to the same bakery. */}
                  {o.awaiting.length > 0 && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-bold text-amber-900">
                        Waiting for us to choose a bakery
                      </p>
                      <div className="mt-2 space-y-2">
                        {o.awaiting.map((item) => (
                          <form
                            key={item.lineItemId}
                            action={assignBakerFromOrder}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input type="hidden" name="lineItemId" value={item.lineItemId} />
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">
                              {item.title}
                            </span>
                            <select
                              name="bakerId"
                              required
                              defaultValue=""
                              aria-label={`Choose a bakery for ${item.title}`}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                            >
                              <option value="" disabled>
                                Choose a bakery
                              </option>
                              {bakerOptions.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                  {b.city ? ` — ${b.city}` : ""}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              Assign
                            </button>
                          </form>
                        ))}
                      </div>
                      {bakerOptions.length === 0 && (
                        <p className="mt-2 text-xs text-amber-800">
                          No bakery is eligible yet — a baker needs a Blue Tick or Trust Badge and
                          must be active before they can be given an order.
                        </p>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
