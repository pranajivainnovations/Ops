"use server"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL

export interface SimulatorInput {
  weight: string
  tiers?: string
  shape?: string
  style?: string
  flavor?: string
  expressDelivery?: boolean
  midnightDelivery?: boolean
  messageOnCake?: boolean
  photoOnCake?: boolean
  pincode?: string
}

export interface SimulatorResult {
  total: number
  breakdown: { label: string; amount: number }[]
}

/**
 * Calls the backend's real POST /store/ai-studio/price route — the exact same endpoint a real
 * customer's browser hits — rather than reimplementing the pricing engine's resolution logic here.
 * This is the one deliberate exception to "OPS only talks to Postgres directly": the simulator's
 * whole purpose is showing ops exactly what a real customer would see, and a second implementation of
 * the same rules would risk silently drifting from what's actually live.
 */
export async function simulatePrice(input: SimulatorInput): Promise<SimulatorResult | { error: string }> {
  if (!MEDUSA_BACKEND_URL) {
    return { error: "MEDUSA_BACKEND_URL is not configured for this OPS instance." }
  }

  let res: Response
  try {
    res = await fetch(`${MEDUSA_BACKEND_URL}/store/ai-studio/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    })
  } catch (error) {
    console.error("[pricing simulator] Failed to reach Medusa backend", error)
    return { error: "Could not reach the Medusa backend. Is it running?" }
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: data.error || "Something went wrong computing the price." }
  }

  return { total: data.total, breakdown: data.breakdown }
}
