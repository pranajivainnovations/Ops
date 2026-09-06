import { getDbPool } from "@/lib/db"

import type { AutoSignal } from "./checklist"

/**
 * The derived half of the rollout checklist.
 *
 * Everything here is measured at request time rather than remembered. That is the entire reason
 * this page exists rather than a markdown file: a checklist that records what somebody believed
 * three weeks ago is exactly as confident as one reading live state, and wrong far more often.
 */

export type SignalState = "done" | "pending" | "unknown"

export interface TaskState {
  isDone: boolean
  note: string
  updatedAt: string | null
  updatedBy: string | null
}

export async function getTaskStates(): Promise<Record<string, TaskState>> {
  const db = getDbPool()
  const result = await db.query(
    `SELECT s.task_key, s.is_done, s.note, s.updated_at, u.name AS who
       FROM crossfriend.rollout_task_state s
       LEFT JOIN baker_network.ops_users u ON u.id = s.updated_by`
  )

  const states: Record<string, TaskState> = {}
  for (const row of result.rows) {
    states[row.task_key] = {
      isDone: row.is_done === true,
      note: row.note ?? "",
      updatedAt: row.updated_at,
      updatedBy: row.who,
    }
  }
  return states
}

/**
 * Probes the backend by asking the OTP send route about a flow it does not recognise.
 *
 * The route validates the flow key before it reads configuration, touches Redis or calls MSG91, so
 * a 400 proves the code is deployed while sending nothing and costing nothing. A 404 means the
 * running backend predates this work. Anything else is reported as unknown rather than guessed at.
 *
 * Uses a probe rather than the /store/build commit hash because a commit tells you what was built,
 * not whether this particular route survived into the image.
 */
async function probeBackendRoute(): Promise<SignalState> {
  const url =
    process.env.MEDUSA_BACKEND_URL?.replace(/\/$/, "") ?? "https://api.pranajiva.in"

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(`${url}/store/crossfriend/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // A key that can never be in ALLOWED_FLOWS, so the route refuses at its first branch.
      body: JSON.stringify({ flow: "__ops_probe__", mobile: "0000000000" }),
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))

    if (res.status === 400) return "done"
    if (res.status === 404) return "pending"
    return "unknown"
  } catch {
    return "unknown"
  }
}

export async function getAutoSignals(): Promise<Record<AutoSignal, SignalState>> {
  const db = getDbPool()

  const [tables, templates, flow, backendRoute] = await Promise.all([
    db.query(
      `SELECT to_regclass('crossfriend.sms_templates')  AS templates,
              to_regclass('crossfriend.message_flows')  AS flows`
    ),
    db.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE provider_template_id <> '' AND is_active)::int AS usable
         FROM crossfriend.sms_templates`
    ),
    db.query(
      `SELECT template_id, is_enabled
         FROM crossfriend.message_flows
        WHERE flow_key = 'ai_studio_login'`
    ),
    probeBackendRoute(),
  ])

  const tablesExist =
    tables.rows[0]?.templates && tables.rows[0]?.flows ? "done" : "pending"
  const flowRow = flow.rows[0]

  return {
    tablesExist,
    templateExists: templates.rows[0].total > 0 ? "done" : "pending",
    templateHasProviderId: templates.rows[0].usable > 0 ? "done" : "pending",
    flowAssigned: flowRow?.template_id ? "done" : "pending",
    flowEnabled: flowRow?.is_enabled === true ? "done" : "pending",
    backendRouteLive: backendRoute,
  }
}
