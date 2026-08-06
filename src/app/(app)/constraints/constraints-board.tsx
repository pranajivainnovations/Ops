"use client"

import { useState } from "react"

export type AttrType = "numeric" | "enum" | "boolean"

export interface AttributeValueInfo {
  id: string
  value: string
  label: string
}

export interface AttributeInfo {
  id: string
  key: string
  label: string
  type: AttrType
  values: AttributeValueInfo[]
}

export interface RuleInfo {
  id: string
  triggerAttributeId: string | null
  triggerOperator: string | null
  triggerNumericValue: number | null
  triggerValueIds: string[]
  targetAttributeId: string
  kind: string
  numericValue: number | null
  valueIds: string[]
  message: string
  priority: number
}

type RuleAction = (formData: FormData) => Promise<void>

// ─── Sentence generation — shared by the live preview and the read-only rule list ────────────────────

function valueLabels(attr: AttributeInfo | undefined, ids: string[]): string {
  if (!attr) return "…"
  const labels = ids.map((id) => attr.values.find((v) => v.id === id)?.label).filter(Boolean)
  return labels.length > 0 ? labels.join(", ") : "…"
}

function triggerPhrase(attr: AttributeInfo | undefined, operator: string | null, numericValue: number | string | null, valueIds: string[]): string {
  if (!attr || !operator) return "Always active"
  if (attr.type === "boolean") return operator === "IN" ? `${attr.label} is enabled` : `${attr.label} is disabled`
  if (operator === "MIN_VALUE") return `${attr.label} is at least ${numericValue ?? "…"}`
  if (operator === "MAX_VALUE") return `${attr.label} is at most ${numericValue ?? "…"}`
  const values = valueLabels(attr, valueIds)
  return operator === "IN" ? `${attr.label} is ${values}` : `${attr.label} is not ${values}`
}

function effectPhrase(attr: AttributeInfo | undefined, kind: string | null, numericValue: number | string | null, valueIds: string[]): string {
  if (!attr || !kind) return "…"
  if (attr.type === "boolean") {
    if (kind === "RECOMMENDED_VALUES") return `${attr.label} is recommended`
    if (kind === "FORBIDDEN_VALUES") return `${attr.label} is disabled`
    if (kind === "ALLOWED_VALUES") return `${attr.label} is required`
  }
  if (kind === "MIN_VALUE") return `${attr.label} must be at least ${numericValue ?? "…"}`
  if (kind === "MAX_VALUE") return `${attr.label} must be at most ${numericValue ?? "…"}`
  const values = valueLabels(attr, valueIds)
  if (kind === "ALLOWED_VALUES") return `${attr.label} must be ${values}`
  if (kind === "FORBIDDEN_VALUES") return `${attr.label} cannot be ${values}`
  if (kind === "RECOMMENDED_VALUES") return `${attr.label} is recommended to be ${values}`
  return `${attr.label} — ${kind}`
}

function describeRule(rule: RuleInfo, attributes: AttributeInfo[]): { when: string; then: string } {
  const triggerAttr = attributes.find((a) => a.id === rule.triggerAttributeId)
  const targetAttr = attributes.find((a) => a.id === rule.targetAttributeId)
  return {
    when: triggerPhrase(triggerAttr, rule.triggerOperator, rule.triggerNumericValue, rule.triggerValueIds),
    then: effectPhrase(targetAttr, rule.kind, rule.numericValue, rule.valueIds),
  }
}

// ─── Effect/operator vocabularies, adapted per attribute type ────────────────────────────────────────

const TRIGGER_OPERATORS_BY_TYPE: Record<AttrType, { value: string; label: string }[]> = {
  numeric: [
    { value: "MIN_VALUE", label: "is at least" },
    { value: "MAX_VALUE", label: "is at most" },
    { value: "IN", label: "is" },
    { value: "NOT_IN", label: "is not" },
  ],
  enum: [
    { value: "IN", label: "is" },
    { value: "NOT_IN", label: "is not" },
  ],
  boolean: [
    { value: "IN", label: "is enabled" },
    { value: "NOT_IN", label: "is disabled" },
  ],
}

const EFFECT_KINDS_BY_TYPE: Record<AttrType, { value: string; label: string; note?: string }[]> = {
  numeric: [
    { value: "MIN_VALUE", label: "Minimum" },
    { value: "MAX_VALUE", label: "Maximum" },
  ],
  enum: [
    { value: "ALLOWED_VALUES", label: "Allowed" },
    { value: "FORBIDDEN_VALUES", label: "Forbidden" },
    { value: "RECOMMENDED_VALUES", label: "Recommended" },
  ],
  boolean: [
    { value: "RECOMMENDED_VALUES", label: "Enable" },
    { value: "FORBIDDEN_VALUES", label: "Disable" },
    {
      value: "ALLOWED_VALUES",
      label: "Require",
      note: "Only blocks this option if something else gets selected instead — it can't force the customer to turn it on.",
    },
  ],
}

