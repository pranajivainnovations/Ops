import { getDbPool } from "@/lib/db"

/**
 * PranaJiva's orders, read straight from the pipeline that produces them.
 *
 * ── Why this is not the CrossFriend orders screen with a filter ───────────────────────────────
 * /orders/live shows both brands and organises them around the question "who is making this" — its
 * first group is "Needs a baker" and its loudest number counts orders nobody has been assigned.
 * PranaJiva has no bakers, so every one of its orders qualifies, and all eight of them have been
 * sitting at the top of that screen marked as needing something that does not exist.
 *
 * The question this screen answers instead is "what has to go out today", because that is the only
 * thing standing between a paid order and a delivered one when the goods are already on a shelf.
 *
 * ── Why it reads the database directly ────────────────────────────────────────────────────────
 * Like every other OPS screen. Reads are OPS's own business; the WRITES go through the backend,
 * where the transition rules and the append-only event live. See the actions file.
 */

/** What the storefront and the backend both call a status. */
export type OrderStatus =
  | "placed"
  | "accepted"
  | "making"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"

/**
 * The three steps a PranaJiva parcel actually has, and what each is called here.
 *
 * `accepted` and `making` are absent on purpose — they are CrossFriend's baker steps and the
 * backend's PranaJiva transition map cannot produce them. They are still handled in `STATUS` below,
 * because an order moved by hand before this screen existed can be sitting in one.
 */
export const PRANAJIVA_RAIL: OrderStatus[] = ["placed", "out_for_delivery", "delivered"]

export const STATUS: Record<OrderStatus, { label: string; chip: string; blurb: string }> = {
  placed: {
    label: "To dispatch",
    chip: "bg-amber-100 text-amber-900",
    blurb: "Ordered and waiting to be packed and sent.",
  },
  accepted: {
    label: "Accepted",
    chip: "bg-slate-100 text-slate-600",
    blurb: "A CrossFriend step. Nothing here produces it; move it on when you see it.",
  },
  making: {
    label: "Making",
    chip: "bg-slate-100 text-slate-600",
    blurb: "A CrossFriend step. Nothing here produces it; move it on when you see it.",
  },
  out_for_delivery: {
    label: "On the way",
    chip: "bg-sky-100 text-sky-800",
    blurb: "Sent. The customer has been told it is out for delivery.",
  },
  delivered: {
    label: "Delivered",
    chip: "bg-emerald-100 text-emerald-800",
    blurb: "Arrived. For a cash order this is also when the money was collected.",
  },
  cancelled: {
    label: "Cancelled",
    chip: "bg-rose-100 text-rose-700",
    blurb: "Cancelled. Anything the order earned has been taken back.",
  },
}

export const PAYMENT: Record<string, { label: string; tone: string }> = {
  paid: { label: "Paid", tone: "text-emerald-700" },
  awaiting: { label: "Awaiting", tone: "text-amber-700" },
  failed: { label: "Failed", tone: "text-rose-700" },
  refunded: { label: "Refunded", tone: "text-slate-500" },
}

/**
 * What the operator may do next, mirroring the backend's PranaJiva transition map.
 *
 * A copy, and deliberately a thin one: the backend refuses anything this disagrees with, so the
 * worst a drift here can do is hide a button or show one that comes back with a clear message. The
 * alternative — asking the backend what is allowed before drawing a row — would be a round trip per
 * order on a page built to be scanned.
 */
export function nextSteps(status: OrderStatus): OrderStatus[] {
  switch (status) {
    case "placed":
    case "accepted":
    case "making":
      return ["out_for_delivery", "cancelled"]
    case "out_for_delivery":
      return ["delivered", "cancelled"]
    default:
      return []
  }
}

export const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

export interface OrderListRow {
  id: string
  displayId: number
  status: OrderStatus
  paymentStatus: string
  paymentMethod: string | null
  payablePaise: number
  creditAppliedPaise: number
  createdAt: string
  customerName: string
  customerMobile: string | null
  city: string | null
  itemCount: number
  itemSummary: string
}

/**
 * The list, newest first.
 *
 * Items are summarised in SQL rather than fetched per row: the screen only needs a sentence like
 * "Neem Powder ×2, Tila Abhyanga Oil", and building that here keeps the whole page one statement.
 */
export async function listOrders(): Promise<OrderListRow[]> {
  const { rows } = await getDbPool().query(
    `SELECT o.id, o.display_id, o.status, o.payment_status, o.payment_method,
            o.payable_paise, o.credit_applied_paise, o.created_at,
            o.address, c.phone AS customer_phone,
            (SELECT count(*)::int FROM orders.order_items i WHERE i.order_id = o.id) AS item_count,
            COALESCE((
              SELECT string_agg(
                       i.title || CASE WHEN i.qty > 1 THEN ' ×' || i.qty ELSE '' END, ', '
                       ORDER BY i.title)
                FROM orders.order_items i WHERE i.order_id = o.id
            ), '') AS item_summary
       FROM orders.orders o
       LEFT JOIN public.customer c ON c.id = o.customer_id
      WHERE o.brand = 'pranajiva'
      ORDER BY o.created_at DESC
      LIMIT 300`
  )

  return rows.map(toListRow)
}

