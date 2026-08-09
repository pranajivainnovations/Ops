import Link from "next/link"
import { listSchemas, listTables, ALLOWED_SCHEMAS } from "@/lib/db-explorer"

export const dynamic = "force-dynamic"

/**
 * Read-only database explorer.
 *
 * Expansion is URL state (`?schema=`) rather than client-side toggling, so this stays a server
 * component like every other OPS page — and a link to an expanded schema is shareable.
 *
 * Only the expanded schema's table list is queried. Nothing here reads table DATA: opening the
 * explorer costs one catalog query, plus one more for whichever schema is open. Sample rows are
 * loaded on the table page, on demand.
 */
export default async function DatabasePage({
  searchParams,
}: {
  searchParams: Promise<{ schema?: string }>
}) {
  const { schema } = await searchParams
  const openSchema =
    schema && (ALLOWED_SCHEMAS as readonly string[]).includes(schema) ? schema : null

  const schemas = await listSchemas()
  const tables = openSchema ? await listTables(openSchema) : []

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-slate-900">Database</h1>
        <p className="mt-1 text-sm text-slate-500">
          Read-only view of schemas, tables and columns. Connections are opened in read-only mode —
          no data can be changed from here.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Schema list */}
        <nav className="space-y-1" aria-label="Schemas">
          {schemas.map((s) => {
            const active = s.schema === openSchema
            return (
              <Link
                key={s.schema}
                href={active ? "/database" : `/database?schema=${s.schema}`}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="font-mono">{s.schema}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {s.tableCount}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Tables in the open schema */}
        <div className="min-w-0">
          {!openSchema ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-6 py-16 text-center">
              <p className="text-sm text-slate-500">Select a schema to see its tables.</p>
            </div>
          ) : tables.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-6 py-16 text-center">
              <p className="text-sm text-slate-500">
                <span className="font-mono">{openSchema}</span> has no tables.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Table</th>
                    <th className="px-4 py-2 text-right font-semibold">Columns</th>
                    <th className="px-4 py-2 text-right font-semibold">Rows</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tables.map((t) => (
                    <tr key={t.table} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <Link
                          href={`/database/${t.schema}/${t.table}`}
                          className="font-mono font-medium text-slate-900 hover:underline"
                        >
                          {t.table}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                        {t.columnCount}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                        {/* Planner estimate, not a count — see listTables. */}~
                        {t.estimatedRows.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
