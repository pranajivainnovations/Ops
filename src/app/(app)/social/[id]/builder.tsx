"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { AUDIO_PRESETS, CAMERA_MOVES, SHOT_TYPES } from "@/lib/social/shot-types"
import {
  abandonTake,
  addScene,
  chooseTake,
  deleteScene,
  moveScene,
  previewScene,
  renderScene,
  saveScene,
  uploadAnchor,
  type ScenePatch,
} from "../actions"

export interface BuilderTake {
  id: string
  attempt: number
  composedPrompt: string
  interactionId: string | null
  videoUrl: string | null
  seconds: number | null
  cumulative: boolean | null
  status: "rendering" | "ready" | "failed"
  error: string | null
  costCents: number | null
}

export interface BuilderScene {
  id: string
  seq: number
  prompt: string
  shotType: string
  cameraMove: string
  audioNote: string
  avoid: string
  targetSeconds: number
  continuesFrom: string | null
  images: { key: string; url: string }[]
  chosenTakeId: string | null
  takes: BuilderTake[]
}

const box =
  "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"

/* Roughly ten cents a second, from Google's published token rate. */
const CENTS_PER_SECOND = 10

/**
 * The storyboard.
 *
 * ── Why planning and rendering are visibly different acts ────────────────────────────────────
 * Editing a scene is free and happens constantly; rendering costs real money on the operator's own
 * card and happens once they are happy. So every field saves quietly against its scene, and Render
 * is a separate, deliberate button with the price next to it. Nothing here spends anything until
 * that is pressed.
 *
 * ── Why each scene chooses its own strategy ──────────────────────────────────────────────────
 * The two ways of keeping a reel coherent are mutually exclusive per scene, and a 25-second reel
 * normally needs both. A scene that CONTINUES another inherits everything and can introduce
 * nothing — same camera, same light, same faces, and no new angle. A scene with REFERENCE IMAGES
 * can cut to a new angle entirely and preserves only the likenesses you supply. The composer
 * refuses the combination because the API does, and because asking the model to start somewhere
 * and carry on from somewhere else has no sensible answer.
 */
export default function Builder({
  reelId,
  reelStatus,
  targetSeconds,
  runningSeconds,
  scenes,
}: {
  reelId: string
  reelStatus: string
  targetSeconds: number
  runningSeconds: number
  scenes: BuilderScene[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ error?: string; ok?: string } | null>(null)

  const rendering = scenes.some((s) => s.takes.some((t) => t.status === "rendering"))
  const closed = reelStatus !== "building"
  const atCeiling = runningSeconds >= 40

  /* Live only while something is actually rendering, still the rest of the time. */
  useEffect(() => {
    if (!rendering) return
    const timer = setInterval(() => router.refresh(), 8000)
    return () => clearInterval(timer)
  }, [rendering, router])

  return (
    <div className="space-y-3">
      {scenes.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-xs text-slate-500">
          No scenes yet. Add the first one — give it reference images of your characters, and every
          later scene can cut to a new angle without them changing.
        </p>
      )}

      {scenes.map((scene) => (
        <SceneCard
          key={scene.id}
          reelId={reelId}
          scene={scene}
          earlier={scenes.filter((s) => s.seq < scene.seq)}
          isFirst={scene.seq === 1}
          isLast={scene.seq === scenes.length}
          closed={closed}
          blockedByCeiling={atCeiling}
          onChanged={() => router.refresh()}
        />
      ))}

      {!closed && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setMessage(await addScene(reelId))
                router.refresh()
              })
            }
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {pending ? "Adding…" : `Add scene ${scenes.length + 1}`}
          </button>

          <span className="text-[11px] text-slate-500">
            Planning is free. Nothing is charged until you render a scene.
          </span>

          {message?.error && <span className="text-[11px] text-rose-700">{message.error}</span>}
        </div>
      )}

      {atCeiling && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] text-rose-800">
          This reel is at the model&rsquo;s 40-second ceiling. Further scenes can be planned but not
          rendered into the same chain.
        </p>
      )}
    </div>
  )
}

/**
 * One scene: the plan on the left, its takes on the right.
 *
 * Fields are held in local state and saved on blur rather than on every keystroke — a storyboard
 * is edited in bursts, and a write per character would be a write per character.
 */
