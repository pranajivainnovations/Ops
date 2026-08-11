import Image from "next/image"
import Link from "next/link"
import { getDbPool } from "@/lib/db"
import { setDesignVisibility } from "./actions"

export const dynamic = "force-dynamic"

/**
 * Every AI-generated design, public and private, newest first.
 *
 * Exists for one reason: designs are generated from free-text prompts by anyone with an account, and
 * nothing else in the system ever shows the team what was actually produced. A customer can make a
 * design private, which hides it from the community gallery — it does not, and must not, hide it
 * from us. The image sits in our S3 bucket and the prompt was run through our AI credits; if someone
 * generates something illegal or abusive, being unable to see it is not a defence.
 *
 * Read-only on purpose. Taking a design down is a decision with a customer on the other end of it,
 * so it is left as a deliberate database action for now rather than a button that is easy to hit by
 * accident. The `status` column already supports it — nothing here needs to change to add that later.
 */

interface Row {
  id: string
  image_url: string
  prompt: string
  style: string | null
  occasion: string | null
  flavor: string | null
  weight: string | null
  tiers: string | null
  customer_id: string | null
  is_public: boolean
  status: string
  created_at: string
  reference_purpose: string | null
}

const PAGE_SIZE = 60

export default async function DesignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>
}) {
  const { q, filter, page } = await searchParams
  const query = (q || "").trim()
  const view = filter === "private" || filter === "public" ? filter : "all"
  const pageNum = Math.max(1, Number(page) || 1)
  const offset = (pageNum - 1) * PAGE_SIZE

  const db = getDbPool()

  // $1::varchar and $2::varchar are required, not decorative: Postgres cannot infer a type for a
  // parameter that only ever appears inside a CASE/OR, and raises 42P08 at prepare time. Same fix as
  // the baker update path.
  const where = `
    ($1::varchar IS NULL OR d.prompt ILIKE '%' || $1::varchar || '%' OR d.customer_id = $1::varchar)
    AND ($2::varchar IS NULL OR ($2::varchar = 'public' AND d.is_public) OR ($2::varchar = 'private' AND NOT d.is_public))
  `

  const [rows, totals] = await Promise.all([
    db.query<Row>(
      `SELECT d.id, d.image_url, d.prompt, d.style, d.occasion, d.flavor,
              d.weight, d.tiers, d.customer_id, d.is_public, d.status, d.created_at,
              u.purpose AS reference_purpose
       FROM ai_studio.cake_designs d
       -- A design generated from an uploaded photo of a real person is the one the team most needs
       -- to see, so the upload's purpose is surfaced in the row rather than hidden a click away.
       LEFT JOIN ai_studio.personal_uploads u ON u.generation_id = d.generation_id
       WHERE ${where}
       ORDER BY d.created_at DESC
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      [query || null, view === "all" ? null : view]
    ),
    db.query<{ total: number; public_count: number; private_count: number; photo_count: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE d.is_public)::int AS public_count,
              count(*) FILTER (WHERE NOT d.is_public)::int AS private_count,
              count(*) FILTER (WHERE u.purpose = 'photo_cake')::int AS photo_count
       FROM ai_studio.cake_designs d
       LEFT JOIN ai_studio.personal_uploads u ON u.generation_id = d.generation_id`
    ),
  ])

  const t = totals.rows[0]
  const tab = (key: string, label: string, count: number) => {
    const active = view === key || (key === "all" && view === "all")
    const href = key === "all" ? "/designs" : `/designs?filter=${key}`
    return (
      <Link
        key={key}
        href={query ? `${href}${key === "all" ? "?" : "&"}q=${encodeURIComponent(query)}` : href}
        className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
          active ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
        }`}
      >
        {label} <span className="tabular-nums opacity-70">{count}</span>
      </Link>
    )
  }

  return (
    <main className="min-h-screen flex-1 bg-slate-50 p-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-4">
          <h1 className="text-lg font-bold text-slate-900">AI Designs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Everything customers have generated, private designs included. Private only hides a
            design from the public gallery — it is still ours, still stored, and still visible here.
          </p>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {tab("all", "All", t.total)}
          {tab("public", "In gallery", t.public_count)}
          {tab("private", "Private", t.private_count)}
          {t.photo_count > 0 && (
            <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-900">
              From a photo <span className="tabular-nums">{t.photo_count}</span>
            </span>
          )}

          <form className="ml-auto flex gap-2" action="/designs">
            {view !== "all" && <input type="hidden" name="filter" value={view} />}
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search prompt text or customer id"
              className="w-72 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white">
              Search
            </button>
          </form>
        </div>

        {rows.rows.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No designs match.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.rows.map((d) => (
              <article
                key={d.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                {/* Resized and re-encoded by Next rather than served as the full-resolution S3
                    original. `sizes` matters as much as the component here: without it every tile
                    would request an image sized for the whole viewport, which is most of what made
                    the unoptimised version expensive. */}
                <div className="relative aspect-square w-full bg-slate-100">
                  <Image
                    src={d.image_url}
                    alt={d.prompt?.slice(0, 80) || "AI generated cake design"}
                    fill
                    sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        d.is_public
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {d.is_public ? "In gallery" : "Private"}
                    </span>
                    {d.reference_purpose === "photo_cake" && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                        From a photo
                      </span>
                    )}
                    {d.status !== "active" && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-800">
                        {d.status}
                      </span>
                    )}
                  </div>

                  <p className="line-clamp-3 text-xs leading-relaxed text-slate-700">{d.prompt}</p>

                  <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    {d.style && <span>{d.style}</span>}
                    {d.occasion && <span>· {d.occasion}</span>}
                    {d.weight && <span>· {d.weight} kg</span>}
                    {d.tiers && <span>· {d.tiers} tier</span>}
                  </dl>

                  <p className="mt-2 truncate text-[10px] text-slate-400" title={d.customer_id ?? ""}>
                    {d.customer_id ?? "no customer"} ·{" "}
                    {new Date(d.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>

                  {/* A plain form post, so this works with no client JS and cannot end up in a
                      half-toggled state on a flaky connection. The action re-reads the current value
                      rather than trusting a hidden field, so a double submit is idempotent. */}
                  <form
                    action={async () => {
                      "use server"
                      await setDesignVisibility(d.id, !d.is_public)
                    }}
                    className="mt-2"
                  >
                    <button
                      type="submit"
                      className={`w-full rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                        d.is_public
                          ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {d.is_public ? "Remove from gallery" : "Put in gallery"}
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}

        {(pageNum > 1 || rows.rows.length === PAGE_SIZE) && (
          <nav className="mt-6 flex items-center justify-between">
            {pageNum > 1 ? (
              <Link
                href={`/designs?page=${pageNum - 1}${view !== "all" ? `&filter=${view}` : ""}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-slate-500">Page {pageNum}</span>
            {rows.rows.length === PAGE_SIZE ? (
              <Link
                href={`/designs?page=${pageNum + 1}${view !== "all" ? `&filter=${view}` : ""}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </main>
  )
}
