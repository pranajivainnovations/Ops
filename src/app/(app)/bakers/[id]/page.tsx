import { notFound } from "next/navigation"
import { getDbPool } from "@/lib/db"
import BakerForm from "../baker-form"
import { updateBakerAction } from "../actions"

export const dynamic = "force-dynamic"

export default async function EditBakerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDbPool()
  const result = await db.query(`SELECT * FROM baker_network.bakers WHERE id = $1`, [id])
  const baker = result.rows[0]
  if (!baker) notFound()

  const boundUpdate = updateBakerAction.bind(null, id)

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Edit {baker.name}</h1>
      </header>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <BakerForm action={boundUpdate} submitLabel="Save changes" defaultValues={baker} />
      </div>
    </main>
  )
}
