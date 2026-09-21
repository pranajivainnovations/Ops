/**
 * Shapes and display helpers, safe on both sides of the client boundary.
 *
 * Split out of data.ts because that module is server-only — it holds the service key and talks to
 * the backend — while the forms that render these values are client components. Keeping the types
 * and the rupee/percent formatting here means a card can import what it needs without dragging a
 * credential into the browser bundle, which is what the server-only marker exists to prevent.
 */

export type Brand = "crossfriend" | "pranajiva"
export type Mechanic =
  | "economics"
  | "signup_bonus"
  | "joining_cash"
  | "referral"
  | "cashback"
  | "studio"

export const MECHANIC_LABEL: Record<Mechanic, string> = {
  economics: "Economics",
  signup_bonus: "Welcome bonus",
  joining_cash: "Joining cash",
  referral: "Referral",
  cashback: "Cashback",
  studio: "AI Studio",
}

export interface FieldSpec {
  key: string
  label: string
  unit: "paise" | "bps" | "count" | "days" | "boolean"
  required: boolean
  min?: number
  max?: number
  help: string
}

export interface EffectiveConfig {
  brand: Brand
  pincode: string | null
  mechanic: Mechanic
  version: number
  effectiveFrom: string
  isEnabled: boolean
  startsAt: string | null
  endsAt: string | null
  maxGrants: number | null
  budgetPaise: number | null
  /**
   * Where a brand-level offer runs. Always the brand row's answer, never a pincode row's — a pincode
   * row is about one pincode and carries no list.
   */
  scopeMode: "all" | "selected" | null
  scopePincodes: string[] | null
  params: Record<string, number | boolean>
  note: string | null
  brandVersion: number | null
  pincodeVersion: number | null
  source: Record<string, "brand" | "pincode">
}

export interface RewardScope {
  brand: Brand
  pincode: string | null
  fields: Record<Mechanic, FieldSpec[]>
  config: Record<Mechanic, EffectiveConfig | null>
}

export interface GlobalSwitch {
  enabled: boolean
  history: {
    key: string
    oldValue: string | null
    newValue: string
    reason: string
    changedBy: string | null
    changedAt: string
  }[]
}

export interface LiabilityReport {
  outstandingPaise: number
  awaitingSweepPaise: number
  debtPaise: number
  byBucket: {
    brand: Brand
    entryType: string
    bucket: string
    paise: number
    grants: number
    customers: number
  }[]
  movements: { brand: Brand; entryType: string; paise: number; count: number }[]
}

export function isError<T>(value: T | { error: string }): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value
}

export const rupees = (paise: number | null | undefined) =>
  paise === null || paise === undefined ? "—" : `₹${(paise / 100).toLocaleString("en-IN")}`

export const percent = (bps: number | null | undefined) =>
  bps === null || bps === undefined ? "—" : `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`

/** Renders a stored value in the unit its field is declared in. */
export function formatValue(spec: FieldSpec, value: number | boolean | undefined): string {
  if (value === undefined || value === null) return "—"
  if (spec.unit === "boolean") return value ? "Yes" : "No"
  if (spec.unit === "paise") return rupees(Number(value))
  if (spec.unit === "bps") return percent(Number(value))
  if (spec.unit === "days") return `${value} day${value === 1 ? "" : "s"}`
  return String(value)
}

export interface FieldChange {
  field: string
  from: number | boolean | string | null
  to: number | boolean | string | null
}

export interface AuditEntry {
  version: number
  effectiveFrom: string
  createdAt: string
  createdByName: string | null
  note: string | null
  isEnabled: boolean
  changes: FieldChange[]
}

/**
 * Which controls move money.
 *
 * Anything measured in rupees or in basis points changes what is paid out or what a customer can
 * spend. Everything else — how many days a grant lasts, whether cashback is suppressed on a
 * discounted order — shapes the offer without setting its price.
 *
 * The distinction exists so these fields can be marked on screen. A rate sitting in a plain list of
 * inputs looks exactly like a WhatsApp number, and the cost of confusing the two is not symmetrical.
 */
export function isMoneyControl(unit: FieldSpec["unit"]): boolean {
  return unit === "paise" || unit === "bps"
}

export interface MechanicOutcome {
  mechanic: Exclude<Mechanic, "economics">
  state: string
  stateKind: "allowed" | "stopped" | "paused" | "unconfigured"
  explanation: string | null
  grants: number
  maxGrants: number | null
  grantsRemaining: number | null
  issuedPaise: number
  budgetPaise: number | null
  budgetRemainingPaise: number | null
  redeemedPaise: number
  expiredPaise: number
  outstandingPaise: number
  customers: number
  costPerCustomerPaise: number | null
}

export interface PincodeOutcomes {
  brand: Brand
  pincode: string
  mechanics: MechanicOutcome[]
  totals: {
    issuedPaise: number
    redeemedPaise: number
    expiredPaise: number
    outstandingPaise: number
    customers: number
  }
  unavailable: string[]
}

/**
 * A pincode an offer could be switched on in, with how ready it is today.
 *
 * Lives here rather than beside the query that produces it because the scope picker is a client
 * component, and a client component may not reach into a module marked server-only. A type-only
 * import is erased and would survive, but this repo has already been caught once by something that
 * compiled and built and still broke at render — shared shapes go in shared files.
 */
export interface ScopeCandidate {
  pincode: string
  district: string | null
  readyBakers: number
}