function SceneCard({
  reelId,
  scene,
  earlier,
  isFirst,
  isLast,
  closed,
  blockedByCeiling,
  onChanged,
}: {
  reelId: string
  scene: BuilderScene
  earlier: BuilderScene[]
  isFirst: boolean
  isLast: boolean
  closed: boolean
  blockedByCeiling: boolean
  onChanged: () => void
}) {
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(!scene.prompt)
  const [message, setMessage] = useState<{ error?: string; ok?: string } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const [form, setForm] = useState({
    prompt: scene.prompt,
    shotType: scene.shotType,
    cameraMove: scene.cameraMove,
    audioNote: scene.audioNote,
    avoid: scene.avoid,
    targetSeconds: scene.targetSeconds,
    continuesFrom: scene.continuesFrom,
  })
  const [images, setImages] = useState(scene.images)

  const patch = (): ScenePatch => ({ ...form, imageKeys: images.map((i) => i.key) })

  const continuing = Boolean(form.continuesFrom)
  const conflict = continuing && images.length > 0

  const chosen = scene.takes.find((t) => t.id === scene.chosenTakeId) ?? null
  const isRendering = scene.takes.some((t) => t.status === "rendering")

  function save(next?: Partial<typeof form>, nextImages?: typeof images) {
    const merged = { ...form, ...(next ?? {}) }
    const mergedImages = nextImages ?? images
    if (next) setForm(merged)
    if (nextImages) setImages(nextImages)

    start(async () => {
      const result = await saveScene(reelId, scene.id, {
        ...merged,
        imageKeys: mergedImages.map((i) => i.key),
      })
      if (result.error) setMessage(result)
    })
  }

  async function pickImage(file: File) {
    if (images.length >= 6) {
      setMessage({ error: "Six reference images is the model's limit." })
      return
    }
    setUploading(true)
    setMessage(null)

    const data = new FormData()
    data.set("file", file)
    const result = await uploadAnchor(reelId, data)

    setUploading(false)
    if (result.error || !result.key || !result.url) {
      setMessage({ error: result.error ?? "The image was not stored." })
      return
    }
    save(undefined, [...images, { key: result.key, url: result.url }])
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
          {scene.seq}
        </span>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-slate-800 hover:text-slate-950"
        >
          {form.prompt || <span className="font-normal text-slate-400">Untitled scene — click to write it</span>}
        </button>

        {continuing && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
            continues {earlier.find((e) => e.id === form.continuesFrom)?.seq ?? "?"}
          </span>
        )}
        {images.length > 0 && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
            {images.length} ref{images.length === 1 ? "" : "s"}
          </span>
        )}
        {chosen?.seconds && (
          <span className="text-[11px] tabular-nums text-slate-500">{chosen.seconds.toFixed(1)}s</span>
        )}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {scene.takes.length === 0
            ? "not rendered"
            : `${scene.takes.length} take${scene.takes.length === 1 ? "" : "s"}`}
        </span>

        {!closed && (
          <span className="flex items-center gap-1">
            <button
              type="button"
              disabled={isFirst || pending}
              onClick={() => start(async () => { await moveScene(reelId, scene.id, "up"); onChanged() })}
              className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={isLast || pending}
              onClick={() => start(async () => { await moveScene(reelId, scene.id, "down"); onChanged() })}
              className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              title="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const spent = scene.takes.reduce((s, t) => s + (t.costCents ?? 0), 0)
                const warning = spent
                  ? `Remove scene ${scene.seq}? $${(spent / 100).toFixed(2)} of renders go with it.`
                  : `Remove scene ${scene.seq}?`
                if (!confirm(warning)) return
                start(async () => { await deleteScene(reelId, scene.id); onChanged() })
              }}
              className="rounded px-1.5 py-0.5 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-30"
              title="Remove scene"
            >
              ✕
            </button>
          </span>
        )}
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ── The plan ──────────────────────────────────────────────────────────────────── */}
        <div className="min-w-0">
          {open ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-700">What happens</span>
                <textarea
                  value={form.prompt}
                  onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                  onBlur={() => save()}
                  rows={3}
                  disabled={closed}
                  placeholder="Rudra and Gauri crouch to place marigold petals around the rangoli, diyas glowing between them."
                  className={`${box} mt-1 leading-relaxed`}
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-700">Shot</span>
                  <select
                    value={form.shotType}
                    onChange={(e) => save({ shotType: e.target.value })}
                    disabled={closed}
                    className={`${box} mt-1`}
                  >
                    <option value="">—</option>
                    {SHOT_TYPES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-700">Camera</span>
                  <select
                    value={form.cameraMove}
                    onChange={(e) => save({ cameraMove: e.target.value })}
                    disabled={closed}
                    className={`${box} mt-1`}
                  >
                    <option value="">—</option>
                    {CAMERA_MOVES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-700">Length (s)</span>
                  <input
                    type="number"
                    min={3}
                    max={10}
                    value={form.targetSeconds}
                    onChange={(e) => setForm({ ...form, targetSeconds: Number(e.target.value) })}
                    onBlur={() => save()}
                    disabled={closed}
                    className={`${box} mt-1 tabular-nums`}
                  />
                </label>
              </div>

              {/* Said once per scene, because it is the thing most likely to be misunderstood. */}
              <p className="text-[10px] leading-snug text-slate-400">
                Length is a <strong>hint</strong>, not a setting — this API has no duration
                parameter. It is written into the prompt as a timecode, and the model still decides
                between 3 and 10 seconds.
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-700">Audio</span>
                  <input
                    list={`audio-${scene.id}`}
                    value={form.audioNote}
                    onChange={(e) => setForm({ ...form, audioNote: e.target.value })}
                    onBlur={() => save()}
                    disabled={closed}
                    placeholder="No dialogue"
                    className={`${box} mt-1`}
                  />
                  <datalist id={`audio-${scene.id}`}>
                    {AUDIO_PRESETS.map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                  <span className="mt-0.5 block text-[10px] leading-snug text-slate-400">
                    The model invents an audio track unless told otherwise.
                  </span>
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-700">Avoid</span>
                  <input
                    value={form.avoid}
                    onChange={(e) => setForm({ ...form, avoid: e.target.value })}
                    onBlur={() => save()}
                    disabled={closed}
                    placeholder="text on screen, logos, extra people"
                    className={`${box} mt-1`}
                  />
                  <span className="mt-0.5 block text-[10px] leading-snug text-slate-400">
                    Appended as a sentence — there is no negative-prompt field.
                  </span>
                </label>
              </div>

              {/* ── Strategy ─────────────────────────────────────────────────────────────── */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-700">How this scene stays consistent</p>

                <label className="mt-2 block">
                  <span className="text-[11px] text-slate-600">Continue from</span>
                  <select
                    value={form.continuesFrom ?? ""}
                    onChange={(e) => save({ continuesFrom: e.target.value || null })}
                    disabled={closed || earlier.length === 0}
                    className={`${box} mt-1`}
                  >
                    <option value="">Nothing — this scene stands on its own</option>
                    {earlier.map((e) => (
                      <option key={e.id} value={e.id}>
                        Scene {e.seq}
                        {e.prompt ? ` — ${e.prompt.slice(0, 40)}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-2">
                  <span className="text-[11px] text-slate-600">
                    Reference images <span className="text-slate-400">({images.length}/6)</span>
                  </span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {images.map((img, i) => (
                      <div key={img.key} className="relative">
                        <img
                          src={img.url}
                          alt={`IMAGE_REF_${i}`}
                          className="h-14 w-14 rounded border border-slate-200 object-cover"
                        />
                        <span className="absolute -bottom-1 left-0 rounded bg-slate-900 px-1 text-[9px] font-mono text-white">
                          {i}
                        </span>
                        {!closed && (
                          <button
                            type="button"
                            onClick={() => save(undefined, images.filter((x) => x.key !== img.key))}
                            className="absolute -right-1 -top-1 rounded-full bg-white px-1 text-[10px] font-bold text-rose-600 shadow"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}

                    {!closed && images.length < 6 && !continuing && (
                      <ImagePicker busy={uploading} onPick={pickImage} />
                    )}
                  </div>

                  <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
                    Addressed in the prompt as{" "}
                    <code className="font-mono">&lt;IMAGE_REF_0&gt;</code> upward. This is how a face
                    and an outfit survive a cut to a new angle.
                  </p>
                </div>

                {conflict && (
                  <p className="mt-2 rounded bg-rose-50 px-2 py-1.5 text-[10px] leading-snug text-rose-800">
                    A continuing scene cannot also carry reference images — it continues from the
                    previous take&rsquo;s last frame. Clear one or the other before rendering.
                  </p>
                )}
                {continuing && !conflict && (
                  <p className="mt-2 text-[10px] leading-snug text-slate-500">
                    Continuations inherit the camera, lighting and characters automatically — and
                    cannot introduce a new angle. For a cut, clear this and use references instead.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await previewScene(patch())
                      setPreview(result.prompt ?? result.error ?? "")
                    })
                  }
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Show exact prompt
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Collapse
                </button>
                {message?.error && <span className="text-[11px] text-rose-700">{message.error}</span>}
              </div>

              {preview !== null && (
                <pre className="whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                  {preview}
                </pre>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-full text-left text-[11px] leading-relaxed text-slate-500 hover:text-slate-700"
            >
              {[form.shotType, form.cameraMove].filter(Boolean).join(" · ") || "No camera set"} ·{" "}
              {form.targetSeconds}s{form.audioNote ? ` · ${form.audioNote}` : ""} — click to edit
            </button>
          )}
        </div>

        {/* ── The takes ─────────────────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          {!closed && (
            <button
              type="button"
              disabled={pending || isRendering || conflict || blockedByCeiling || !form.prompt.trim()}
              onClick={() =>
                start(async () => {
                  setMessage(await renderScene(reelId, scene.id))
                  onChanged()
                })
              }
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {isRendering
                ? "Rendering…"
                : scene.takes.length === 0
                  ? `Render — about $${((form.targetSeconds * CENTS_PER_SECOND) / 100).toFixed(2)}`
                  : `Another take — about $${((form.targetSeconds * CENTS_PER_SECOND) / 100).toFixed(2)}`}
            </button>
          )}

          {scene.takes.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 px-2 py-6 text-center text-[11px] text-slate-400">
              No takes yet
            </p>
          )}

          {[...scene.takes].reverse().map((take) => (
            <TakeCard
              key={take.id}
              take={take}
              reelId={reelId}
              sceneId={scene.id}
              chosen={take.id === scene.chosenTakeId}
              closed={closed}
              onChanged={onChanged}
            />
          ))}
        </div>
      </div>
    </article>
  )
}

function TakeCard({
  take,
  reelId,
  sceneId,
  chosen,
  closed,
  onChanged,
}: {
  take: BuilderTake
  reelId: string
  sceneId: string
  chosen: boolean
  closed: boolean
  onChanged: () => void
}) {
  const [pending, start] = useTransition()

  return (
    <div
      className={`rounded-lg border p-2 ${
        chosen ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold text-slate-500">Take {take.attempt}</span>
        {chosen && (
          <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
            USING
          </span>
        )}
        <span className="ml-auto text-[10px] tabular-nums text-slate-500">
          {take.seconds ? `${take.seconds.toFixed(1)}s` : ""}
          {take.costCents !== null && ` · $${(take.costCents / 100).toFixed(2)}`}
        </span>
      </div>

      {take.status === "ready" && take.videoUrl ? (
        <video
          src={take.videoUrl}
          controls
          preload="metadata"
          className="mt-1.5 w-full rounded border border-slate-200 bg-slate-900"
        />
      ) : (
        <div className="mt-1.5 flex h-20 items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50 text-[10px] text-slate-400">
          {take.status === "rendering" ? "Rendering…" : "Failed"}
        </div>
      )}

      {take.error && (
        <p className="mt-1.5 break-words rounded bg-rose-50 px-2 py-1 text-[10px] leading-snug text-rose-800">
          {take.error}
        </p>
      )}

      {!closed && take.status === "ready" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await chooseTake(reelId, sceneId, chosen ? null : take.id)
              onChanged()
            })
          }
          className={`mt-1.5 w-full rounded px-2 py-1 text-[10px] font-semibold disabled:opacity-50 ${
            chosen
              ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {chosen ? "Unpick" : "Use this take"}
        </button>
      )}

      {!closed && take.status === "rendering" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("Mark this render failed? Use only if the backend restarted — it may still have been billed."))
              return
            start(async () => {
              await abandonTake(reelId, take.id)
              onChanged()
            })
          }}
          className="mt-1.5 w-full rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Give up on this one
        </button>
      )}
    </div>
  )
}

/** Click or drop. Stored immediately so the prompt can keep being edited. */
function ImagePicker({ busy, onPick }: { busy: boolean; onPick: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
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
        className={`flex h-14 w-14 items-center justify-center rounded border border-dashed text-[10px] font-semibold transition ${
          over ? "border-slate-500 bg-slate-100 text-slate-700" : "border-slate-300 text-slate-400 hover:border-slate-400"
        } disabled:opacity-40`}
      >
        {busy ? "…" : "+ ref"}
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
    </>
  )
}
