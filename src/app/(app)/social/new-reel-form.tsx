"use client"

import { useActionState } from "react"

import { createReel, type Result } from "./actions"

const EMPTY: Result = {}

const box =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"

/**
 * Starting a reel.
 *
 * The framing and resolution are fixed at creation rather than per shot, because a chain whose
 * shots disagree about either cannot be assembled into one video. Everything here is cheap and
 * reversible — nothing is generated and nothing is charged until a shot is asked for on the next
 * screen.
 */
export default function NewReelForm() {
  const [state, action, pending] = useActionState(createReel, EMPTY)

  return (
    <form action={action} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="block lg:col-span-2">
          <span className="text-xs font-semibold text-slate-700">New reel</span>
          <input name="title" required placeholder="Dussehra — courtyard" className={box} />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Brand</span>
          <select name="brand" defaultValue="pranajiva" className={box}>
            <option value="pranajiva">PranaJiva</option>
            <option value="crossfriend">CrossFriend</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Framing</span>
          <select name="aspectRatio" defaultValue="9:16" className={box}>
            <option value="9:16">9:16 vertical</option>
            <option value="16:9">16:9 wide</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Resolution</span>
          <select name="resolution" defaultValue="720p" className={box}>
            <option value="720p">720p — generated</option>
            <option value="360p">360p — generated</option>
            <option value="1080p">1080p — upscaled</option>
            <option value="4k">4k — upscaled</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Target (s)</span>
          <input
            name="targetSeconds"
            type="number"
            min={3}
            max={40}
            defaultValue={25}
            className={`${box} tabular-nums`}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create and start building"}
        </button>
        {state.error && <span className="text-xs text-rose-700">{state.error}</span>}
        <span className="ml-auto text-[11px] text-slate-400">
          Only 720p and 360p are generated — 1080p and 4k are upscales of the same render, billed
          the same.
        </span>
      </div>
    </form>
  )
}
