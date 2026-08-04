import { getDbPool } from "@/lib/db"
import BakerTabs from "../baker-tabs"
import AssignmentList from "./assignment-list"

export const dynamic = "force-dynamic"

export default async function AssignmentsPage() {
  const db = getDbPool()

  const pendingRes = await db.query(
    `SELECT
       li.id AS line_item_id,
       li.title,
       li.unit_price,
       o.display_id,
       o.email,
       o.created_at,
       a.postal_code,
       a.city
     FROM line_item li
     JOIN "order" o ON o.id = li.order_id
     LEFT JOIN address a ON a.id = o.shipping_address_id
     WHERE li.metadata->>'needsBakerAssignment' = 'true'
     ORDER BY o.created_at DESC`
  )

  const bakersRes = await db.query(
    `SELECT id, name, city, state, pincode, phone, whatsapp_number
     FROM baker_network.bakers
     WHERE trust_badge = true AND is_active = true
     ORDER BY name`
  )

  const pending = pendingRes.rows.map((r) => ({
    lineItemId: r.line_item_id as string,
    title: r.title as string,
    unitPrice: Number(r.unit_price) / 100,
    orderDisplayId: r.display_id as number,
    email: r.email as string,
    createdAt: (r.created_at as Date).toISOString(),
    postalCode: (r.postal_code as string) ?? null,
    city: (r.city as string) ?? null,
  }))

  const bakers = bakersRes.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    city: (r.city as string) ?? null,
    state: (r.state as string) ?? null,
    pincode: (r.pincode as string) ?? null,
  }))

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Bakers</h1>
      </header>
      <BakerTabs />
      <div className="mx-auto max-w-4xl px-6 py-6">
        <p className="mb-4 text-xs text-slate-500">
          Orders placed via &quot;Order via CrossFriend&quot; — the customer let us pick instead of
          choosing a specific partner. Assign one below; this is manual for now, but this is exactly
          where automated matching will plug in later.
        </p>
        <AssignmentList pending={pending} bakers={bakers} />
      </div>
    </main>
  )
}
