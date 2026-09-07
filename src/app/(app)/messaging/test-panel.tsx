"use client"

import { useState } from "react"

import { runOtpTest, type OtpTestResult } from "./test-actions"

/**
 * Send a real OTP and read MSG91's unedited answer.
 *
 * A client component rather than a form posting to a server action, because the result has to
 * appear beside the form without losing what was typed — an operator working through a
 * misconfiguration sends, reads, edits the template, sends again, and a full page navigation
 * between each step makes that loop painful enough that people go back to reading logs.
 */
export default function TestPanel() {
  const [mobile, setMobile] = useState("")
  const [otp, setOtp] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<OtpTestResult | null>(null)

  const run = async (action: "send" | "verify" | "retry") => {
    setBusy(action)
    setResult(null)
    try {
      setResult(await runOtpTest({ mobile, action, otp }))
    } finally {
      setBusy(null)
    }
  }

  const canSend = /^[6-9]\d{9}$/.test(mobile) && !busy
  const canVerify = canSend && /^\d{4,9}$/.test(otp)

  return (
    <section className="mt-10 rounded-xl border border-amber-200 bg-amber-50/50 p-5">
      <h2 className="text-sm font-bold text-slate-900">Test send</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        Sends a <strong>real, chargeable SMS</strong> using the template assigned above, and shows
        MSG91&rsquo;s reply exactly as it came back. The flow does not have to be live — that is the
        point, so a configuration can be proved before customers see it.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        No customer account is created or signed in by anything on this panel. It shares the same
        daily and cooldown limits as the real sign-in.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="test-mobile">
            Mobile
          </label>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-500">
              +91
            </span>
            <input
              id="test-mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10 digits"
              className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              autoComplete="off"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => run("send")}
          disabled={!canSend}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "send" ? "Sending…" : "Send OTP"}
        </button>

        <button
          type="button"
          onClick={() => run("retry")}
          disabled={!canSend}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "retry" ? "Resending…" : "Resend"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="test-otp">
            Code received
          </label>
          <input
            id="test-otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 9))}
            placeholder="123456"
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest text-slate-900 focus:border-slate-900 focus:outline-none"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={() => run("verify")}
          disabled={!canVerify}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "verify" ? "Verifying…" : "Verify"}
        </button>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Verify the same code twice to find out whether MSG91 invalidates it after the first
          success. If the second attempt also succeeds, codes are replayable and that needs handling.
        </p>
      </div>

      {result && <ResultBlock result={result} />}
    </section>
  )
}

function ResultBlock({ result }: { result: OtpTestResult }) {
  if (result.error) {
    return (
      <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 ring-1 ring-rose-200">
        {result.error}
        {typeof result.retryAfterSeconds === "number" &&
          ` (${result.retryAfterSeconds}s remaining)`}
      </p>
    )
  }

  const good = result.ok
  return (
    <div
      className={`mt-4 rounded-lg p-4 ring-1 ${
        good ? "bg-emerald-50 ring-emerald-200" : "bg-rose-50 ring-rose-200"
      }`}
    >
      <p className={`text-sm font-bold ${good ? "text-emerald-800" : "text-rose-800"}`}>
        {good ? "MSG91 accepted the request" : "MSG91 rejected the request"}
        {result.kind && !good && ` · ${result.kind}`}
      </p>
      {result.note && <p className="mt-1 text-xs text-emerald-900">{result.note}</p>}

      {result.raw && (
        <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="font-semibold text-slate-600">HTTP</dt>
          <dd className="font-mono text-slate-800">{result.raw.httpStatus ?? "—"}</dd>
          <dt className="font-semibold text-slate-600">type</dt>
          <dd className="font-mono text-slate-800">{result.raw.type ?? "—"}</dd>
          <dt className="font-semibold text-slate-600">message</dt>
          <dd className="break-all font-mono text-slate-800">{result.raw.message ?? "—"}</dd>
          <dt className="font-semibold text-slate-600">url</dt>
          <dd className="break-all font-mono text-[11px] text-slate-500">{result.raw.url}</dd>
        </dl>
      )}

      {result.sentConfig && (
        <div className="mt-3 border-t border-black/5 pt-3 text-xs text-slate-700">
          <p>
            Sent as <strong>{result.sentConfig.senderHeader}</strong> · template{" "}
            <code>{result.sentConfig.providerTemplateId}</code> · {result.sentConfig.otpLength}{" "}
            digits · expiry <strong>{result.sentConfig.otpExpiryMinutes} min</strong>
          </p>
          {/*
            The one arithmetic error this whole screen exists to catch. The approved SMS text
            promises ten minutes; otp_expiry is derived from a column seeded at 300 seconds. Left
            alone, the message tells the customer something the system will not honour.
          */}
          {result.sentConfig.ttlSecondsConfigured !== 600 && (
            <p className="mt-1 font-semibold text-amber-800">
              Code validity is set to {result.sentConfig.ttlSecondsConfigured}s (
              {result.sentConfig.otpExpiryMinutes} min), but the approved template text says 10
              minutes. Set it to 600 above.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