function toListRow(r: Record<string, any>): OrderListRow {
  const address = (r.address ?? {}) as Record<string, string>
  const name = [address.first_name, address.last_name].filter(Boolean).join(" ")

  return {
    id: r.id,
    displayId: r.display_id,
    status: r.status,
    paymentStatus: r.payment_status,
    paymentMethod: r.payment_method ?? null,
    payablePaise: r.payable_paise,
    creditAppliedPaise: r.credit_applied_paise,
    createdAt: r.created_at,
    /* Never blank: an order with no name on the address is still an order somebody has to send. */
    customerName: name || "No name given",
    customerMobile: address.phone ?? r.customer_phone ?? null,
    city: address.city ?? null,
    itemCount: r.item_count,
    itemSummary: r.item_summary,
  }
}

export interface OrderDetail extends OrderListRow {
  subtotalPaise: number
  deliveryPaise: number
  razorpayOrderId: string | null
  razorpayPaymentId: string | null
  address: Record<string, string>
  items: {
    id: string
    title: string
    qty: number
    unitPricePaise: number
    linePaise: number
    kind: string
  }[]
  events: { status: string; at: string; actor: string; note: string | null }[]
  /** Every SMS this order has caused, successes and refusals alike. */
  messages: {
    status: string
    mobile: string
    sentOk: boolean
    error: string | null
    sentAt: string
    templateLabel: string | null
  }[]
}

/**
 * One order, everything about it.
 *
 * Brand-scoped in the WHERE, so a CrossFriend order id typed into this URL is a 404 rather than a
 * cake rendered with PranaJiva's step names and PranaJiva's buttons.
 */
export async function getOrder(id: string): Promise<OrderDetail | null> {
  /* A malformed id would make the ::uuid cast throw rather than return nothing, and a bad URL is a
     not-found, not a server error. */
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null

  const { rows } = await getDbPool().query(
    `SELECT o.*, c.phone AS customer_phone,
            (SELECT count(*)::int FROM orders.order_items i WHERE i.order_id = o.id) AS item_count,
            COALESCE((
              SELECT string_agg(
                       i.title || CASE WHEN i.qty > 1 THEN ' ×' || i.qty ELSE '' END, ', '
                       ORDER BY i.title)
                FROM orders.order_items i WHERE i.order_id = o.id
            ), '') AS item_summary,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'id', i.id, 'title', i.title, 'qty', i.qty,
                       'unitPricePaise', i.unit_price_paise,
                       'linePaise', i.qty * i.unit_price_paise,
                       'kind', i.kind) ORDER BY i.title)
                FROM orders.order_items i WHERE i.order_id = o.id
            ), '[]'::json) AS items,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'status', e.status, 'at', e.at, 'actor', e.actor, 'note', e.note
                     ) ORDER BY e.at DESC, e.id)
                FROM orders.order_events e WHERE e.order_id = o.id
            ), '[]'::json) AS events,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'status', n.status, 'mobile', n.mobile, 'sentOk', n.sent_ok,
                       'error', n.error, 'sentAt', n.sent_at, 'templateLabel', t.label
                     ) ORDER BY n.sent_at DESC)
                FROM orders.notifications n
                LEFT JOIN crossfriend.sms_templates t ON t.id = n.template_id
               WHERE n.order_id = o.id
            ), '[]'::json) AS messages
       FROM orders.orders o
       LEFT JOIN public.customer c ON c.id = o.customer_id
      WHERE o.id = $1::uuid AND o.brand = 'pranajiva'`,
    [id]
  )

  const r = rows[0]
  if (!r) return null

  return {
    ...toListRow(r),
    subtotalPaise: r.subtotal_paise,
    deliveryPaise: r.delivery_paise,
    razorpayOrderId: r.razorpay_order_id ?? null,
    razorpayPaymentId: r.razorpay_payment_id ?? null,
    address: (r.address ?? {}) as Record<string, string>,
    items: r.items ?? [],
    events: r.events ?? [],
    messages: r.messages ?? [],
  }
}

/**
 * Who moved each order, resolved in one go.
 *
 * `order_events.actor` holds an ops user id or the literal 'system', because the event table is
 * written by the backend which has no business joining to OPS accounts. Turning those ids into
 * names is this screen's job, and doing it as one lookup beats a join that would have to be
 * repeated in every query above.
 */
export async function opsUserNames(ids: string[]): Promise<Record<string, string>> {
  const uuids = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  if (!uuids.length) return {}

  const { rows } = await getDbPool().query(
    `SELECT id, COALESCE(NULLIF(name, ''), email) AS who
       FROM baker_network.ops_users WHERE id = ANY($1::uuid[])`,
    [uuids]
  )

  return Object.fromEntries(rows.map((r) => [r.id, r.who as string]))
}
