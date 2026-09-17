import "server-only"

import { getDbPool } from "@/lib/db"
import type { ScopeCandidate } from "./types"

/**
 * Reads the reward configuration from the backend rather than from the database.
 *
 * ── Why not straight to Postgres, like the messaging page does ─────────────────────────────────
 * Because reward configuration is not a value, it is a resolution: a pincode row merged over a
 * brand default, at a moment in time, with a note for every field saying which side it came from.
 * That logic already exists in the backend, it is the same code the reward engine reads through,
 * and a second implementation here would be two answers to "what rate is 201016 actually paying" —
 * with the one nobody checks being the one on screen.
 *
 * The same argument applies with more force to writing. Guardrails, versioning and validation are
 * on the write path in the backend, where a stale tab or a hurried script cannot skip them.
 */

import type {
  AuditEntry,
  Brand,
  GlobalSwitch,
  LiabilityReport,
  Mechanic,
  PincodeOutcomes,
  RewardScope,
} from "./types"

function backend() {
  const url = process.env.MEDUSA_BACKEND_URL?.replace(/\/$/, "")
  const key = process.env.OPS_SERVICE_KEY
  /* Names the one that is missing rather than listing both, so the fix is obvious from the log. */
  if (!url) throw new Error("MEDUSA_BACKEND_URL is not set")
  if (!key) throw new Error("OPS_SERVICE_KEY is not set")
  return { url, key }
}

/** Everything in force for a brand, optionally narrowed to one pincode. */
export async function getRewardScope(
  brand: Brand,
  pincode: string | null
): Promise<RewardScope | { error: string }> {
  try {
    const { url, key } = backend()
    const qs = new URLSearchParams({ brand })
    if (pincode) qs.set("pincode", pincode)

    const res = await fetch(`${url}/ops/wallet/config?${qs}`, {
      headers: { "x-ops-service-key": key },
      cache: "no-store",
    })

    if (!res.ok) {
      return { error: `The backend answered ${res.status}. Rewards cannot be read right now.` }
    }
    return (await res.json()) as RewardScope
  } catch (error) {
    /* Reported rather than thrown: a backend that is down should grey out one panel, not take the
       whole pincode page with it. */
    return {
      error: error instanceof Error ? error.message : "The backend is unreachable.",
    }
  }
}

export async function getGlobalSwitch(): Promise<GlobalSwitch | { error: string }> {
  try {
    const { url, key } = backend()
    const res = await fetch(`${url}/ops/wallet/switch`, {
      headers: { "x-ops-service-key": key },
      cache: "no-store",
    })
    if (!res.ok) return { error: `The backend answered ${res.status}.` }
    return (await res.json()) as GlobalSwitch
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The backend is unreachable." }
  }
}

export async function getLiability(): Promise<LiabilityReport | { error: string }> {
  try {
    const { url, key } = backend()
    const res = await fetch(`${url}/ops/wallet/liability`, {
      headers: { "x-ops-service-key": key },
      cache: "no-store",
    })
    if (!res.ok) return { error: `The backend answered ${res.status}.` }
    return (await res.json()) as LiabilityReport
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The backend is unreachable." }
  }
}

/** Who changed one mechanic's settings, when, and what moved. */
export async function getRewardHistory(
  brand: Brand,
  pincode: string | null,
  mechanic: Mechanic
): Promise<AuditEntry[] | { error: string }> {
  try {
    const { url, key } = backend()
    const qs = new URLSearchParams({ brand, mechanic })
    if (pincode) qs.set("pincode", pincode)

    const res = await fetch(`${url}/ops/wallet/history?${qs}`, {
      headers: { "x-ops-service-key": key },
      cache: "no-store",
    })
    if (!res.ok) return { error: `The backend answered ${res.status}.` }
    return ((await res.json()) as { entries: AuditEntry[] }).entries
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The backend is unreachable." }
  }
}

/** What the rewards in one pincode have actually done. */
export async function getPincodeOutcomes(
  brand: Brand,
  pincode: string
): Promise<PincodeOutcomes | { error: string }> {
  try {
    const { url, key } = backend()
    const res = await fetch(
      `${url}/ops/wallet/outcomes?brand=${brand}&pincode=${encodeURIComponent(pincode)}`,
      { headers: { "x-ops-service-key": key }, cache: "no-store" }
    )
    if (!res.ok) return { error: `The backend answered ${res.status}.` }
    return (await res.json()) as PincodeOutcomes
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The backend is unreachable." }
  }
}

/**
 * The pincodes an offer could be switched on in — those trading, with how ready each one is.
 *
 * ── Why readiness is shown beside the choice ───────────────────────────────────────────────────
 * Selecting a pincode that has fewer than three bakers with a published product produces an offer
 * that is switched on and serves nobody, and the screen would look exactly like one that works. The
 * count is fetched with the list so the choice is made knowing which ones are real today — without
 * preventing the choice, because selecting a pincode that goes live next week is a legitimate thing
 * to want.
 *
 * Read straight from the database rather than through the backend: OPS already owns this connection
 * and there is no decision here for the reward engine to make, only a list to draw.
 */
export async function getScopeCandidates(): Promise<ScopeCandidate[]> {
  const db = getDbPool()
  const { rows } = await db.query(
    `SELECT pss.pincode,
            (SELECT MIN(district) FROM baker_network.pincode_directory pd
              WHERE pd.pincode = pss.pincode) AS district,
            (SELECT COUNT(DISTINCT b.id)::int
               FROM baker_network.bakers b
              WHERE b.pincode = pss.pincode
                AND b.is_active AND b.is_public
                AND EXISTS (SELECT 1 FROM baker_network.baker_products p
                             WHERE p.baker_id = b.id AND p.publication_state = 'published')
            ) AS ready_bakers
       FROM baker_network.pincode_service_status pss
      WHERE pss.service_enabled = true
      ORDER BY pss.pincode`
  )
  return rows.map((r) => ({
    pincode: r.pincode as string,
    district: (r.district ?? null) as string | null,
    readyBakers: Number(r.ready_bakers),
  }))
}
