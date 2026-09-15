"use client"

import { useActionState } from "react"

import { saveRewardConfig, EMPTY_SAVE_STATE } from "./actions"
import {
  formatValue,
  isMoneyControl,
  MECHANIC_LABEL,
  rupees,
  type EffectiveConfig,
  type FieldSpec,
  type Mechanic,
} from "./types"

/**
 * One mechanic's configuration, at whichever scope the page is showing.
 *
 * ── Inherited and overridden look different ────────────────────────────────────────────────────
 * Every value carries a small tag saying whether it came from the brand default or from this
 * pincode. Without it the screen shows a ₹40,000 budget identically whether it is this pincode's
 * own or the brand's — and somebody edits the default, watches nothing change here, and concludes
 * the save is broken.
 *
 * ── A stop is one click, and never behind a validation error ───────────────────────────────────
 * The switch posts on its own, carrying only the note, so turning an offer off never requires the
 * rest of the form to be valid. That is the same rule the backend enforces, made visible: the
 * moment somebody needs to stop paying out is the moment they least need an argument with a form.
 */
export default function MechanicCard({
  brand,
  pincode,
  mechanic,
  config,
  fields,
  history,
}: {
  brand: string
  pincode: string | null
  mechanic: Mechanic
  config: EffectiveConfig | null
  fields: FieldSpec[]
  /* Rendered on the server and passed in, so this client component never has to fetch it. */
  history?: React.ReactNode
}) {
  const [state, action, pending] = useActionState(saveRewardConfig, EMPTY_SAVE_STATE)

  const live = config?.isEnabled === true
  const from = (key: string) => config?.source?.[key]

  /* At pincode scope an inherited value is shown as a placeholder rather than a value, so an empty
     box reads as "inheriting" instead of "cleared". */
  const inherited = (key: string) => pincode !== null && from(key) !== "pincode"

  return (
    <form action={action} className="rounded-xl border border-slate-200 bg-white p-5">
      <input type="hidden" name="brand" value={brand} />
      <input type="hidden" name="mechanic" value={mechanic} />
      <input type="hidden" name="pincode" value={pincode ?? ""} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{MECHANIC_LABEL[mechanic]}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {config
              ? `Version ${config.version}${
                  pincode && config.pincodeVersion
                    ? ` · pincode v${config.pincodeVersion} over brand v${config.brandVersion}`
                    : ""
                }`
              : "Never configured"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              live
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
            }`}
          >
            {live ? "Live" : "Off"}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" name="isEnabled" defaultChecked={live} className="h-4 w-4" />
            Switched on
          </label>
        </div>
      </div>

      {mechanic !== "economics" && live && (
        /* Said here, next to the switch, because the belief it corrects is formed at exactly this
           moment: that turning an offer off also ends what it already costs. */
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
          <strong className="font-semibold text-slate-700">Switching this off stops new grants.</strong>{" "}
          Credit customers already hold keeps its expiry and stays spendable, and a second grant
          already promised by a first still arrives. What you owe does not change today — see the
          outstanding figure above.
        </p>
      )}

      {mechanic !== "economics" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Field
            label="Budget"
            name="budgetPaise"
            money
            prefix="₹"
            defaultValue={
              from("budgetPaise") === "pincode" || pincode === null
                ? config?.budgetPaise != null
                  ? String(config.budgetPaise / 100)
                  : ""
                : ""
            }
            placeholder={inherited("budgetPaise") ? rupees(config?.budgetPaise) : "required"}
            tag={config ? from("budgetPaise") : undefined}
            help="Mandatory before this can be switched on. There is no unlimited option."
          />
          <Field
            label="Max grants"
            name="maxGrants"
            defaultValue={
              from("maxGrants") === "pincode" || pincode === null
                ? config?.maxGrants != null
                  ? String(config.maxGrants)
                  : ""
                : ""
            }
            placeholder={inherited("maxGrants") ? String(config?.maxGrants ?? "no limit") : "no limit"}
            tag={config ? from("maxGrants") : undefined}
          />
          <Field
            label="Opens"
            name="startsAt"
            type="date"
            defaultValue={config?.startsAt?.slice(0, 10) ?? ""}
            tag={config ? from("startsAt") : undefined}
            help="Also the date the budget starts counting from."
          />
          <Field
            label="Closes"
            name="endsAt"
            type="date"
            defaultValue={config?.endsAt?.slice(0, 10) ?? ""}
            tag={config ? from("endsAt") : undefined}
          />
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {fields.map((spec) => {
          const value = config?.params?.[spec.key]
          const tag = config ? from(spec.key) : undefined

          if (spec.unit === "boolean") {
            return (
              <label key={spec.key} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name={spec.key}
                  defaultChecked={value === true}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  {spec.label}
                  {tag && <SourceTag source={tag} />}
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                    {spec.help}
                  </span>
                </span>
              </label>
            )
          }

          return (
            <Field
              key={spec.key}
              label={spec.label}
              name={spec.key}
              money={isMoneyControl(spec.unit)}
              prefix={spec.unit === "paise" ? "₹" : undefined}
              suffix={spec.unit === "bps" ? "%" : spec.unit === "days" ? "days" : undefined}
              defaultValue={
                value === undefined || (pincode !== null && tag !== "pincode")
                  ? ""
                  : spec.unit === "paise"
                    ? String(Number(value) / 100)
                    : spec.unit === "bps"
                      ? String(Number(value) / 100)
                      : String(value)
              }
              placeholder={inherited(spec.key) ? formatValue(spec, value) : ""}
              tag={tag}
              help={spec.help}
            />
          )
        })}
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-semibold text-slate-700">
          Why is this changing?
        </label>
        <input
          name="note"
          required
          placeholder="Kept with this version forever — the only thing that explains it later"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {state.blocks.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 ring-1 ring-red-200">
          {state.blocks.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {state.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          {state.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {state.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{state.error}</p>
      )}
      {state.ok && !state.warnings.length && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Saved as a new version. The previous one is still readable in the history.
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save new version"}
        </button>
        {config && (
          <span className="text-[11px] text-slate-400">
            {config.note ? `Last note: ${config.note}` : "No note on the current version"}
          </span>
        )}
      </div>

      {history && (
        <details className="mt-4 border-t border-slate-100 pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">
            Change history
          </summary>
          <div className="mt-3">{history}</div>
        </details>
      )}
    </form>
  )
}

function SourceTag({ source }: { source: "brand" | "pincode" }) {
  return (
    <span
      className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        source === "pincode"
          ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
          : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
      }`}
      title={
        source === "pincode"
          ? "Set here, overriding the brand default"
          : "Inherited from the brand default — change it there to move every pincode"
      }
    >
      {source === "pincode" ? "local" : "inherited"}
    </span>
  )
}

