"use client"

import { useId } from "react"

import {
  toFormValue,
  type FieldSpec,
} from "@/lib/pranajiva/product-fields"

/**
 * One metadata field, rendered as whatever it actually is.
 *
 * A list gets a box you put one item per line into. A map gets `key = value` lines. A vocabulary
 * gets a datalist, which suggests without refusing — the catalogue rule is that code never decides
 * what exists, so an unfamiliar value has to remain typeable.
 *
 * The encoding between these boxes and the stored JSON lives in lib/pranajiva/product-fields.ts,
 * in one place, so this component only has to pick a control.
 */
export default function FieldInput({
  spec,
  value,
}: {
  spec: FieldSpec
  value: unknown
}) {
  const id = useId()
  const name = `meta.${spec.key}`
  const initial = toFormValue(spec.kind, value)

  const label = (
    <label htmlFor={id} className="text-xs font-semibold text-slate-700">
      {spec.label}
      <span className="ml-1.5 font-mono text-[10px] font-normal text-slate-400">{spec.key}</span>
    </label>
  )

  const help = spec.help ? (
    <p className="mt-1 text-[11px] leading-snug text-slate-500">{spec.help}</p>
  ) : null

  const box =
    "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"

  if (spec.kind === "boolean") {
    return (
      <div className="py-2">
        {label}
        <select id={id} name={name} defaultValue={initial || "false"} className={box}>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
        {help}
      </div>
    )
  }

  if (spec.kind === "number") {
    return (
      <div className="py-2">
        {label}
        <input id={id} name={name} defaultValue={initial} inputMode="numeric" className={box} />
        {help}
      </div>
    )
  }

  if (spec.kind === "text") {
    const listId = spec.options ? `${id}-options` : undefined
    return (
      <div className="py-2">
        {label}
        <input id={id} name={name} defaultValue={initial} list={listId} className={box} />
        {listId && (
          <datalist id={listId}>
            {spec.options!.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        )}
        {help}
      </div>
    )
  }

  /* Everything else is multi-line. The row counts are what these fields actually hold: a list of
     hamper contents runs to seven lines, a safety paragraph to four. */
  const rows =
    spec.kind === "textarea" ? 4 : spec.kind === "keyvalue" ? 4 : spec.kind === "ingredients" ? 4 : 5

  const placeholder =
    spec.kind === "list"
      ? "One per line"
      : spec.kind === "keyvalue"
        ? "key = value, one per line"
        : spec.kind === "ingredients"
          ? "Multani Mitti = 60"
          : undefined

  return (
    <div className="py-2">
      {label}
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={initial}
        placeholder={placeholder}
        className={`${box} font-mono leading-relaxed`}
      />
      {spec.options && spec.kind === "list" && (
        <p className="mt-1 text-[11px] text-slate-400">
          Often used: {spec.options.join(", ")}
        </p>
      )}
      {help}
    </div>
  )
}
