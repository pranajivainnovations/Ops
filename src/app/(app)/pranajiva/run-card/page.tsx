import Link from "next/link"

import { PIPELINE_COMMANDS, coworkCommandsFor } from "@/lib/pranajiva/cowork"

export const dynamic = "force-dynamic"

/**
 * How to run a topic through the content pipeline.
 *
 * The pipeline is driven by typing into a chat session, not by anything OPS can call — so the
 * knowledge of what to type lives nowhere durable unless it lives here. Before this page it lived
 * in one person's head and in a chat scrollback, which is the same as not existing the first time
 * somebody else has to do it.
 *
 * Command strings come from lib/pranajiva/cowork so this page and the per-topic pages cannot drift
 * apart. They already had: the topic pages were printing "Research" and "Generate", which the
 * pipeline stopped understanding when it became bilingual.
 */

const EXAMPLE = "PJ-C12-T04"

const STEPS: { text: string; detail?: string }[] = [
  {
    text: "Finds the topic in the master index and confirms the chapter, verse reference and priority back to you.",
    detail: "If the topic is marked clinical rather than consumer-relevant, it says so and asks before going on.",
  },
  { text: "Checks the ledger, so it never redoes work already done." },
  {
    text: "Checks the verse library for the Sanskrit.",
    detail: "Already verified for that chapter? Costs nothing. Never verified? See the one interruption below.",
  },
  {
    text: "Builds the evidence pack — verses, commentary, the disputes, what the passage does NOT say, and a claim-posture list saying how each finding may be phrased.",
    detail: "Filed to evidence_packs. Never published — this is the scholarly record.",
  },
  {
    text: "Writes two blogs from that pack, English and Hindi, each written natively rather than translated. Around 1,100–1,300 words, reader-first, no chapter numbers.",
    detail: "Filed to blogs/drafts as _EN.md and _HI.md.",
  },
  { text: "Stops and waits for your OK. Nothing is built on top of a blog you haven't read." },
  {
    text: "On your word, writes two video packs — five short-video scripts each, English and Hindi — plus the voiceover job and the Shotstack edit files.",
    detail:
      "Filed to scripts/drafts in the video pipeline, named PJV- rather than PJ- so a blog and its pack sort together. Each script carries its own beat table, which is what the render is built from.",
  },
  { text: "Updates the ledger so the status is correct without you touching anything." },
  {
    text: "Reports back: what it cut for being unsourceable, what the source doesn't cover, any verse number the index had wrong, and how the Hindi differs from the English.",
  },
]

const NEVER = [
  "Pick a topic for you, or run on a schedule.",
  "Post anything to Instagram, YouTube or anywhere else.",
  "Overwrite anything without you saying the word.",
  "Delete anything that has left drafts.",
  "Move a blog out of drafts without you saying so.",
  "Write a Sanskrit line it hasn't verified against the source.",
  "Put a health claim, or a product, inside classical content.",
  "Explain the book to your reader — chapter numbers stay out of published work.",
]

