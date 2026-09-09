import { getDbPool } from "@/lib/db"
import { deleteAnnouncement, saveAnnouncement, setPublished } from "./actions"
import { THEMES } from "./themes"

/**
 * Announcements — the banner every storefront visitor sees.
 *
 * ── The one thing this screen has to make obvious ──────────────────────────────────────────────
 * Which announcement is live. Everything else here is editing; that single fact is the one somebody
 * needs at a glance, because the cost of being wrong about it is that the whole site is saying
 * something nobody meant. So the live one is pinned at the top, in its own colour, labelled.
 *
 * ── Why the composer is a fixed shape ──────────────────────────────────────────────────────────
 * A rich-text editor storing HTML was the obvious build and is the wrong one for a public page: it
 * is an injection surface, and even when safe it lets somebody publish a layout that is broken on a
 * phone before anybody notices. Fixed fields — headline, message, image, colour, one button — cover
 * what was actually wanted while making an off-brand or dangerous result impossible.
 */
export const dynamic = "force-dynamic"

interface Row {
  id: string
  title: string
  body: string
  image_url: string | null
  theme: string
  cta_label: string | null
  cta_url: string | null
  starts_at: Date | null
  ends_at: Date | null
  is_published: boolean
  author: string | null
  created_at: Date
}

async function schemaReady(): Promise<boolean> {
  const { rows } = await getDbPool().query<{ ready: boolean }>(
    `SELECT to_regclass('crossfriend.announcements') IS NOT NULL AS ready`
  )
  return Boolean(rows[0]?.ready)
}

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; edit?: string }>
}) {
  const params = await searchParams

  if (!(await schemaReady())) {
    return (
      <Shell>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">The announcements table does not exist yet</p>
          <p className="mt-1 max-w-2xl text-xs text-amber-800">
            Run the <span className="font-mono">CreateAnnouncements</span> migration on the backend,
            then reload.
          </p>
        </div>
      </Shell>
    )
  }

  const { rows } = await getDbPool().query<Row>(
    `SELECT a.*, COALESCE(u.name, u.email) AS author
       FROM crossfriend.announcements a
       LEFT JOIN baker_network.ops_users u ON u.id = a.created_by
      ORDER BY a.is_published DESC, a.created_at DESC`
  )

  const editing = params.edit ? rows.find((r) => r.id === params.edit) ?? null : null
  const live = rows.find((r) => r.is_published && isWithinWindow(r)) ?? null

  return (
    <Shell>
      {params.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {params.error}
        </p>
      )}

      {/* The answer to "what are customers seeing right now", before anything else on the page. */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          On the site right now
        </p>
        {live ? (
          <div className="mt-2">
            <Preview row={live} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Nothing. Publish an announcement below and it appears on every page.
          </p>
        )}
      </section>

      <Composer editing={editing} />

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
          All announcements ({rows.length})
        </h2>
        <div className="mt-2 flex flex-col gap-2">
          {rows.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-xs text-slate-500">
              None yet.
            </p>
          )}
          {rows.map((row) => (
            <AnnouncementRow key={row.id} row={row} />
          ))}
        </div>
      </section>
    </Shell>
  )
}

function isWithinWindow(row: Row): boolean {
  const now = Date.now()
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return false
  if (row.ends_at && new Date(row.ends_at).getTime() <= now) return false
  return true
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Announcements</h1>
        <p className="mt-0.5 max-w-3xl text-xs text-slate-500">
          A banner shown to every visitor on crossfriend.in. One is live at a time — publishing a new
          one retires the last.
        </p>
      </header>
      <div className="space-y-5 p-6">{children}</div>
    </main>
  )
}

