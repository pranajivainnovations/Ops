import Link from "next/link"

import { getCurrentSession } from "@/lib/auth"
import { assignTask, deleteMessage, postMessage, toggleDone, toggleTask } from "./actions"
import { boardSchemaReady, loadBoard, loadTeam, type BoardMessage, type TeamMember } from "./data"

/**
 * The team board — one shared thread, where anything written can become a task.
 *
 * ── What this is not trying to be ──────────────────────────────────────────────────────────────
 * Not a replacement for WhatsApp. That fight is unwinnable: WhatsApp is on the home screen, it
 * notifies, and the team is already in it. What a group chat cannot do is remember — a decision made
 * on Tuesday is unfindable by Friday, and "someone should call that baker back" scrolls away the
 * moment the next message lands.
 *
 * So the value here is the second column, not the first. A message marked as a task stops scrolling
 * past and becomes a row with a state, sitting beside the data it is about. Chat is how it gets
 * written; the task is why the page exists.
 *
 * ── Why one channel, no threads, no reactions ──────────────────────────────────────────────────
 * A small team in one chronological board is legible. Channels invented before anyone asks for them
 * split a quiet room into several quieter ones, and a thread nobody replies to reads as being
 * ignored. Those are additions to make when the board is busy enough to be annoying, with the
 * evidence in hand.
 *
 * ── No live updates, and the page says so ──────────────────────────────────────────────────────
 * There is no socket here. The board reloads when you post, and there is a refresh control. Claiming
 * live delivery it cannot honour would be the more expensive mistake — people would stop checking.
 */
export const dynamic = "force-dynamic"

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; view?: string }>
}) {
  const params = await searchParams
  const view = params.view === "tasks" ? "tasks" : "all"

  if (!(await boardSchemaReady())) {
    return (
      <Shell view={view}>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">The board table has not been created yet</p>
          <p className="mt-1 max-w-2xl text-xs text-amber-800">
            Run the <span className="font-mono">CreateTeamBoard</span> migration on the backend, then
            reload. Nothing else needs to change — the page finds the table on its own.
          </p>
        </div>
      </Shell>
    )
  }

  const [messages, team, session] = await Promise.all([
    loadBoard(),
    loadTeam(),
    getCurrentSession(),
  ])

  const openTasks = messages.filter((m) => m.isTask && !m.isDone && !m.deletedAt)
  const shown = view === "tasks" ? messages.filter((m) => m.isTask && !m.deletedAt) : messages

  return (
    <Shell view={view} openCount={openTasks.length}>
      {params.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {params.error}
        </p>
      )}

      {/* The thread. Oldest at the top, newest at the bottom — the direction a conversation runs. */}
      <div className="flex flex-col gap-3">
        {shown.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-xs text-slate-500">
            {view === "tasks"
              ? "No tasks yet. Write a message and mark it as a task."
              : "Nothing here yet. Say the first thing."}
          </p>
        )}

        {shown.map((message) => (
          <MessageRow
            key={message.id}
            message={message}
            team={team}
            isMine={message.authorId === session?.userId}
          />
        ))}
      </div>

      {/* The composer is at the bottom, where the newest message is and where a thumb already is. */}
      <Composer team={team} />
    </Shell>
  )
}

function Shell({
  children,
  view,
  openCount,
}: {
  children: React.ReactNode
  view: "all" | "tasks"
  openCount?: number
}) {
  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">Team board</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              One thread for the whole team. Anything written here can be marked as a task.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <Tab href="/board" active={view === "all"}>
              Everything
            </Tab>
            <Tab href="/board?view=tasks" active={view === "tasks"}>
              Tasks
              {openCount ? (
                <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                  {openCount}
                </span>
              ) : null}
            </Tab>
          </div>
        </div>
      </header>
      <div className="space-y-4 p-6">{children}</div>
    </main>
  )
}

function Tab({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {children}
    </Link>
  )
}

