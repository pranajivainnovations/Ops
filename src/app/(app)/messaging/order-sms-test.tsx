"use client"

import { useState, useTransition } from "react"

import { runOrderSmsTest, type OrderSmsTestResult } from "./test-actions"

/**
 * Proving an order template before a customer depends on it.
 *
 * ── Why a screen for this ─────────────────────────────────────────────────────────────────────
 * Because the failure it catches is invisible everywhere else. MSG91 matches template variables by
 * name and does not complain when a name is wrong — it substitutes an empty string, delivers
 * "Hi , your Pranajiva order  is confirmed", returns success, and marks the message delivered on
 * its own dashboard. Our log records a success too, because a success is what the provider said.
 *
 * The only place that failure is visible is the handset. So this sends one message with values that
 * cannot be mistaken for real ones, and asks the operator to read it.
 */
export default function OrderSmsTest({
  templates,
}: {
  templates: { id: string; label: string; senderHeader: string }[]
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "")
  const [mobile, setMobile] = useState("")
  const [result, setResult] = useState<OrderSmsTestResult | null>(null)
  const [pending, start] = useTransition()

  function send() {
    setResult(null)
    start(async () => setResult(await runOrderSmsTest({ templateId, mobile })))
  }

  if (!templates.length) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        Add a template above with an MSG91 template ID, and it becomes testable here.
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="block text-xs font-semibold text-slate-700">Template</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} ({t.senderHeader})
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[10rem]">
          <label className="block text-xs font-semibold text-slate-700">Send to</label>
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            inputMode="numeric"
            placeholder="10 digits"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs tabular-nums text-slate-800 focus:border-slate-400 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={send}
          disabled={pending || !mobile}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send one test"}
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Sends with <span className="font-mono">name=TEST</span>,{" "}
        <span className="font-mono">order_id=9999</span>, <span className="font-mono">amount=1</span>.
        Read the message that arrives: if any of those three is missing, the template&rsquo;s variable
        is named something else and every real message will have the same blank. This is a real,
        chargeable SMS.
      </p>

      {result && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          <p className="font-semibold">
            {result.ok ? "MSG91 accepted it — now read the SMS" : "MSG91 refused it"}
          </p>
          {result.error && <p className="mt-1 break-words">{result.error}</p>}
          {result.ok && (
            <p className="mt-1 text-[11px] leading-snug">
              Accepted is not the same as correct. MSG91 reports a wrong variable name as a success,
              so the message on the handset is the only answer that counts.
            </p>
          )}
          {result.sentConfig && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
              <dt className="text-slate-500">Header</dt>
              <dd className="font-mono">{result.sentConfig.senderHeader}</dd>
              <dt className="text-slate-500">DLT</dt>
              <dd className="font-mono break-all">{result.sentConfig.dltTemplateId}</dd>
              <dt className="text-slate-500">MSG91</dt>
              <dd className="font-mono break-all">{result.sentConfig.providerTemplateId}</dd>
            </dl>
          )}
        </div>
      )}
    </div>
  )
}
