import Link from "next/link"

import { dollars, listReels } from "@/lib/social/reels"
import { SectionHeader } from "./_components/header"
import NewReelForm from "./new-reel-form"

export const dynamic = "force-dynamic"

const STATUS_CHIP: Record<string, string> = {
  building: "bg-amber-100 text-amber-900",
  done: "bg-emerald-100 text-emerald-800",
  abandoned: "bg-slate-100 text-slate-500",
}

/**
 * Every reel, and the form to start another.
 *
 * ── Why the cost is on every row ──────────────────────────────────────────────────────────────
 * Because it is the number that changes behaviour. A reel is a chain of calls at roughly ten cents
 * a second against somebody's own card, and a list that showed only how long each one runs would
 * hide the thing worth knowing before starting a sixth take.
 */
export default async function SocialPage() {
  const reels = await listReels()

  const building = reels.filter((r) => r.status === "building")
  const finished = reels.filter((r) => r.status !== "building")
  const monthCost = reels.reduce((sum, r) => sum + r.costCents, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionHeader
        title="Reels"
        description="Long-form vertical video, built as a chain of continuations — each shot carries on from the last frame of the one before it, up to the model's 40-second ceiling."
      />

      <div className="space-y-6 px-6 py-4">
        <NewReelForm />

        {reels.length > 0 && (
          <p className="text-xs text-slate-500">
            {reels.length} reel{reels.length === 1 ? "" : "s"} · {dollars(monthCost)} of renders
            recorded in total
          </p>
        )}

        <Group title="In progress" reels={building} />
        <Group title="Finished and abandoned" reels={finished} />

        {reels.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-xs text-slate-500">
            No reels yet. Name one above to start.
          </p>
        )}
      </div>
    </div>
  )
}

function Group({
  title,
  reels,
}: {
  title: string
  reels: Awaited<ReturnType<typeof listReels>>
}) {
  if (!reels.length) return null

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reels.map((reel) => (
          <Link
            key={reel.id}
            href={`/social/${reel.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                {reel.title}
              </p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  STATUS_CHIP[reel.status] ?? "bg-slate-100 text-slate-600"
                }`}
              >
                {reel.status}
              </span>
            </div>

            <p className="mt-1 text-[11px] text-slate-500">
              {reel.brand} · {reel.aspectRatio} · {reel.resolution}
            </p>

            <div className="mt-3 flex items-baseline justify-between text-xs">
              <span className="tabular-nums font-semibold text-slate-900">
                {reel.seconds.toFixed(1)}s
                <span className="font-normal text-slate-400"> / {reel.targetSeconds}s</span>
              </span>
              <span className="tabular-nums text-slate-600">{dollars(reel.costCents)}</span>
            </div>

            {/* Against the target rather than the 40s ceiling: the target is what this reel is
                trying to be, and the ceiling is already enforced where it matters. */}
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{
                  width: `${Math.min(100, (reel.seconds / Math.max(1, reel.targetSeconds)) * 100)}%`,
                }}
              />
            </div>

            <p className="mt-2 text-[11px] text-slate-400">
              {reel.readyCount} of {reel.shotCount} shot{reel.shotCount === 1 ? "" : "s"} ready
              {reel.renderingCount > 0 && (
                <span className="font-semibold text-amber-700"> · {reel.renderingCount} rendering</span>
              )}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
