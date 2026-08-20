"use client"

import { useState } from "react"

/**
 * A read-only string with a Copy button.
 *
 * The whole job is moving text into another application, so a click that lands it on the clipboard
 * is the feature — this is one of the few places in OPS where a client component earns itself.
 *
 * The text stays in a selectable input regardless, because clipboard access can be refused (an
 * insecure origin, a denied permission, an unusual browser) and the fallback has to be "select it
 * yourself", not "this button does nothing". Same reason the catch below sets no error state: on
 * failure the button simply never claims success.
 */
export default function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Deliberately silent — see above.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={value}
        aria-label={label ?? "Command"}
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-800"
      />
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}
