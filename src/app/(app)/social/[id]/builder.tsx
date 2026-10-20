"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { MODE_LABEL, type ShotMode, type ShotStatus } from "@/lib/social/shot-types"
import { abandonShot, closeReel, generateShot, uploadAnchor } from "../actions"

interface BuilderShot {
  id: string
  seq: number
  mode: ShotMode
  prompt: string
  firstImageUrl: string | null
  lastImageUrl: string | null
  interactionId: string | null
  videoUrl: string | null
  seconds: number | null
  cumulative: boolean | null
  status: ShotStatus
  error: string | null
  costCents: number | null
}

const box =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"

/* Roughly ten cents a second — the figure the settings screen derives from Google's token rate. */
const CENTS_PER_SECOND = 10

/**
 * The shot chain and the composer that adds to it.
 *
 * ── Why it polls itself ───────────────────────────────────────────────────────────────────────
 * A render takes minutes and nothing pushes. While any shot is rendering this refreshes the server
 * component every eight seconds, and the moment none is it stops — so the page is live exactly as
 * long as there is something to watch and completely still afterwards, rather than hammering the
 * database all afternoon because a tab was left open.
 *
 * ── Why the first shot is different from the rest ─────────────────────────────────────────────
 * Only the opening shot can be anchored to images: a continuation carries on from the previous
 * shot's final frame, which is the whole mechanism, and handing it a reference frame as well would
 * ask the model to start somewhere and carry on from somewhere else. So the composer shows anchors
 * before the chain exists and a continuation prompt afterwards.
 */
