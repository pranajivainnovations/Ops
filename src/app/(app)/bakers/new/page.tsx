import BakerForm from "../baker-form"
import { createBakerAction } from "../actions"

export default function NewBakerPage() {
  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Add a baker</h1>
      </header>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <BakerForm action={createBakerAction} submitLabel="Add baker" />
      </div>
    </main>
  )
}
