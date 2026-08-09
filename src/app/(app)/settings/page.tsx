import { getDbPool } from "@/lib/db"
import { saveSettings } from "./actions"
import { SETTING_GROUPS } from "./fields"

export const dynamic = "force-dynamic"

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"

const fmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
})

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { error, saved } = await searchParams

  const db = getDbPool()
  const result = await db.query<{ key: string; value: string; updated_at: string; who: string | null }>(
    `SELECT s.key, s.value, s.updated_at, u.name AS who
       FROM crossfriend.site_settings s
       LEFT JOIN baker_network.ops_users u ON u.id = s.updated_by`
  )

  const values: Record<string, string> = {}
  const meta: Record<string, { updated_at: string; who: string | null }> = {}
  for (const row of result.rows) {
    values[row.key] = row.value ?? ""
    meta[row.key] = { updated_at: row.updated_at, who: row.who }
  }

  const lastTouched = result.rows
    .map((r) => r.updated_at)
    .sort()
    .at(-1)

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Site settings</h1>
        <p className="mt-1 text-xs text-slate-500">
          Contact details and social links shown on the public storefront.{" "}
          {lastTouched && <>Last changed {fmt.format(new Date(lastTouched))}.</>}
        </p>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {error && (
          <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 ring-1 ring-rose-200">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
            Saved. The storefront picks this up within a minute — it caches these values so it does
            not query the backend on every page view.
          </p>
        )}

        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
          <strong>Everything on this page is public.</strong> These values are printed on the
          website and served by an unauthenticated API, so never put anything here that should not
          be seen by a customer.
        </p>

        <form action={saveSettings} className="flex flex-col gap-6">
          {SETTING_GROUPS.map((group) => (
            <section key={group.title} className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold text-slate-900">{group.title}</h2>
              {group.blurb && (
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{group.blurb}</p>
              )}

              <div className="mt-4 flex flex-col gap-4">
                {group.fields.map((field) => {
                  const touched = meta[field.key]
                  return (
                    <div key={field.key}>
                      <label
                        className="mb-1 block text-xs font-semibold text-slate-600"
                        htmlFor={field.key}
                      >
                        {field.label}
                      </label>
                      <input
                        id={field.key}
                        name={field.key}
                        defaultValue={values[field.key] ?? ""}
                        placeholder={field.placeholder}
                        className={inputClass}
                        autoComplete="off"
                      />
                      {field.help && (
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{field.help}</p>
                      )}
                      {touched?.who && (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          Last changed by {touched.who}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Save settings
            </button>
            <span className="text-xs text-slate-400">
              Saved together — if one field is rejected, nothing changes.
            </span>
          </div>
        </form>
      </div>
    </main>
  )
}
