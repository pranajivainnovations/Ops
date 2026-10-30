import Link from "next/link"
import { notFound } from "next/navigation"

import {
  anchorUrl,
  dollars,
  getReel,
  needsStitching,
  runningSeconds,
  totalCostCents,
} from "@/lib/social/reels"
import { SectionHeader } from "../_components/header"
import Builder from "./builder"

export const dynamic = "force-dynamic"

/**
 * One reel, being built.
 *
 * ── Why the shot list and the composer are one client component ───────────────────────────────
 * Because a render takes minutes and the screen has to change while nobody touches it. The list
 * refreshes itself whenever a shot is rendering and stops when none is, so the page is live
 * exactly as long as there is something to watch and still the rest of the time.
 */
export default async function ReelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const reel = await getReel(id)
  if (!reel) notFound()

  const seconds = runningSeconds(reel.scenes)
  const cost = totalCostCents(reel.scenes)
  const stitching = needsStitching(reel.scenes)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionHeader
        title={reel.title}
        description={`${reel.brand} · ${reel.aspectRatio} · ${reel.resolution} · target ${reel.targetSeconds}s${
          reel.createdByName ? ` · started by ${reel.createdByName}` : ""
        }`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums text-slate-900">
                {seconds.toFixed(1)}s
                <span className="text-xs font-normal text-slate-400"> / {reel.targetSeconds}s</span>
              </p>
              <p className="text-[11px] tabular-nums text-slate-500">{dollars(cost)} spent</p>
            </div>
            <Link
              href="/social"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              All reels
            </Link>
          </div>
        }
      />

      <div className="px-6 py-4">
        {/**
         * Said once, at the top, when it is known.
         *
         * Whether a finished reel needs stitching is the single most consequential unknown in this
         * pipeline — Google does not document whether extending returns the continuation alone or
         * the whole clip, and the answer decides whether there is a post-production step at all.
         * It is reported from what the renders actually did rather than from an assumption.
         */}
        {stitching !== null && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-xs leading-relaxed ${
              stitching
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            {stitching ? (
              <>
                <strong>These continuations return only the new segment.</strong> The shots below are
                separate clips, so the finished reel has to be stitched — download them in order and
                concatenate. Nothing here does that yet.
              </>
            ) : (
              <>
                <strong>These continuations return the whole clip so far.</strong> The last ready
                shot below <em>is</em> the finished reel — download that one. No stitching needed.
              </>
            )}
          </div>
        )}

        <Builder
          reelId={reel.id}
          reelStatus={reel.status}
          targetSeconds={reel.targetSeconds}
          runningSeconds={seconds}
          scenes={reel.scenes.map((scene) => ({
            ...scene,
            /* Keys become URLs here, on the server, so the client never has to know the bucket. */
            images: scene.imageKeys.map((key) => ({ key, url: anchorUrl(key) })),
          }))}
        />
      </div>
    </div>
  )
}