export default function Builder({
  reelId,
  reelStatus,
  targetSeconds,
  runningSeconds,
  shots,
}: {
  reelId: string
  reelStatus: string
  targetSeconds: number
  runningSeconds: number
  shots: BuilderShot[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ error?: string; ok?: string } | null>(null)

  const [prompt, setPrompt] = useState("")
  const [first, setFirst] = useState<{ key: string; url: string } | null>(null)
  const [last, setLast] = useState<{ key: string; url: string } | null>(null)
  const [uploading, setUploading] = useState<"first" | "last" | null>(null)

  const rendering = shots.some((s) => s.status === "rendering")
  const opening = shots.length === 0
  const closed = reelStatus !== "building"

  /* Live only while something is actually rendering. */
  useEffect(() => {
    if (!rendering) return
    const timer = setInterval(() => router.refresh(), 8000)
    return () => clearInterval(timer)
  }, [rendering, router])

  const lastReady = [...shots].reverse().find((s) => s.status === "ready")
  const canContinue = Boolean(lastReady?.interactionId)
  const nearCeiling = runningSeconds >= 34
  const atCeiling = runningSeconds >= 40

  const mode: ShotMode = opening
    ? first && last
      ? "first_last"
      : first
        ? "image"
        : "text"
    : "continue"

  async function pickAnchor(slot: "first" | "last", file: File) {
    setUploading(slot)
    setMessage(null)

    const form = new FormData()
    form.set("file", file)
    const result = await uploadAnchor(reelId, form)

    setUploading(null)
    if (result.error || !result.key || !result.url) {
      setMessage({ error: result.error ?? "The image was not stored." })
      return
    }
    const stored = { key: result.key, url: result.url }
    if (slot === "first") setFirst(stored)
    else setLast(stored)
  }

  function generate() {
    setMessage(null)
    start(async () => {
      const result = await generateShot({
        reelId,
        prompt,
        mode,
        firstImageKey: opening ? first?.key : null,
        lastImageKey: opening ? last?.key : null,
      })
      setMessage(result)
      if (!result.error) {
        setPrompt("")
        setFirst(null)
        setLast(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ── The chain ─────────────────────────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-3">
        {shots.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-xs text-slate-500">
            No shots yet. Write the opening shot on the right — anchor it to an image if you have one,
            which is what keeps a face and an outfit consistent across the whole reel.
          </p>
        )}

        {shots.map((shot) => (
          <ShotCard key={shot.id} shot={shot} reelId={reelId} onChanged={() => router.refresh()} />
        ))}
      </div>

      {/* ── The composer ──────────────────────────────────────────────────────────────────── */}
      <aside className="space-y-3">
        {closed ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            This reel is {reelStatus}. Nothing further can be generated on it — start a new reel to
            keep going.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {opening ? "Opening shot" : `Shot ${shots.length + 1} — continuation`}
            </h2>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{MODE_LABEL[mode]}</p>

            {!opening && !canContinue && (
              <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] leading-snug text-rose-800">
                The last shot has no reference Google can continue from, so the chain stops here.
                Regenerate it, or finish this reel and start another.
              </p>
            )}

            {atCeiling && (
              <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] leading-snug text-rose-800">
                This reel is at the model&rsquo;s 40-second ceiling. Nothing further can be added to
                the chain.
              </p>
            )}
            {!atCeiling && nearCeiling && (
              <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-900">
                {(40 - runningSeconds).toFixed(1)}s left before the 40-second ceiling.
              </p>
            )}

            {opening && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <AnchorSlot
                  label="Opening frame"
                  hint="Anchors the look"
                  value={first}
                  busy={uploading === "first"}
                  onPick={(file) => pickAnchor("first", file)}
                  onClear={() => setFirst(null)}
                />
                <AnchorSlot
                  label="Closing frame"
                  hint="Optional — interpolates"
                  value={last}
                  busy={uploading === "last"}
                  disabled={!first}
                  onPick={(file) => pickAnchor("last", file)}
                  onClear={() => setLast(null)}
                />
              </div>
            )}

            {opening && first && !last && (
              <p className="mt-2 text-[11px] leading-snug text-slate-500">
                One frame anchors where the shot starts. Add a closing frame and the model
                interpolates between the two instead.
              </p>
            )}

            <label className="mt-3 block">
              <span className="text-xs font-semibold text-slate-700">
                {opening ? "What happens" : "What happens next"}
              </span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder={
                  opening
                    ? "Cinematic Dussehra courtyard, glowing diyas and marigold garlands. Slow push-in dolly. A man in a white kurta turns and smiles."
                    : "Continue the same continuous camera motion, identical lighting and wardrobe. She sets the phone down and looks up, smiling."
                }
                className={`${box} mt-1 leading-relaxed`}
              />
            </label>

            {!opening && (
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                Keep the camera and lighting where they are. A continuation that asks for a new angle
                or a different time of day is where faces and clothing start drifting.
              </p>
            )}

            <p className="mt-2 text-[11px] leading-snug text-slate-500">
              There is no length setting — the model decides, between 3 and 10 seconds, from how much
              you describe. A shot costs roughly{" "}
              <span className="font-semibold tabular-nums">
                ${((3 * CENTS_PER_SECOND) / 100).toFixed(2)}&ndash;$
                {((10 * CENTS_PER_SECOND) / 100).toFixed(2)}
              </span>
              , charged to your key.
            </p>

            <button
              type="button"
              onClick={generate}
              disabled={
                pending ||
                rendering ||
                atCeiling ||
                !prompt.trim() ||
                (!opening && !canContinue) ||
                uploading !== null
              }
              className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {pending
                ? "Starting…"
                : rendering
                  ? "Waiting for the current shot…"
                  : opening
                    ? "Generate opening shot"
                    : `Generate shot ${shots.length + 1}`}
            </button>

            {message?.error && (
              <p className="mt-2 text-[11px] leading-snug text-rose-700">{message.error}</p>
            )}
            {message?.ok && (
              <p className="mt-2 text-[11px] leading-snug text-emerald-700">{message.ok}</p>
            )}
          </div>
        )}

        {!closed && shots.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Finish</h2>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              Closing a reel stops anything further being generated on it. It does not delete
              anything.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => setMessage(await closeReel(reelId, "done")))
                }
                className="flex-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
              >
                Mark finished
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm("Abandon this reel? Shots already paid for are kept.")) return
                  start(async () => setMessage(await closeReel(reelId, "abandoned")))
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Abandon
              </button>
            </div>
          </div>
        )}

        {rendering && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-snug text-amber-900">
            A shot is rendering. This page refreshes itself every few seconds, so you can leave it —
            though if the backend restarts while it runs, the render is lost and may still have been
            billed.
          </p>
        )}
      </aside>
    </div>
  )
}

