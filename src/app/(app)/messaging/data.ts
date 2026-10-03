import { getDbPool } from "@/lib/db"

/**
 * Reads the SMS templates registered with DLT and the flows that send through them.
 *
 * Deliberately does not read a provider auth key, because there isn't one to read. That credential
 * lives in the backend environment and OPS has no path to it — see the note on the messaging
 * migration for why the line is drawn there rather than "everything in one place".
 */

export interface SmsTemplate {
  id: string
  label: string
  senderHeader: string
  dltTemplateId: string
  providerTemplateId: string
  bodyPreview: string
  isActive: boolean
  updatedAt: string
  updatedBy: string | null
  /** Flows currently pointed at this template — a template in use cannot be deleted. */
  usedByFlows: string[]
}

export interface MessageFlow {
  flowKey: string
  label: string
  description: string
  templateId: string | null
  otpLength: number
  otpTtlSeconds: number
  maxAttempts: number
  resendCooldownSeconds: number
  dailySendLimit: number
  isEnabled: boolean
  updatedAt: string
  updatedBy: string | null
}

export async function getTemplates(): Promise<SmsTemplate[]> {
  const db = getDbPool()
  const result = await db.query(
    `SELECT t.id,
            t.label,
            t.sender_header,
            t.dlt_template_id,
            t.provider_template_id,
            t.body_preview,
            t.is_active,
            t.updated_at,
            u.name AS who,
            COALESCE(
              ARRAY_AGG(f.label ORDER BY f.label) FILTER (WHERE f.flow_key IS NOT NULL),
              '{}'
            ) AS used_by
       FROM crossfriend.sms_templates t
       LEFT JOIN baker_network.ops_users u ON u.id = t.updated_by
       LEFT JOIN crossfriend.message_flows f ON f.template_id = t.id
      GROUP BY t.id, u.name
      ORDER BY t.sender_header, t.label`
  )

  return result.rows.map((row) => ({
    id: row.id,
    label: row.label,
    senderHeader: row.sender_header,
    dltTemplateId: row.dlt_template_id,
    providerTemplateId: row.provider_template_id ?? "",
    bodyPreview: row.body_preview ?? "",
    isActive: row.is_active === true,
    updatedAt: row.updated_at,
    updatedBy: row.who,
    usedByFlows: row.used_by ?? [],
  }))
}

export async function getFlows(): Promise<MessageFlow[]> {
  const db = getDbPool()
  const result = await db.query(
    `SELECT f.flow_key,
            f.label,
            f.description,
            f.template_id,
            f.otp_length,
            f.otp_ttl_seconds,
            f.max_attempts,
            f.resend_cooldown_seconds,
            f.daily_send_limit,
            f.is_enabled,
            f.updated_at,
            u.name AS who
       FROM crossfriend.message_flows f
       LEFT JOIN baker_network.ops_users u ON u.id = f.updated_by
      ORDER BY f.label`
  )

  return result.rows.map((row) => ({
    flowKey: row.flow_key,
    label: row.label,
    description: row.description ?? "",
    templateId: row.template_id,
    otpLength: Number(row.otp_length),
    otpTtlSeconds: Number(row.otp_ttl_seconds),
    maxAttempts: Number(row.max_attempts),
    resendCooldownSeconds: Number(row.resend_cooldown_seconds),
    dailySendLimit: Number(row.daily_send_limit),
    isEnabled: row.is_enabled === true,
    updatedAt: row.updated_at,
    updatedBy: row.who,
  }))
}

/**
 * The bounds the database enforces, restated so the form can show them and the action can check
 * them before the insert. Kept as one exported object rather than duplicated in three files —
 * a CHECK constraint the UI disagrees with surfaces as a 500 instead of a field error.
 */
export const FLOW_LIMITS = {
  otpLength: { min: 4, max: 8 },
  otpTtlSeconds: { min: 60, max: 900 },
  maxAttempts: { min: 3, max: 10 },
  resendCooldownSeconds: { min: 15, max: 300 },
  dailySendLimit: { min: 1, max: 50 },
} as const

/**
 * Which template answers which order status.
 *
 * ── Why these are rows and not code ────────────────────────────────────────────────────────────
 * Every transactional SMS in India needs a DLT-registered template, approved per sender header, and
 * approvals come back weeks apart one at a time. Holding the mapping in the database means each
 * approval is an edit on this screen rather than a deploy — and the sending code, which ships before
 * any of them exist, simply does nothing until a row names a template.
 */
export interface OrderNotifyRule {
  brand: string
  status: string
  templateId: string | null
  templateLabel: string | null
  isEnabled: boolean
  note: string | null
  updatedBy: string | null
  updatedAt: string | null
  /** How many customers have actually been told this, ever. */
  sentCount: number
  lastError: string | null
}

export async function getOrderNotifyRules(): Promise<OrderNotifyRule[]> {
  const { rows } = await getDbPool().query<{
    brand: string
    status: string
    template_id: string | null
    template_label: string | null
    is_enabled: boolean
    note: string | null
    updated_by: string | null
    updated_at: string | null
    sent_count: number
    last_error: string | null
  }>(
    `SELECT r.brand, r.status, r.template_id, t.label AS template_label,
            r.is_enabled, r.note, r.updated_by, r.updated_at,
            (SELECT count(*)::int FROM orders.notifications n
              WHERE n.status = r.status AND n.sent_ok) AS sent_count,
            (SELECT n.error FROM orders.notifications n
              WHERE n.status = r.status AND NOT n.sent_ok
              ORDER BY n.sent_at DESC LIMIT 1) AS last_error
       FROM orders.notify_rules r
       LEFT JOIN crossfriend.sms_templates t ON t.id = r.template_id
      ORDER BY r.brand,
               /* The order a customer meets them in, not alphabetical. */
               array_position(
                 ARRAY['paid','accepted','making','out_for_delivery','delivered','cancelled'],
                 r.status)`
  )

  return rows.map((r) => ({
    brand: r.brand,
    status: r.status,
    templateId: r.template_id,
    templateLabel: r.template_label,
    isEnabled: r.is_enabled,
    note: r.note,
    updatedBy: r.updated_by,
    updatedAt: r.updated_at,
    sentCount: r.sent_count,
    lastError: r.last_error,
  }))
}
