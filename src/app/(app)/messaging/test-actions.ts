"use server"

import { getCurrentSession } from "@/lib/auth"
import { callBackend } from "@/lib/backend"

/**
 * Server action behind the messaging test panel.
 *
 * A thin pass-through to the backend's /ops/messaging/test-otp endpoint, which is where the MSG91
 * credential lives. OPS never holds that key — duplicating it here so the panel could call MSG91
 * directly would put a send-capable credential in a second place for the sake of one screen.
 */

export interface OtpTestResult {
  ok?: boolean
  error?: string | null
  retryAfterSeconds?: number | null
  kind?: string | null
  note?: string | null
  raw?: {
    httpStatus: number | null
    type: string | null
    message: string | null
    url: string
  } | null
  sentConfig?: {
    senderHeader: string
    dltTemplateId: string
    providerTemplateId: string
    otpLength: number
    otpExpiryMinutes: number
    ttlSecondsConfigured: number
  } | null
}

export async function runOtpTest(input: {
  mobile: string
  action: "send" | "verify" | "retry"
  otp?: string
}): Promise<OtpTestResult> {
  /**
   * Re-checked here rather than trusted from the layout.
   *
   * A server action is a public HTTP endpoint — the surrounding page having required a login says
   * nothing about who can POST to this. Every send costs money, so this is exactly the kind of
   * action where inheriting the page's protection is not protection.
   */
  const session = await getCurrentSession()
  if (!session) {
    return { error: "Your session has expired. Sign in again." }
  }

  // Mirrors the backend's own check so an obviously-bad number never becomes a network round trip.
  if (!/^[6-9]\d{9}$/.test(input.mobile)) {
    return { error: "Enter a valid 10-digit Indian mobile number." }
  }

  const { data, error } = await callBackend<OtpTestResult>("/ops/messaging/test-otp", {
    mobile: input.mobile,
    action: input.action,
    otp: input.otp,
  })

  if (error) return { error }
  return data ?? { error: "The backend returned nothing." }
}

/* ── Order templates ───────────────────────────────────────────────────────────────────────── */

export interface OrderSmsTestResult {
  ok?: boolean
  error?: string | null
  providerMessageId?: string | null
  sentConfig?: {
    label: string
    senderHeader: string
    dltTemplateId: string
    providerTemplateId: string
    isActive: boolean
    variables: Record<string, string>
  } | null
}

/**
 * Sends one order template to a chosen number.
 *
 * Separate from runOtpTest because it is a different MSG91 product with a different failure mode:
 * SendOTP owns its own variable, while a Flow template's variables are ours to name and MSG91
 * reports a wrong name as a success. See the backend route for why that makes a test send the only
 * way to know a template works.
 *
 * Session re-checked here for the same reason as the OTP test: a server action is a public HTTP
 * endpoint, and every send spends the account's balance.
 */
export async function runOrderSmsTest(input: {
  templateId: string
  mobile: string
}): Promise<OrderSmsTestResult> {
  const session = await getCurrentSession()
  if (!session) return { error: "Your session has expired. Sign in again." }

  if (!/^[6-9]\d{9}$/.test(input.mobile.replace(/\D/g, "").slice(-10))) {
    return { error: "Enter a valid 10-digit Indian mobile number." }
  }

  const { data, error } = await callBackend<OrderSmsTestResult>(
    "/ops/messaging/test-order-sms",
    { templateId: input.templateId, mobile: input.mobile }
  )

  if (error) return { error }
  return data ?? { error: "The backend returned nothing." }
}
