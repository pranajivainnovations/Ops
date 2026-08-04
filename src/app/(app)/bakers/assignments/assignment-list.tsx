"use client"

import { useState, useTransition } from "react"
import { assignBaker } from "./actions"

interface PendingOrder {
  lineItemId: string
  title: string
  unitPrice: number
  orderDisplayId: number
  email: string
  createdAt: string
  postalCode: string | null
  city: string | null
}

interface Baker {
  id: string
  name: string
  city: string | null
  state: string | null
  pincode: string | null
}

interface Props {
  pending: PendingOrder[]
  bakers: Baker[]
}

function Row({ order, bakers }: { order: PendingOrder; bakers: Baker[] }) {
  const [bakerId, setBakerId] = useState("")
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAssign = () => {
    if (!bakerId) return
    setError(null)
    startTransition(async () => {
      const res = await assignBaker(order.lineItemId, bakerId)
      if ("error" in res) {
        setError(res.error)
      } else {
        setDone(true)
      }
    })
  }

  if (done) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        <span>✅ Order #{order.orderDisplayId} assigned</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">
            Order #{order.orderDisplayId} · ₹{order.unitPrice.toLocaleString("en-IN")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{order.title}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {order.email} · {[order.city, order.postalCode].filter(Boolean).join(" · ") || "no address on file"} ·{" "}
            {new Date(order.createdAt).toLocaleString("en-IN")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <select
          value={bakerId}
          onChange={(e) => setBakerId(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="">Select a partner baker…</option>
          {bakers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {b.city ? ` — ${b.city}` : ""}
              {b.pincode ? ` (${b.pincode})` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAssign}
          disabled={!bakerId || isPending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? "Assigning…" : "Assign"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}

export default function AssignmentList({ pending, bakers }: Props) {
  if (pending.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white py-10 text-center">
        <p className="text-sm font-medium text-slate-600">No orders waiting for a baker</p>
        <p className="mt-1 text-xs text-slate-400">Every &quot;Order via CrossFriend&quot; order gets picked up here.</p>
      </div>
    )
  }

  if (bakers.length === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        No active partner bakers (trust badge) to assign — add or activate one under All Bakers first.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {pending.map((order) => (
        <Row key={order.lineItemId} order={order} bakers={bakers} />
      ))}
    </div>
  )
}
