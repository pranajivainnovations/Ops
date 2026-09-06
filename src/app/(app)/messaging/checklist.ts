/**
 * The MSG91 / DLT rollout checklist.
 *
 * Exists because the blocking work sits on a TRAI portal and takes days or weeks, during which the
 * shape of what remains is easy to lose. Two kinds of step appear here and they behave differently:
 *
 *   AUTO   — derived by querying or probing. Cannot be ticked by hand, and cannot be wrong: if the
 *            page says the flow is live, it is reading that from the database this second.
 *   MANUAL — facts about the world (a form submitted, a key pasted onto a server) that no query can
 *            confirm. These get a checkbox and a note field, stored in crossfriend.rollout_task_state.
 *
 * Keeping them visibly separate is the point. A checklist where "deployed" is a checkbox somebody
 * ticked optimistically is worse than no checklist, because it is confidently wrong.
 *
 * The catalogue lives in code rather than the database, the same split site_settings uses: adding
 * or rewording a step should be a one-line edit here, not a migration.
 */

export type TaskKind = "auto" | "manual"

export interface ChecklistTask {
  key: string
  label: string
  kind: TaskKind
  /** Shown under the label. Say what "done" looks like, not what the step is called. */
  detail?: string
  /** For auto tasks: which derived signal decides this row. */
  signal?: AutoSignal
}

export type AutoSignal =
  | "tablesExist"
  | "templateExists"
  | "templateHasProviderId"
  | "flowAssigned"
  | "flowEnabled"
  | "backendRouteLive"

export interface ChecklistGroup {
  title: string
  blurb?: string
  tasks: ChecklistTask[]
}

