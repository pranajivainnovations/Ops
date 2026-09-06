import Link from "next/link"

import { saveChecklistTask } from "../actions"
import { CHECKLIST, type ChecklistTask } from "../checklist"
import { getAutoSignals, getTaskStates, type SignalState, type TaskState } from "../checklist-data"

export const dynamic = "force-dynamic"

const fmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
})

export default async function ChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { error, saved } = await searchParams
  const [signals, states] = await Promise.all([getAutoSignals(), getTaskStates()])

  const resolve = (task: ChecklistTask): SignalState =>
    task.kind === "auto"
      ? task.signal
        ? signals[task.signal]
        : "unknown"
      : states[task.key]?.isDone
        ? "done"
        : "pending"

  const all = CHECKLIST.flatMap((g) => g.tasks)
  const doneCount = all.filter((t) => resolve(t) === "done").length
  const pct = Math.round((doneCount / all.length) * 100)

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">SMS sign-in rollout</h1>
            <p className="mt-1 text-xs text-slate-500">
              Everything between here and customers receiving a real OTP.{" "}
              <Link href="/messaging" className="underline underline-offset-2">
                Messaging settings
              </Link>
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-slate-900">
              {doneCount}
              <span className="text-base font-medium text-slate-400">/{all.length}</span>
            </p>
            <p className="text-[11px] text-slate-500">{pct}% complete</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {error && (
          <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 ring-1 ring-rose-200">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
            Saved.
          </p>
        )}

        {/*
          The distinction between the two row types is the most important thing on this page, so it
          is stated before the list rather than left to be inferred from the badges.
        */}
        <p className="mb-8 rounded-lg bg-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
          Rows marked <SignalBadge state="done" auto /> <strong>Checked</strong> are read from the
          live system each time this page loads and cannot be ticked by hand. Everything else is a
          fact about the world — a form submitted, a key pasted onto a server — that only a person
          can confirm. Tick those honestly; a checklist that is confidently wrong is worse than none.
        </p>

        <div className="flex flex-col gap-8">
          {CHECKLIST.map((group) => {
            const groupDone = group.tasks.filter((t) => resolve(t) === "done").length
            return (
              <section key={group.title}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-bold text-slate-900">{group.title}</h2>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                    {groupDone}/{group.tasks.length}
                  </span>
                </div>
                {group.blurb && (
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{group.blurb}</p>
                )}

                <div className="mt-3 flex flex-col gap-2">
                  {group.tasks.map((task) => (
                    <TaskRow
                      key={task.key}
                      task={task}
                      state={resolve(task)}
                      stored={states[task.key]}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </main>
  )
}

function SignalBadge({ state, auto }: { state: SignalState; auto?: boolean }) {
  const style =
    state === "done"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : state === "unknown"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-slate-100 text-slate-500 ring-slate-200"

  const text = auto
    ? state === "done"
      ? "Checked"
      : state === "unknown"
        ? "Can't tell"
        : "Not yet"
    : state === "done"
      ? "Done"
      : "Pending"

  return (
    <span
      className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${style}`}
    >
      {text}
    </span>
  )
}

function TaskRow({
  task,
  state,
  stored,
}: {
  task: ChecklistTask
  state: SignalState
  stored?: TaskState
}) {
  const isAuto = task.kind === "auto"

  return (
    <div
      className={`rounded-xl border p-4 ${
        state === "done" ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"
      }`}
    >
      <form action={saveChecklistTask}>
        <input type="hidden" name="task_key" value={task.key} />

        <div className="flex items-start gap-3">
          {isAuto ? (
            // No checkbox at all, rather than a disabled one. A greyed-out checkbox reads as
            // "you may tick this later"; the absence of one says the answer is not yours to give.
            <span
              aria-hidden
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                state === "done"
                  ? "border-emerald-400 bg-emerald-500 text-white"
                  : "border-slate-300 bg-slate-50 text-slate-300"
              }`}
            >
              {state === "done" ? "✓" : "•"}
            </span>
          ) : (
            <input
              type="checkbox"
              name="is_done"
              id={task.key}
              defaultChecked={stored?.isDone ?? false}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor={isAuto ? undefined : task.key}
                className={`text-sm font-semibold ${
                  state === "done" ? "text-slate-500 line-through" : "text-slate-900"
                }`}
              >
                {task.label}
              </label>
              <SignalBadge state={state} auto={isAuto} />
            </div>

            {task.detail && (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{task.detail}</p>
            )}

            {!isAuto && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  name="note"
                  defaultValue={stored?.note ?? ""}
                  placeholder="Reference number, date, who is chasing it…"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                >
                  Save
                </button>
              </div>
            )}

            {stored?.updatedAt && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                {fmt.format(new Date(stored.updatedAt))}
                {stored.updatedBy && ` · ${stored.updatedBy}`}
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