/**
 * A single control.
 *
 * ── Why money fields look different ────────────────────────────────────────────────────────────
 * A rate in a plain list of inputs looks exactly like a phone number, and the cost of confusing the
 * two is not symmetrical: a wrong WhatsApp number is a support ticket, a wrong referral rate is
 * money leaving the business on every order until somebody notices. The amber rule and the tag are
 * there to make the hand slow down, not to decorate.
 */
function Field({
  label,
  name,
  defaultValue,
  placeholder,
  prefix,
  suffix,
  type = "text",
  tag,
  help,
  money = false,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  prefix?: string
  suffix?: string
  type?: string
  tag?: "brand" | "pincode"
  help?: string
  money?: boolean
}) {
  return (
    <div className={money ? "rounded-lg border-l-2 border-amber-400 bg-amber-50/40 py-2 pl-3 pr-2" : undefined}>
      <label className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
        {money && (
          <span
            className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
            title="Changes what is paid out or what a customer can spend. Takes effect on the next order."
          >
            money
          </span>
        )}
        {tag && <SourceTag source={tag} />}
      </label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-slate-400">{prefix}</span>}
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={`w-full rounded-lg px-3 py-2 text-sm ${
            money ? "border border-amber-300 bg-white" : "border border-slate-300"
          }`}
        />
        {suffix && <span className="text-sm text-slate-400">{suffix}</span>}
      </div>
      {help && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{help}</p>}
    </div>
  )
}
