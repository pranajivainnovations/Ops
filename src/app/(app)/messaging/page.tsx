import { deleteTemplate, saveFlow, saveTemplate } from "./actions"
import { FLOW_LIMITS, getFlows, getTemplates } from "./data"

export const dynamic = "force-dynamic"

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"

const labelClass = "mb-1 block text-xs font-semibold text-slate-600"

const fmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
})

/** Seconds are what the database stores; minutes are what a person thinks in. */
function humanSeconds(seconds: number): string {
  if (seconds % 60 === 0 && seconds >= 60) {
    const mins = seconds / 60
    return `${mins} minute${mins === 1 ? "" : "s"}`
  }
  return `${seconds} seconds`
}

export default async function MessagingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { error, saved } = await searchParams
  const [templates, flows] = await Promise.all([getTemplates(), getFlows()])

  const activeTemplates = templates.filter((t) => t.isActive)

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Messaging</h1>
        <p className="mt-1 text-xs text-slate-500">
          DLT sender headers, SMS templates, and which template each customer flow sends through.
        </p>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {error && (
          <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 ring-1 ring-rose-200">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
            Saved. Changes take effect on the next code that goes out — nothing is cached.
          </p>
        )}

        {/*
          States plainly where the credential is, because the natural assumption looking at this
          page is that everything about SMS is configurable here. An operator hunting for a missing
          auth key field should find the answer on the page rather than filing it as a bug.
        */}
        <p className="mb-8 rounded-lg bg-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
          <strong>The MSG91 auth key is not on this page and cannot be.</strong> It can send messages
          and spend money, so it lives in the backend environment with the other credentials. Everything
          here — headers, templates, timings and limits — takes effect without a deploy.
        </p>

        {/* ── Flows ──────────────────────────────────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-sm font-bold text-slate-900">Flows</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            A flow is one thing the website sends a message for. Pick the template it goes out
            under — the sender header comes from the template, because DLT registers a template
            underneath a specific header and the pair cannot be mixed.
          </p>

          <div className="mt-4 flex flex-col gap-5">
            {flows.map((flow) => {
              const assigned = templates.find((t) => t.id === flow.templateId)
              return (
                <form
                  key={flow.flowKey}
                  action={saveFlow}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <input type="hidden" name="flow_key" value={flow.flowKey} />

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{flow.label}</h3>
                      <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-500">
                        {flow.description}
                      </p>
                      <code className="mt-1 inline-block text-[11px] text-slate-400">
                        {flow.flowKey}
                      </code>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        flow.isEnabled
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                      }`}
                    >
                      {flow.isEnabled ? "Live" : "Off"}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelClass} htmlFor={`${flow.flowKey}-template`}>
                        SMS template
                      </label>
                      <select
                        id={`${flow.flowKey}-template`}
                        name="template_id"
                        defaultValue={flow.templateId ?? ""}
                        className={inputClass}
                      >
                        <option value="">— none assigned —</option>
                        {activeTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.senderHeader} · {t.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        {assigned ? (
                          <>
                            Messages for this flow are sent from{" "}
                            <strong className="text-slate-700">{assigned.senderHeader}</strong> using
                            DLT template <code>{assigned.dltTemplateId}</code>.
                          </>
                        ) : (
                          "Only active templates with an MSG91 ID can be assigned."
                        )}
                      </p>
                    </div>

                    <div>
                      <label className={labelClass} htmlFor={`${flow.flowKey}-len`}>
                        Code length
                      </label>
                      <input
                        id={`${flow.flowKey}-len`}
                        name="otp_length"
                        type="number"
                        min={FLOW_LIMITS.otpLength.min}
                        max={FLOW_LIMITS.otpLength.max}
                        defaultValue={flow.otpLength}
                        className={inputClass}
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Digits. Must match the template registered with DLT.
                      </p>
                    </div>

                    <div>
                      <label className={labelClass} htmlFor={`${flow.flowKey}-ttl`}>
                        Code validity (seconds)
                      </label>
                      <input
                        id={`${flow.flowKey}-ttl`}
                        name="otp_ttl_seconds"
                        type="number"
                        min={FLOW_LIMITS.otpTtlSeconds.min}
                        max={FLOW_LIMITS.otpTtlSeconds.max}
                        defaultValue={flow.otpTtlSeconds}
                        className={inputClass}
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Currently {humanSeconds(flow.otpTtlSeconds)}.
                      </p>
                    </div>

                    <div>
                      <label className={labelClass} htmlFor={`${flow.flowKey}-attempts`}>
                        Maximum attempts
                      </label>
                      <input
                        id={`${flow.flowKey}-attempts`}
                        name="max_attempts"
                        type="number"
                        min={FLOW_LIMITS.maxAttempts.min}
                        max={FLOW_LIMITS.maxAttempts.max}
                        defaultValue={flow.maxAttempts}
                        className={inputClass}
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Wrong guesses before the code is discarded.
                      </p>
                    </div>

                    <div>
                      <label className={labelClass} htmlFor={`${flow.flowKey}-cooldown`}>
                        Resend cooldown (seconds)
                      </label>
                      <input
                        id={`${flow.flowKey}-cooldown`}
                        name="resend_cooldown_seconds"
                        type="number"
                        min={FLOW_LIMITS.resendCooldownSeconds.min}
                        max={FLOW_LIMITS.resendCooldownSeconds.max}
                        defaultValue={flow.resendCooldownSeconds}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass} htmlFor={`${flow.flowKey}-daily`}>
                        Daily limit per number
                      </label>
                      <input
                        id={`${flow.flowKey}-daily`}
                        name="daily_send_limit"
                        type="number"
                        min={FLOW_LIMITS.dailySendLimit.min}
                        max={FLOW_LIMITS.dailySendLimit.max}
                        defaultValue={flow.dailySendLimit}
                        className={inputClass}
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Caps what one number can cost you in a day.
                      </p>
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          name="is_enabled"
                          defaultChecked={flow.isEnabled}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Flow is live
                      </label>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                      Save flow
                    </button>
                    <span className="text-xs text-slate-400">
                      Last changed {fmt.format(new Date(flow.updatedAt))}
                      {flow.updatedBy && ` by ${flow.updatedBy}`}
                    </span>
                  </div>
                </form>
              )
            })}
          </div>
        </section>

        {/* ── Templates ──────────────────────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-slate-900">Templates</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            One row per template approved on the DLT portal. The header is part of the template
            because that is how TRAI registers it — to send under a different header, add the
            template registered under that header and point the flow at it.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            {templates.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <form action={saveTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <TemplateFields template={t} />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                      Save
                    </button>
                    <span className="text-xs text-slate-400">
                      {t.usedByFlows.length
                        ? `Used by ${t.usedByFlows.join(", ")}`
                        : "Not used by any flow"}
                    </span>
                  </div>
                </form>

                {/* Separate form: a delete button inside the edit form would submit the edit too. */}
                {t.usedByFlows.length === 0 && (
                  <form action={deleteTemplate} className="mt-3 border-t border-slate-100 pt-3">
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      className="text-xs font-medium text-rose-600 underline underline-offset-2 hover:text-rose-700"
                    >
                      Delete this template
                    </button>
                  </form>
                )}
              </div>
            ))}

            <details className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                Add a template
              </summary>
              <form action={saveTemplate} className="mt-4">
                <TemplateFields />
                <button
                  type="submit"
                  className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Add template
                </button>
              </form>
            </details>
          </div>
        </section>
      </div>
    </main>
  )
}