// ─── The builder form — used both for "add" (no initialRule) and "edit" (initialRule set) ────────────

function RuleBuilder({
  attributes,
  initialRule,
  action,
  onCancel,
}: {
  attributes: AttributeInfo[]
  initialRule?: RuleInfo
  action: RuleAction
  onCancel?: () => void
}) {
  const [triggerAttributeId, setTriggerAttributeId] = useState(initialRule?.triggerAttributeId ?? "")
  const [triggerOperator, setTriggerOperator] = useState(initialRule?.triggerOperator ?? "")
  const [triggerNumericValue, setTriggerNumericValue] = useState(initialRule?.triggerNumericValue?.toString() ?? "")
  const [triggerValueIds, setTriggerValueIds] = useState<string[]>(initialRule?.triggerValueIds ?? [])

  const [targetAttributeId, setTargetAttributeId] = useState(initialRule?.targetAttributeId ?? "")
  const [kind, setKind] = useState(initialRule?.kind ?? "")
  const [numericValue, setNumericValue] = useState(initialRule?.numericValue?.toString() ?? "")
  const [valueIds, setValueIds] = useState<string[]>(initialRule?.valueIds ?? [])

  const [message, setMessage] = useState(initialRule?.message ?? "")
  const [priority, setPriority] = useState(initialRule?.priority?.toString() ?? "0")

  const triggerAttr = attributes.find((a) => a.id === triggerAttributeId)
  const targetAttr = attributes.find((a) => a.id === targetAttributeId)
  const triggerBoolValueId = triggerAttr?.type === "boolean" ? triggerAttr.values[0]?.id : undefined
  const targetBoolValueId = targetAttr?.type === "boolean" ? targetAttr.values[0]?.id : undefined
  const effectNote = targetAttr && EFFECT_KINDS_BY_TYPE[targetAttr.type].find((k) => k.value === kind)?.note

  const preview = describeRule(
    {
      id: "preview",
      triggerAttributeId: triggerAttributeId || null,
      triggerOperator: triggerAttributeId ? triggerOperator || null : null,
      triggerNumericValue: triggerNumericValue ? Number(triggerNumericValue) : null,
      triggerValueIds: triggerBoolValueId ? [triggerBoolValueId] : triggerValueIds,
      targetAttributeId,
      kind: kind || null,
      numericValue: numericValue ? Number(numericValue) : null,
      valueIds: targetBoolValueId ? [targetBoolValueId] : valueIds,
      message,
      priority: Number(priority) || 0,
    } as RuleInfo,
    attributes
  )

  const toggleValue = (list: string[], id: string, set: (v: string[]) => void) => {
    set(list.includes(id) ? list.filter((v) => v !== id) : [...list, id])
  }

  return (
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      {/* Live English preview */}
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <span className="font-semibold text-slate-400">WHEN</span>{" "}
        <span className="font-medium text-slate-900">{preview.when}</span>{" "}
        <span className="font-semibold text-slate-400">THEN</span>{" "}
        <span className="font-medium text-slate-900">{preview.then}</span>
      </div>

      {/* WHEN — trigger */}
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">When</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            name="triggerAttributeId"
            value={triggerAttributeId}
            onChange={(e) => {
              setTriggerAttributeId(e.target.value)
              setTriggerOperator("")
              setTriggerNumericValue("")
              setTriggerValueIds([])
            }}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">Always active (no condition)</option>
            {attributes.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>

          {triggerAttr && (
            <select
              name="triggerOperator"
              value={triggerOperator}
              onChange={(e) => {
                setTriggerOperator(e.target.value)
                setTriggerNumericValue("")
                setTriggerValueIds([])
              }}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="">choose…</option>
              {TRIGGER_OPERATORS_BY_TYPE[triggerAttr.type].map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          )}

          {triggerAttr && (triggerOperator === "MIN_VALUE" || triggerOperator === "MAX_VALUE") && (
            <input
              type="number"
              name="triggerNumericValue"
              step="0.01"
              value={triggerNumericValue}
              onChange={(e) => setTriggerNumericValue(e.target.value)}
              className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
          )}
        </div>

        {triggerAttr && triggerAttr.type !== "boolean" && (triggerOperator === "IN" || triggerOperator === "NOT_IN") && (
          <div className="mt-2 flex flex-wrap gap-3">
            {triggerAttr.values.map((v) => (
              <label key={v.id} className="flex items-center gap-1 text-xs text-slate-700">
                <input
                  type="checkbox"
                  name="triggerValueIds"
                  value={v.id}
                  checked={triggerValueIds.includes(v.id)}
                  onChange={() => toggleValue(triggerValueIds, v.id, setTriggerValueIds)}
                />
                {v.label}
              </label>
            ))}
          </div>
        )}
        {triggerBoolValueId && (triggerOperator === "IN" || triggerOperator === "NOT_IN") && (
          <input type="hidden" name="triggerValueIds" value={triggerBoolValueId} />
        )}
      </div>

      {/* THEN — target + effect */}
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Then</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            name="targetAttributeId"
            required
            value={targetAttributeId}
            onChange={(e) => {
              setTargetAttributeId(e.target.value)
              setKind("")
              setNumericValue("")
              setValueIds([])
            }}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">choose an attribute…</option>
            {attributes.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>

          {targetAttr && (
            <select
              name="kind"
              required
              value={kind}
              onChange={(e) => {
                setKind(e.target.value)
                setNumericValue("")
                setValueIds([])
              }}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="">choose an effect…</option>
              {EFFECT_KINDS_BY_TYPE[targetAttr.type].map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          )}

          {targetAttr && (kind === "MIN_VALUE" || kind === "MAX_VALUE") && (
            <input
              type="number"
              name="numericValue"
              step="0.01"
              value={numericValue}
              onChange={(e) => setNumericValue(e.target.value)}
              className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
          )}
        </div>

        {targetAttr && targetAttr.type !== "boolean" && (kind === "ALLOWED_VALUES" || kind === "FORBIDDEN_VALUES" || kind === "RECOMMENDED_VALUES") && (
          <div className="mt-2 flex flex-wrap gap-3">
            {targetAttr.values.map((v) => (
              <label key={v.id} className="flex items-center gap-1 text-xs text-slate-700">
                <input
                  type="checkbox"
                  name="valueIds"
                  value={v.id}
                  checked={valueIds.includes(v.id)}
                  onChange={() => toggleValue(valueIds, v.id, setValueIds)}
                />
                {v.label}
              </label>
            ))}
          </div>
        )}
        {targetBoolValueId && (kind === "ALLOWED_VALUES" || kind === "FORBIDDEN_VALUES" || kind === "RECOMMENDED_VALUES") && (
          <input type="hidden" name="valueIds" value={targetBoolValueId} />
        )}
        {effectNote && <p className="mt-1.5 text-xs italic text-slate-400">{effectNote}</p>}
      </div>

      {/* Message + priority */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Message</p>
          <input
            type="text"
            name="message"
            required
            placeholder="What the customer/OPS sees when this rule fires"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Priority</p>
          <input
            type="number"
            name="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-800">
            {initialRule ? "Save changes" : "+ Add rule"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  )
}

// ─── One row in the flat rule list — toggles into the builder when editing ────────────────────────────

function RuleRow({
  rule,
  attributes,
  editable,
  updateAction,
  deleteAction,
}: {
  rule: RuleInfo
  attributes: AttributeInfo[]
  editable: boolean
  updateAction: (ruleId: string, formData: FormData) => Promise<void>
  deleteAction: (ruleId: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <RuleBuilder
        attributes={attributes}
        initialRule={rule}
        action={updateAction.bind(null, rule.id)}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const { when, then } = describeRule(rule, attributes)

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
      <div>
        <p className="text-sm">
          <span className="font-semibold text-slate-400">WHEN</span> <span className="text-slate-900">{when}</span>{" "}
          <span className="font-semibold text-slate-400">THEN</span> <span className="text-slate-900">{then}</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">&ldquo;{rule.message}&rdquo; &middot; priority {rule.priority}</p>
      </div>
      {editable && (
        <div className="flex shrink-0 gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-slate-600 hover:text-slate-900">
            Edit
          </button>
          <form action={deleteAction.bind(null, rule.id)}>
            <button type="submit" className="text-xs font-semibold text-red-600 hover:text-red-800">
              Delete
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// ─── The page's whole rule area — an "add" builder (when editable) plus the flat rule list ────────────

export default function ConstraintsBoard({
  attributes,
  rules,
  editable,
  addRuleAction,
  updateRuleAction,
  deleteRuleAction,
}: {
  attributes: AttributeInfo[]
  rules: RuleInfo[]
  editable: boolean
  addRuleAction: RuleAction
  updateRuleAction: (ruleId: string, formData: FormData) => Promise<void>
  deleteRuleAction: (ruleId: string) => Promise<void>
}) {
  return (
    <div className="space-y-4">
      {editable && (
        // Remounts (and so resets) whenever the rule count changes — the simplest way to clear the
        // form after a successful add without hand-rolling pending/success state tracking.
        <RuleBuilder key={rules.length} attributes={attributes} action={addRuleAction} />
      )}

      {rules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-center text-sm text-slate-400">
          No rules yet — nothing is constrained.
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              attributes={attributes}
              editable={editable}
              updateAction={updateRuleAction}
              deleteAction={deleteRuleAction}
            />
          ))}
        </div>
      )}
    </div>
  )
}