export const CHECKLIST: ChecklistGroup[] = [
  {
    title: "1 · Code",
    blurb:
      "Written and compiling. These are listed for the record rather than tracked — they are true as soon as the branch is merged, and the deploy step below is what makes them real in production.",
    tasks: [
      {
        key: "code_backend_otp",
        kind: "manual",
        label: "Backend issues and verifies OTPs",
        detail:
          "Redis-backed store, HMAC at rest, timing-safe comparison, attempt cap, cooldown, daily cap. Routes: /store/crossfriend/otp/send and /verify.",
      },
      {
        key: "code_msg91_client",
        kind: "manual",
        label: "MSG91 Flow API client",
        detail:
          "Treats a 200 carrying {\"type\":\"error\"} as a failure, and rolls back the customer's cooldown and daily slot when delivery fails.",
      },
      {
        key: "code_storefront_proxy",
        kind: "manual",
        label: "Storefront mock replaced",
        detail:
          "The route that accepted any six digits is gone. Sign-in now creates a session only after the backend confirms the code.",
      },
      {
        key: "code_salt_fix",
        kind: "manual",
        label: "Password salt fails closed, with legacy rotation",
        detail:
          "OTP_PASSWORD_SALT no longer falls back to a hardcoded literal. Accounts created under the old fallback are rotated onto the real salt on their next sign-in.",
      },
      {
        key: "code_ops_page",
        kind: "manual",
        label: "OPS messaging configuration",
        detail: "Templates and per-flow routing, editable without a deploy.",
      },
    ],
  },

  {
    title: "2 · Database",
    tasks: [
      {
        key: "db_tables",
        kind: "auto",
        signal: "tablesExist",
        label: "Messaging tables exist on production",
        detail: "crossfriend.sms_templates and crossfriend.message_flows, with the seeded flow row.",
      },
    ],
  },

  {
    title: "3 · Server configuration",
    blurb:
      "Three secrets, not one. Two of them fail closed by design — a deploy without them leaves sign-in returning an error rather than quietly running insecure, which is the behaviour that let the previous mock survive unnoticed. None of these can be checked from OPS, because OPS deliberately has no path to read them.",
    tasks: [
      {
        key: "env_msg91_auth_key",
        kind: "manual",
        label: "MSG91_AUTH_KEY set on the backend",
        detail: "From MSG91 → Settings → API. Without it, no SMS is sent.",
      },
      {
        key: "env_otp_hash_secret",
        kind: "manual",
        label: "OTP_HASH_SECRET set on the backend",
        detail:
          "At least 32 characters — openssl rand -hex 32. OTP issuing refuses to run without it.",
      },
      {
        key: "env_otp_password_salt",
        kind: "manual",
        label: "OTP_PASSWORD_SALT set on the storefront",
        detail:
          "At least 32 characters, generated the same way. Sign-in returns 503 without it. Once set, do not change it again — every customer password is derived from it.",
      },
    ],
  },

  {
    title: "4 · DLT registration",
    blurb:
      "The long pole. Everything else can be finished while this is pending — the flow ships switched off, so nothing behaves half-configured in the meantime.",
    tasks: [
      {
        key: "dlt_entity_registered",
        kind: "manual",
        label: "Entity registered, PE ID issued",
        detail: "19 digits, against PRANAJIVA INNOVATIONS (OPC) PRIVATE LIMITED.",
      },
      {
        key: "dlt_whois_updated",
        kind: "manual",
        label: "WHOIS shows the company as Registrant Organization",
        detail:
          "Verify with: whois crossfriend.in | grep -i \"Registrant Organization\". This is what links the domain to the entity for the header application.",
      },
      {
        key: "dlt_website_evidence",
        kind: "manual",
        label: "Website names the entity",
        detail:
          "crossfriend.in/about, /contact, the footer and Terms §1 all state the brand is owned and operated by the company, with the CIN. Requires the storefront deploy below.",
      },
      {
        key: "dlt_header_submitted",
        kind: "manual",
        label: "Header (sender ID) submitted",
        detail: "3–11 alphanumeric characters.",
      },
      {
        key: "dlt_header_approved",
        kind: "manual",
        label: "Header approved",
        detail: "Record the exact approved string — it goes into OPS verbatim.",
      },
      {
        key: "dlt_template_submitted",
        kind: "manual",
        label: "OTP template submitted",
        detail:
          "Register under the Service Implicit category, with {#var#} where the code goes. Naming the company in the body helps, given the header was previously refused for exactly that link.",
      },
      {
        key: "dlt_template_approved",
        kind: "manual",
        label: "Template approved, template ID issued",
        detail: "19 digits. Goes into OPS as the DLT template ID.",
      },
    ],
  },

  {
    title: "5 · MSG91 setup",
    tasks: [
      {
        key: "msg91_account",
        kind: "manual",
        label: "Account created and auth key issued",
      },
      {
        key: "msg91_dlt_linked",
        kind: "manual",
        label: "PE ID and sender ID added to MSG91",
        detail: "Under MSG91's DLT section, so it will accept sends under that header.",
      },
      {
        key: "msg91_flow_created",
        kind: "manual",
        label: "Flow created, MSG91 template ID issued",
        detail:
          "A 24-character hex string, different from the DLT ID. Nothing sends without it.",
      },
      {
        key: "msg91_variable_named_otp",
        kind: "manual",
        label: "Flow variable is named exactly 'otp', lowercase",
        detail:
          "MSG91 maps variables by name and does NOT error on a mismatch — it substitutes an empty string and delivers \"Your code is .\" This failure is invisible from every dashboard, so confirm it deliberately.",
      },
    ],
  },

  {
    title: "6 · Deploy",
    blurb:
      "Backend first: the storefront's verify route calls it, so shipping the storefront ahead of the backend makes sign-in fail until the backend catches up.",
    tasks: [
      {
        key: "deploy_backend",
        kind: "auto",
        signal: "backendRouteLive",
        label: "Backend deployed with the OTP routes",
        detail:
          "Probed live by asking the send route about an unknown flow — it answers before touching Redis, the database or MSG91, so this check sends no SMS and costs nothing.",
      },
      {
        key: "deploy_storefront",
        kind: "manual",
        label: "Storefront deployed",
        detail: "Carries the proxy routes, the salt fix, and the /about and /contact pages DLT needs.",
      },
      {
        key: "deploy_ops",
        kind: "manual",
        label: "OPS deployed",
        detail: "Needed before the configuration below can be entered on the server.",
      },
    ],
  },

  {
    title: "7 · OPS configuration",
    blurb: "All derived from the database — these tick themselves as you fill the Messaging page in.",
    tasks: [
      {
        key: "ops_template_added",
        kind: "auto",
        signal: "templateExists",
        label: "SMS template added",
      },
      {
        key: "ops_template_provider_id",
        kind: "auto",
        signal: "templateHasProviderId",
        label: "Template carries an MSG91 template ID",
      },
      {
        key: "ops_flow_assigned",
        kind: "auto",
        signal: "flowAssigned",
        label: "AI Studio sign-in points at a template",
      },
      {
        key: "ops_flow_enabled",
        kind: "auto",
        signal: "flowEnabled",
        label: "Flow switched live",
      },
    ],
  },

  {
    title: "8 · Verification",
    blurb: "Do these on the real site, with a real handset. Nothing above proves a message arrives.",
    tasks: [
      {
        key: "verify_sms_received",
        kind: "manual",
        label: "A real code arrives on a real phone",
        detail: "Check the sender header shown on the handset matches the approved one.",
      },
      {
        key: "verify_body_has_code",
        kind: "manual",
        label: "The message contains the digits",
        detail:
          "If it reads \"Your code is .\" the MSG91 variable is not named otp. This is the most likely failure and the easiest to miss.",
      },
      {
        key: "verify_wrong_code_rejected",
        kind: "manual",
        label: "A wrong code is refused",
        detail:
          "Type six wrong digits. It must fail. This is the exact defect being replaced — the old route accepted any six digits, so confirm it directly rather than assuming.",
      },
      {
        key: "verify_expiry",
        kind: "manual",
        label: "An expired code is refused",
        detail: "Wait past the configured validity, then submit the code you received.",
      },
      {
        key: "verify_attempt_cap",
        kind: "manual",
        label: "Attempt cap engages",
        detail: "Enter the wrong code past the configured limit; it should ask for a new one.",
      },
      {
        key: "verify_existing_customer",
        kind: "manual",
        label: "An account created before this change can still sign in",
        detail:
          "Use a number that signed in under the old flow. It should work and be silently rotated onto the new salt.",
      },
    ],
  },
]

export const ALL_TASK_KEYS = CHECKLIST.flatMap((g) => g.tasks.map((t) => t.key))
export const TASK_BY_KEY: Record<string, ChecklistTask> = Object.fromEntries(
  CHECKLIST.flatMap((g) => g.tasks).map((t) => [t.key, t])
)