function TemplateFields({
  template,
}: {
  template?: {
    label: string
    senderHeader: string
    dltTemplateId: string
    providerTemplateId: string
    bodyPreview: string
    isActive: boolean
  }
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className={labelClass}>Name</label>
        <input
          name="label"
          defaultValue={template?.label ?? ""}
          placeholder="AI Studio login OTP"
          className={inputClass}
          autoComplete="off"
        />
      </div>

      <div>
        <label className={labelClass}>Sender header</label>
        <input
          name="sender_header"
          defaultValue={template?.senderHeader ?? ""}
          placeholder="CRSFRD"
          className={`${inputClass} uppercase`}
          autoComplete="off"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          3–11 letters or digits, exactly as DLT approved it.
        </p>
      </div>

      <div>
        <label className={labelClass}>DLT template ID</label>
        <input
          name="dlt_template_id"
          defaultValue={template?.dltTemplateId ?? ""}
          placeholder="1707xxxxxxxxxxxxxx"
          className={inputClass}
          autoComplete="off"
        />
        <p className="mt-1 text-[11px] text-slate-500">From the DLT portal. Must be unique.</p>
      </div>

      <div>
        <label className={labelClass}>MSG91 template ID</label>
        <input
          name="provider_template_id"
          defaultValue={template?.providerTemplateId ?? ""}
          placeholder="65f1a2b3c4d5e6f7a8b9c0d1"
          className={inputClass}
          autoComplete="off"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          The Flow ID from MSG91, not the DLT one. Nothing sends without it.
        </p>
      </div>

      <div className="sm:col-span-2">
        <label className={labelClass}>Message body</label>
        <textarea
          name="body_preview"
          defaultValue={template?.bodyPreview ?? ""}
          rows={3}
          placeholder="Your CrossFriend verification code is ##otp##. It is valid for 5 minutes. Do not share it with anyone."
          className={inputClass}
        />
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Paste the approved text so the team can read what a customer receives. It must contain{" "}
          <code>##otp##</code> — the backend sends a variable named <code>otp</code>, and MSG91
          substitutes an empty string rather than failing if the names disagree.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={template?.isActive ?? true}
            className="h-4 w-4 rounded border-slate-300"
          />
          Active
        </label>
        <p className="mt-1 text-[11px] text-slate-500">
          Uncheck if DLT has revoked or rejected it.
        </p>
      </div>
    </div>
  )
}
