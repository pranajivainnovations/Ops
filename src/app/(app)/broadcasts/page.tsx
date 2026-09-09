import { broadcastSchemaReady, isPushConfigured } from "@/lib/push"
import { deleteCampaign, sendBroadcast } from "./actions"
import { loadAudience, loadCampaigns, type Campaign } from "./data"

/**
 * Sending a notification to the people who visit the shop.
 *
 * ── Why this is a separate page from Announcements ─────────────────────────────────────────────
 * They look similar and they are not the same act. An announcement waits on the site for somebody to
 * arrive, can be edited after publishing and taken down in seconds. A push interrupts a person
 * wherever they are, cannot be edited, cannot be recalled, and is the fastest way to lose an
 * audience permanently. Putting them on one screen behind a checkbox would make the reversible thing
 * and the irreversible thing look like the same decision.
 *
 * ── Why the audience is shown before the composer, not after ───────────────────────────────────
 * The number of people about to be interrupted is the most important fact on this screen, and it has
 * to be read before the message is written rather than discovered underneath the send button. "This
 * goes to 4,120 phones" changes what somebody writes.
 */
export const dynamic = "force-dynamic"

export default async function BroadcastsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  if (!(await broadcastSchemaReady())) {
    return (
      <Shell>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">The push tables have not been created yet</p>
          <p className="mt-1 max-w-2xl text-xs text-amber-800">
            Run the <span className="font-mono">CreateCustomerPush</span> migration on the backend,
            then reload. Nothing else needs to change — the page finds the tables on its own.
          </p>
        </div>
      </Shell>
    )
  }

  const [audience, campaigns] = await Promise.all([loadAudience(), loadCampaigns()])
  const configured = isPushConfigured()

  return (
    <Shell>
      {params.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {params.error}
        </p>
      )}

      {!configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">Push is not configured on this server</p>
          <p className="mt-1 max-w-2xl text-xs text-amber-800">
            Set <code className="rounded bg-amber-100 px-1">VAPID_PUBLIC_KEY</code> and{" "}
            <code className="rounded bg-amber-100 px-1">VAPID_PRIVATE_KEY</code> here, and the same
            public key on the storefront so visitors can subscribe. Sending is disabled until both
            ends have it.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Will receive" value={audience.live} tone="strong" hint="Devices right now" />
        <Stat label="New this week" value={audience.recent} hint="Subscribed in 7 days" />
        <Stat label="Turned off" value={audience.revoked} hint="Opted out themselves" />
        <Stat label="Gone" value={audience.dead} hint="Browser or profile removed" />
      </div>

      <Composer live={audience.live} disabled={!configured} />

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Already sent ({campaigns.length})
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {/* The reason this list is here at all. */}
          Check this before sending — most duplicate notifications are two people who each thought
          the other had not done it yet.
        </p>
        <div className="mt-3 space-y-2">
          {campaigns.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
              Nothing has been sent yet.
            </p>
          )}
          {campaigns.map((campaign) => (
            <CampaignRow key={campaign.id} campaign={campaign} />
          ))}
        </div>
      </section>
    </Shell>
  )
}

function Composer({ live, disabled }: { live: number; disabled: boolean }) {
  return (
    <form
      action={sendBroadcast}
      encType="multipart/form-data"
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <div>
        <h2 className="text-sm font-bold text-slate-900">New notification</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          This reaches <strong className="text-slate-700">{live.toLocaleString("en-IN")}</strong>{" "}
          device{live === 1 ? "" : "s"} immediately. It cannot be edited or taken back.
        </p>
      </div>

      <Field label="Headline" hint="Up to 80 characters. Phones truncate around 40.">
        <input
          type="text"
          name="title"
          maxLength={80}
          required
          placeholder="New Diwali cake styles are live"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        />
      </Field>

      <Field label="Message" hint="Up to 180 characters. Say the thing; the tap is the detail.">
        <textarea
          name="body"
          rows={2}
          maxLength={180}
          required
          placeholder="Twelve new designs, ready to customise. Tap to have a look."
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Opens" hint="A path like /ai-cake-studio, or a full URL.">
          <input
            type="text"
            name="url"
            defaultValue="/ai-cake-studio"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
        </Field>

        <Field label="Icon" hint="Optional. Shown small — a logo reads better than a photo.">
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            className="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
          />
        </Field>
      </div>

      {/* The last gate. See actions.ts for why it is typed rather than ticked. */}
      <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
        <Field label="Type SEND to confirm" hint="There is no undo.">
          <input
            type="text"
            name="confirm"
            autoComplete="off"
            placeholder="SEND"
            className="w-40 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold uppercase tracking-wide focus:border-red-400 focus:outline-none"
          />
        </Field>
        <button
          type="submit"
          disabled={disabled || live === 0}
          className="ml-auto rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          Send to {live.toLocaleString("en-IN")}
        </button>
      </div>
    </form>
  )
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const tone =
    campaign.status === "sent"
      ? "bg-emerald-100 text-emerald-800"
      : campaign.status === "sending"
        ? "bg-amber-100 text-amber-800"
        : campaign.status === "failed"
          ? "bg-red-100 text-red-800"
          : "bg-slate-100 text-slate-600"

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>
          {campaign.status}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{campaign.title}</p>
        {campaign.status === "sent" && (
          <span className="shrink-0 text-xs tabular-nums text-slate-500">
            {campaign.sentCount.toLocaleString("en-IN")} delivered
            {campaign.failedCount > 0 ? ` · ${campaign.failedCount} failed` : ""}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-600">{campaign.body}</p>
      <p className="mt-1 text-[11px] text-slate-400">
        {campaign.createdBy ?? "Unknown"} ·{" "}
        {(campaign.sentAt ?? campaign.createdAt).toLocaleString("en-IN", {
          // The server runs in UTC; without this every timestamp on this page reads five and a half
          // hours early. Same rule as the team board.
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · opens {campaign.url}
      </p>

      {campaign.status !== "sent" && (
        <form action={deleteCampaign} className="mt-2">
          <input type="hidden" name="id" value={campaign.id} />
          <button
            type="submit"
            className="text-[11px] font-semibold text-slate-400 underline underline-offset-2 transition hover:text-red-500"
          >
            Remove from list
          </button>
        </form>
      )}
    </article>
  )
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: number
  hint: string
  tone?: "default" | "strong"
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone === "strong" ? "text-slate-900" : "text-slate-500"
        }`}
      >
        {value.toLocaleString("en-IN")}
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Notifications</h1>
        <p className="mt-0.5 max-w-3xl text-xs text-slate-500">
          Push messages to visitors who asked to be notified. Unlike an announcement, this reaches
          people who are not on the site — and once sent it cannot be edited or taken back.
        </p>
      </header>
      <div className="space-y-5 p-6">{children}</div>
    </main>
  )
}