/**
 * One shot in the chain.
 *
 * The prompt is shown in full rather than truncated: it is the only record of what was asked for,
 * and the next continuation is written by reading it.
 */
function ShotCard({
  shot,
  reelId,
  onChanged,
}: {
  shot: BuilderShot
  reelId: string
  onChanged: () => void
}) {
  const [pending, start] = useTransition()

  const chip =
    shot.status === "ready"
      ? "bg-emerald-100 text-emerald-800"
      : shot.status === "rendering"
        ? "bg-amber-100 text-amber-900"
        : shot.status === "failed"
          ? "bg-rose-100 text-rose-700"
          : "bg-slate-100 text-slate-600"

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
          {shot.seq}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${chip}`}>
          {shot.status}
        </span>
        <span className="text-[11px] text-slate-400">{MODE_LABEL[shot.mode]}</span>
        <span className="ml-auto text-[11px] tabular-nums text-slate-500">
          {shot.seconds ? `${Number(shot.seconds).toFixed(1)}s` : "—"}
          {shot.costCents !== null && ` · $${(shot.costCents / 100).toFixed(2)}`}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div>
          {shot.status === "ready" && shot.videoUrl ? (
            /* controls, no autoplay: a page of shots all playing at once is unusable, and the
               operator is comparing takes rather than watching a feed. */
            <video
              src={shot.videoUrl}
              controls
              preload="metadata"
              className="w-full rounded-lg border border-slate-200 bg-slate-900"
            />
          ) : (
            <div className="flex aspect-[9/16] max-h-56 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-400">
              {shot.status === "rendering" ? "Rendering…" : shot.status === "failed" ? "No video" : "—"}
            </div>
          )}

          {(shot.firstImageUrl || shot.lastImageUrl) && (
            <div className="mt-2 flex gap-2">
              {shot.firstImageUrl && (
                <img
                  src={shot.firstImageUrl}
                  alt="Opening frame"
                  className="h-12 w-12 rounded border border-slate-200 object-cover"
                />
              )}
              {shot.lastImageUrl && (
                <img
                  src={shot.lastImageUrl}
                  alt="Closing frame"
                  className="h-12 w-12 rounded border border-slate-200 object-cover"
                />
              )}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{shot.prompt}</p>

          {shot.error && (
            <p className="mt-2 break-words rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] leading-snug text-rose-800">
              {shot.error}
            </p>
          )}

          {shot.status === "rendering" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (
                  !confirm(
                    "Mark this render failed? Use this only if the backend restarted — it may still have been billed."
                  )
                )
                  return
                start(async () => {
                  await abandonShot(reelId, shot.id)
                  onChanged()
                })
              }}
              className="mt-2 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Give up on this one
            </button>
          )}

          {shot.status === "ready" && !shot.interactionId && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-900">
              Google returned no reference for this shot, so the chain cannot continue from it.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

/** One image slot. Click or drop; the file is stored immediately so the prompt can be edited freely. */
function AnchorSlot({
  label,
  hint,
  value,
  busy,
  disabled,
  onPick,
  onClear,
}: {
  label: string
  hint: string
  value: { url: string } | null
  busy: boolean
  disabled?: boolean
  onPick: (file: File) => void
  onClear: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  if (value) {
    return (
      <div className="relative">
        <img src={value.url} alt={label} className="aspect-square w-full rounded-lg border border-slate-200 object-cover" />
        <button
          type="button"
          onClick={onClear}
          className="absolute right-1 top-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 shadow"
        >
          Remove
        </button>
        <p className="mt-1 text-[10px] text-slate-500">{label}</p>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          if (disabled) return
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file) onPick(file)
        }}
        className={`flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed px-2 text-center transition ${
          over ? "border-slate-500 bg-slate-100" : "border-slate-300 bg-slate-50 hover:border-slate-400"
        } disabled:opacity-40`}
      >
        <span className="text-[11px] font-semibold text-slate-600">
          {busy ? "Uploading…" : label}
        </span>
        <span className="text-[10px] leading-tight text-slate-400">{busy ? "" : hint}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPick(file)
          /* Cleared so choosing the same file again still fires a change. */
          e.target.value = ""
        }}
      />
    </div>
  )
}