/** What the customer will see, rendered from the same fields the storefront reads. */
function Preview({ row }: { row: Row }) {
  const theme = THEMES.find((t) => t.key === row.theme) ?? THEMES[0]

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 ${theme.swatch}`}>
      {row.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.image_url}
          alt=""
          className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-white/40"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{row.title}</p>
        {row.body && <p className="mt-0.5 text-xs opacity-90">{row.body}</p>}
      </div>
      {row.cta_label && (
        <span className="shrink-0 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-900">
          {row.cta_label}
        </span>
      )}
    </div>
  )
}

function AnnouncementRow({ row }: { row: Row }) {
  const scheduled = row.starts_at && new Date(row.starts_at).getTime() > Date.now()
  const expired = row.ends_at && new Date(row.ends_at).getTime() <= Date.now()

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <Preview row={row} />

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        {row.is_published ? (
          expired ? (
            <Chip tone="slate">Published, but the end date has passed</Chip>
          ) : scheduled ? (
            <Chip tone="sky">Published, starts {formatDate(row.starts_at!)}</Chip>
          ) : (
            <Chip tone="emerald">Live</Chip>
          )
        ) : (
          <Chip tone="slate">Draft</Chip>
        )}
        {row.ends_at && !expired && <span>ends {formatDate(row.ends_at)}</span>}
        {row.author && <span>· by {row.author}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <form action={setPublished}>
          <input type="hidden" name="id" value={row.id} />
          {!row.is_published && <input type="hidden" name="publish" value="on" />}
          <button
            type="submit"
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              row.is_published
                ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {row.is_published ? "Take it down" : "Publish"}
          </button>
        </form>

        <a
          href={`/announcements?edit=${row.id}`}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Edit
        </a>

        <form action={deleteAnnouncement} className="ml-auto">
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            className="text-[11px] font-semibold text-slate-300 underline underline-offset-2 transition hover:text-red-500"
          >
            Delete
          </button>
        </form>
      </div>
    </article>
  )
}

function Composer({ editing }: { editing: Row | null }) {
  return (
    <form
      action={saveAnnouncement}
      encType="multipart/form-data"
      className="space-y-3 rounded-xl border-2 border-slate-300 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">
          {editing ? "Edit announcement" : "New announcement"}
        </p>
        {editing && (
          <a href="/announcements" className="text-[11px] font-semibold text-slate-400 underline">
            Cancel
          </a>
        )}
      </div>
      {editing && <input type="hidden" name="id" value={editing.id} />}
      {editing?.image_url && (
        <input type="hidden" name="existing_image_url" value={editing.image_url} />
      )}

      <Field label="Headline" hint="Short. This is the line people actually read.">
        <input
          name="title"
          required
          maxLength={120}
          defaultValue={editing?.title ?? ""}
          placeholder="Free delivery across Delhi NCR this Diwali"
          className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        />
      </Field>

      <Field label="Message" hint="Optional. One or two lines at most — a banner is not a page.">
        <textarea
          name="body"
          rows={2}
          maxLength={600}
          defaultValue={editing?.body ?? ""}
          className="w-full resize-none rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        />
      </Field>

      <Field label="Colour" hint="Chosen pairs — the text is always readable on the background.">
        <div className="grid gap-2 sm:grid-cols-2">
          {THEMES.map((theme) => (
            <label
              key={theme.key}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-2 transition hover:bg-slate-50"
            >
              <input
                type="radio"
                name="theme"
                value={theme.key}
                defaultChecked={(editing?.theme ?? "purple") === theme.key}
                className="accent-slate-900"
              />
              <span className={`rounded px-2 py-1 text-[11px] font-bold ${theme.swatch}`}>
                {theme.label}
              </span>
              <span className="min-w-0 flex-1 text-[10px] leading-tight text-slate-500">
                {theme.hint}
              </span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Image" hint="Optional, shown small beside the text. JPEG, PNG or WEBP, under 8MB.">
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          className="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        />
        {editing?.image_url && (
          <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
            <input type="checkbox" name="remove_image" className="h-3 w-3" />
            Remove the current image
          </label>
        )}
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Button label" hint="Leave both blank for no button.">
          <input
            name="cta_label"
            maxLength={40}
            defaultValue={editing?.cta_label ?? ""}
            placeholder="Design a cake"
            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
        </Field>
        <Field label="Button link" hint="A path like /ai-cake-studio, or a full https address.">
          <input
            name="cta_url"
            defaultValue={editing?.cta_url ?? ""}
            placeholder="/ai-cake-studio"
            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Starts" hint="Optional. Blank means as soon as it is published.">
          <input
            type="datetime-local"
            name="starts_at"
            defaultValue={toLocalInput(editing?.starts_at ?? null)}
            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
        </Field>
        <Field label="Ends" hint="Optional, but a banner with no end tends to become furniture.">
          <input
            type="datetime-local"
            name="ends_at"
            defaultValue={toLocalInput(editing?.ends_at ?? null)}
            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
        </Field>
      </div>

      {/* Saving never publishes. Two steps, because "customers can see this" should be a decision
          somebody takes deliberately rather than a side effect of pressing Save. */}
      <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700"
        >
          {editing ? "Save changes" : "Save as draft"}
        </button>
        <p className="text-[11px] text-slate-400">
          Saving does not publish — use Publish on the row below.
        </p>
      </div>
    </form>
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
      <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {hint && <span className="mb-1 block text-[10px] text-slate-400">{hint}</span>}
      {children}
    </label>
  )
}

function Chip({ tone, children }: { tone: "emerald" | "sky" | "slate"; children: React.ReactNode }) {
  const style = {
    emerald: "bg-emerald-100 text-emerald-800",
    sky: "bg-sky-100 text-sky-800",
    slate: "bg-slate-100 text-slate-600",
  }[tone]
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style}`}>{children}</span>
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** datetime-local wants local wall-clock without a zone; the database stores the instant. */
function toLocalInput(date: Date | null): string {
  if (!date) return ""
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
