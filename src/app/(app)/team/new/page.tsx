import { createOpsUserAction } from "../actions"

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"

export default async function NewTeamMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Add a team member</h1>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="max-w-md">
          <form action={createOpsUserAction} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Name</label>
              <input name="name" required className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Email</label>
              <input name="email" type="email" required className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Password</label>
              <input name="password" type="password" required minLength={8} className={`mt-1 ${inputClass}`} />
              <p className="mt-1 text-[11px] text-slate-400">At least 8 characters. They can&apos;t reset it themselves yet — re-run the seed script to change it later.</p>
            </div>
            {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Add team member
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