export default function RunCardPage() {
  const topicCommands = coworkCommandsFor(EXAMPLE)

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Running a topic</h1>
        <p className="mt-1 text-xs text-slate-500">
          Blogs and video scripts, English and Hindi.{" "}
          <Link href="/pranajiva/content" className="underline underline-offset-2">
            What has been produced
          </Link>{" "}
          ·{" "}
          <Link href="/pranajiva/topics" className="underline underline-offset-2">
            Topic board
          </Link>
        </p>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700">
            Say this
          </p>
          <p className="mt-2 font-mono text-xl font-bold text-slate-900">run {EXAMPLE}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            In a chat in the <strong>pranajiva_wellness</strong> project. Phone or laptop makes no
            difference — everything runs in Drive.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Don&rsquo;t know the ID? Say the topic instead — <em>&ldquo;run the one about proper
            quantity of food&rdquo;</em> — and it will find the ID in the 432-topic index and read it
            back before starting.
          </p>
        </section>

        {/* ── ID decoder ─────────────────────────────────────────────────────────────────────── */}
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900">Reading a topic ID</h2>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <p className="font-mono text-xl font-bold text-slate-900">
              PJ-<span className="text-emerald-700">C12</span>-
              <span className="text-amber-700">T04</span>
            </p>
            <p className="text-xs text-slate-600">
              <span className="font-mono font-semibold text-emerald-700">C12</span> Sūtrasthāna
              chapter 12
            </p>
            <p className="text-xs text-slate-600">
              <span className="font-mono font-semibold text-amber-700">T04</span> the 4th topic in it
            </p>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            432 topics across 30 chapters. 314 are consumer-relevant; the rest are surgical or
            clinical and aren&rsquo;t worth writing.
          </p>
        </section>

        {/* ── Sequence ───────────────────────────────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="text-sm font-bold text-slate-900">What happens after you say it</h2>
          <p className="mt-1 text-xs text-slate-500">
            Each step feeds the next, and it stops on its own if a step can&rsquo;t be done honestly.
          </p>
          <ol className="mt-4 flex flex-col">
            {STEPS.map((step, i) => (
              <li
                key={step.text}
                className="grid grid-cols-[2rem,1fr] gap-x-3 border-b border-slate-200 py-3 last:border-0"
              >
                <span className="pt-0.5 font-mono text-xs tabular-nums text-slate-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  {/* Step 6 is the approval gate and the only place a person is required, so it
                      is the one step allowed to shout. */}
                  <p
                    className={
                      i === 5
                        ? "text-sm font-semibold text-slate-900"
                        : "text-sm leading-relaxed text-slate-800"
                    }
                  >
                    {step.text}
                  </p>
                  {step.detail && (
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{step.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Commands ───────────────────────────────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="text-sm font-bold text-slate-900">Every command</h2>
          <p className="mt-1 text-xs text-slate-500">
            Ordered by increasing commitment. Each topic&rsquo;s own page prints these with its ID
            filled in.
          </p>

          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Say this</th>
                  <th className="px-4 py-2 font-semibold">You get</th>
                </tr>
              </thead>
              <tbody>
                {[...topicCommands, ...PIPELINE_COMMANDS].map((c) => (
                  <tr key={c.command} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-emerald-700">
                      {c.command}
                      {c.writes && (
                        <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                          writes
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-xs leading-relaxed text-slate-700">
                      {c.effect}
                      {c.pauses && (
                        <span className="mt-1 block font-semibold text-slate-900">
                          Pauses for your approval partway through.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Collisions ─────────────────────────────────────────────────────────────────────── */}
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900">If it already exists</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Nothing is ever replaced quietly. The run stops before writing anything and tells you
            what&rsquo;s there — file, stage, date — along with the exact word to type next.
          </p>
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-800 ring-1 ring-slate-200">
            PJ-C08-T01 already has an English blog, in drafts, from 27 August. There&rsquo;s no Hindi
            version.
            <br />
            Say <span className="font-mono font-semibold">overwrite EN</span> to replace it, or{" "}
            <span className="font-mono font-semibold">blog PJ-C08-T01 HI only</span> to add Hindi and
            leave the English alone.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-slate-600">
            Half-done is not a conflict — if English exists and Hindi doesn&rsquo;t, it writes the
            Hindi and leaves the English untouched.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            <strong>Drafts</strong> are replaced cleanly. Anything in{" "}
            <strong>review, approved or published</strong> is never deleted — the old file moves to
            the archive and you get one more confirmation naming the stage first, so published work
            can&rsquo;t be lost by typing one word too fast.
          </p>
        </section>

        {/* ── The interruption ───────────────────────────────────────────────────────────────── */}
        <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-800">
            The one time it will interrupt you — attach one PDF
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-900">
            The Tripathi volumes are photographs of pages, not text, so a verse can only be checked
            by looking at the page. The first time you run <strong>any</strong> topic from a chapter
            that has never been verified, it names the one volume it needs and asks you to attach it.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-900">
            Every verse it reads is then banked permanently — the next topic from that chapter needs
            nothing. Running <span className="font-mono font-semibold">verify chapter 12</span> once
            clears a whole chapter in advance.
          </p>
        </section>

        {/* ── Never ──────────────────────────────────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="text-sm font-bold text-slate-900">What it will never do</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {NEVER.map((n) => (
              <li key={n} className="grid grid-cols-[1rem,1fr] gap-2 text-xs leading-relaxed text-slate-700">
                <span className="text-slate-400">—</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-8 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
          State lives in one file, <span className="font-mono">PIPELINE_LEDGER.md</span> in{" "}
          <span className="font-mono">00_MASTER_CONTROL</span>, written by the agents and never by
          hand. You don&rsquo;t need to open it — asking is faster.
        </p>
      </div>
    </main>
  )
}