function MessageRow({
  message,
  team,
  isMine,
}: {
  message: BoardMessage
  team: TeamMember[]
  isMine: boolean
}) {
  if (message.deletedAt) {
    return (
      <p className="px-1 text-[11px] italic text-slate-400">
        {message.authorName} deleted a message
      </p>
    )
  }

  const overdue =
    message.isTask &&
    !message.isDone &&
    message.dueOn !== null &&
    message.dueOn < new Date().toISOString().slice(0, 10)

  return (
    <article
      className={`rounded-xl border bg-white p-4 ${
        message.isTask && !message.isDone
          ? overdue
            ? "border-red-300 bg-red-50/40"
            : "border-amber-300"
          : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-xs font-bold text-slate-900">{message.authorName}</span>
        <time className="text-[11px] text-slate-400" dateTime={message.createdAt.toISOString()}>
          {formatWhen(message.createdAt)}
        </time>
        {message.isTask && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              message.isDone
                ? "bg-emerald-100 text-emerald-800"
                : overdue
                  ? "bg-red-600 text-white"
                  : "bg-amber-100 text-amber-800"
            }`}
          >
            {message.isDone ? "Done" : overdue ? "Overdue" : "Task"}
          </span>
        )}
      </div>

      {/* whitespace-pre-wrap, so a message written with line breaks keeps them. Not Markdown — this
          is a chat box, and half-rendered formatting is worse than none. */}
      <p
        className={`mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed ${
          message.isDone ? "text-slate-400 line-through" : "text-slate-800"
        }`}
      >
        {message.body}
      </p>

      {message.isTask && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <form action={toggleDone}>
            <input type="hidden" name="id" value={message.id} />
            <button
              type="submit"
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                message.isDone
                  ? "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {message.isDone ? "Reopen" : "Mark done"}
            </button>
          </form>

          {/* Assignee and due date save together — they are one thought ("Priya, by Friday") and
              splitting them into two forms would mean two round trips to express it. */}
          <form action={assignTask} className="flex flex-wrap items-center gap-1.5">
            <input type="hidden" name="id" value={message.id} />
            <select
              name="assignee_id"
              defaultValue={message.assigneeId ?? ""}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
            >
              <option value="">Anyone</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="due_on"
              defaultValue={message.dueOn ?? ""}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Save
            </button>
          </form>

          {message.isDone && message.doneByName && (
            <span className="text-[11px] text-slate-400">
              Closed by {message.doneByName}
              {message.doneAt ? ` · ${formatWhen(message.doneAt)}` : ""}
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <form action={toggleTask}>
          <input type="hidden" name="id" value={message.id} />
          <button
            type="submit"
            className="text-[11px] font-semibold text-slate-400 underline underline-offset-2 transition hover:text-slate-700"
          >
            {message.isTask ? "Not a task" : "Make this a task"}
          </button>
        </form>

        {/* Only your own. Anyone deleting anyone's messages is how a shared record stops being one. */}
        {isMine && (
          <form action={deleteMessage}>
            <input type="hidden" name="id" value={message.id} />
            <button
              type="submit"
              className="text-[11px] font-semibold text-slate-300 underline underline-offset-2 transition hover:text-red-500"
            >
              Delete
            </button>
          </form>
        )}
      </div>
    </article>
  )
}

function Composer({ team }: { team: TeamMember[] }) {
  return (
    <form
      action={postMessage}
      className="sticky bottom-4 rounded-2xl border-2 border-slate-300 bg-white p-3 shadow-lg"
    >
      <textarea
        name="body"
        rows={3}
        required
        maxLength={4000}
        placeholder="Write to the team…"
        className="w-full resize-none border-0 bg-transparent p-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <input type="checkbox" name="is_task" className="h-3.5 w-3.5 accent-amber-500" />
          It&rsquo;s a task
        </label>
        <select
          name="assignee_id"
          defaultValue=""
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
        >
          <option value="">Anyone</option>
          {team.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="due_on"
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
        />
        <button
          type="submit"
          className="ml-auto rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700"
        >
          Post
        </button>
      </div>
    </form>
  )
}

/** Times on a board are read as "when, relative to now" far more often than as a date. */
function formatWhen(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}
