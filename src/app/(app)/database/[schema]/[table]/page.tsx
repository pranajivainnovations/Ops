import Link from "next/link"
import { notFound } from "next/navigation"
import { describeTable, sampleTable, SAMPLE_ROW_LIMIT } from "@/lib/db-explorer"

export const dynamic = "force-dynamic"

/**
 * One table: its columns, and a small sample of rows.
 *
 * Generic on purpose — this single route renders any table in any allowed schema, so a table added
 * to the database later is browsable immediately with no new page and no code change.
 *
 * Sample rows are read here and nowhere else, which is what keeps the explorer's index cheap.
 * Masked columns are replaced in the data layer (see db-explorer), so a secret never reaches this
 * component in the first place — the masking is not a display concern that a future refactor of
 * this file could accidentally undo.
 */
export default async function TablePage({
  params,
}: {
  params: Promise<{ schema: string; table: string }>
}) {
  const { schema, table } = await params

  let columns
  let sample
  try {
    columns = await describeTable(schema, table)
    sample = await sampleTable(schema, table)
  } catch {
    // Unknown schema, unknown table, or a schema outside the allowlist all land here — a browsing
    // tool has no reason to distinguish "does not exist" from "not browsable".
    notFound()
  }

  const maskedCount = columns.filter((c) => c.masked).length

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      <div className="mb-6">
        <Link
          href={`/database?schema=${schema}`}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          ← {schema}
        </Link>
        <h1 className="mt-1 font-mono text-lg font-bold text-slate-900">
          {schema}.{table}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {columns.length} columns · showing up to {SAMPLE_ROW_LIMIT} sample rows
          {maskedCount > 0 && ` · ${maskedCount} masked`}
        </p>
      </div>

      {/* Columns */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Columns</h2>
      <div className="mb-8 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Type</th>
              <th className="px-4 py-2 font-semibold">Nullable</th>
              <th className="px-4 py-2 font-semibold">Default</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {columns.map((c) => (
              <tr key={c.name} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2 font-mono text-slate-900">
                  {c.name}
                  {c.isPrimaryKey && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                      pk
                    </span>
                  )}
                  {c.masked && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      masked
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-slate-600">{c.dataType}</td>
                <td className="px-4 py-2 text-slate-500">{c.nullable ? "yes" : "no"}</td>
                <td className="max-w-[280px] truncate px-4 py-2 font-mono text-xs text-slate-400">
                  {c.default ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sample data */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Sample data
      </h2>
      {sample.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center">
          <p className="text-sm text-slate-500">This table is empty.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
              <tr>
                {sample.columns.map((name) => (
                  <th key={name} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sample.rows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`max-w-[320px] truncate whitespace-nowrap px-3 py-2 font-mono ${
                        cell === "NULL" ? "text-slate-300" : "text-slate-700"
                      }`}
                      title={cell}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sample.truncated && (
        <p className="mt-2 text-xs text-slate-400">
          Showing the first {SAMPLE_ROW_LIMIT} rows. This is a diagnostic sample, not a full export.
        </p>
      )}
    </div>
  )
}
