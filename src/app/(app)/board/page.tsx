import Link from "next/link"

import { getCurrentSession } from "@/lib/auth"
import { assignTask, deleteMessage, postMessage, toggleDone, toggleTask } from "./actions"
import {
  attachmentsSchemaReady,
  boardSchemaReady,
  loadBoard,
  loadTeam,
  markBoardSeen,
  pushSchemaReady,
  type BoardMessage,
  type TeamMember,
} from "./data"
import EnableNotifications from "./enable-notifications"
import MessageBody from "./message-body"
import ScrollToLatest from "./scroll-to-latest"
import { pushConfig } from "@/lib/push"

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
 *
 * ── Why the thread scrolls and the page does not ───────────────────────────────────────────────
 * The composer used to be sticky inside a page that scrolled as one. That keeps the box on screen
 * but floats it over the conversation, so the newest messages — the ones being replied to — sit
 * underneath the thing you are typing in, and the gap above it changes with the scroll position.
 * Giving the thread its own scroll pane makes the composer a fixed part of the frame instead: the
 * space above it is constant, and nothing is ever hidden behind it.
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

  const hasAttachments = await attachmentsSchemaReady()

  const [messages, team, session, pushReady] = await Promise.all([
    loadBoard(hasAttachments),
    loadTeam(),
    getCurrentSession(),
    pushSchemaReady(),
  ])

  /**
   * Opening the board is what marks it read.
   *
   * Deliberately after the messages are loaded, so the count the person sees on arrival still
   * reflects what was new when they clicked — marking first would zero the badge before they had a
   * chance to see why it was there.
   *
   * Not awaited into the render path and never allowed to throw: failing to record a read is not a
   * reason to fail the page they are trying to look at.
   */
  if (pushReady && session?.userId) {
    void markBoardSeen(session.userId).catch(() => {})
  }

  /* The public key is read on the server and handed down as a prop. See lib/push.ts for why it is
     not a NEXT_PUBLIC_ variable — that mistake has already cost two deploys in this project. */
  const vapidPublicKey = pushConfig()?.publicKey ?? null

  const openTasks = messages.filter((m) => m.isTask && !m.isDone && !m.deletedAt)
  const shown = view === "tasks" ? messages.filter((m) => m.isTask && !m.deletedAt) : messages

  return (
    <Shell view={view} openCount={openTasks.length} composer={<Composer team={team} canAttach={hasAttachments} />}>
      {params.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {params.error}
        </p>
      )}

      {pushReady && <EnableNotifications publicKey={vapidPublicKey} />}

      {/* The thread. Oldest at the top, newest at the bottom — the direction a conversation runs. */}
      <div className="flex flex-col gap-1">
        {shown.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-xs text-slate-500">
            {view === "tasks"
              ? "No tasks yet. Write a message and mark it as a task."
              : "Nothing here yet. Say the first thing."}
          </p>
        )}

        {shown.map((message, index) => {
          const previous = index > 0 ? shown[index - 1] : null

          /* A new day gets a divider. Without one a board read weeks later is a wall of "14:32" with
             no idea whether two messages are minutes or months apart. */
          const newDay =
            !previous || previous.createdAt.toDateString() !== message.createdAt.toDateString()

          /* Consecutive messages from the same person inside five minutes are one turn of speech, so
             only the first carries an avatar and a name. Repeating them makes a person typing three
             short lines look like three separate people. A task always breaks the group — it is a
             different kind of object and needs its own header. */
          const grouped =
            !newDay &&
            previous !== null &&
            previous.authorId === message.authorId &&
            !previous.deletedAt &&
            !message.isTask &&
            !previous.isTask &&
            message.createdAt.getTime() - previous.createdAt.getTime() < 5 * 60 * 1000

          return (
            <div key={message.id}>
              {newDay && <DayDivider date={message.createdAt} />}
              <MessageRow
                message={message}
                team={team}
                isMine={message.authorId === session?.userId}
                grouped={grouped}
              />
            </div>
          )
        })}
      </div>

      <ScrollToLatest targetId={THREAD_ID} />
    </Shell>
  )
}

/** The scroll pane's id, shared between the markup and the component that scrolls it. */
const THREAD_ID = "board-thread"

function Shell({
  children,
  view,
  openCount,
  composer,
}: {
  children: React.ReactNode
  view: "all" | "tasks"
  openCount?: number
  /** Rendered in the fixed footer rather than in the thread, so it never scrolls away. */
  composer?: React.ReactNode
}) {
  return (
    /* 3.25rem is the mobile top bar in the app shell, which sits above this and is hidden from sm:
       up. Subtracting it is what keeps the composer on screen rather than just below it on a phone.
       100dvh, not 100vh, so the browser chrome collapsing does not leave the box under the URL bar. */
    <main className="flex h-[calc(100dvh-3.25rem)] flex-1 flex-col bg-slate-50 sm:h-[100dvh]">
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
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

      {/* min-h-0 is load-bearing: without it a flex child refuses to shrink below its content and
          the pane grows instead of scrolling, pushing the composer off the bottom of the screen. */}
      <div id={THREAD_ID} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {children}
      </div>

      {composer && (
        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">{composer}</div>
      )}
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
  grouped,
}: {
  message: BoardMessage
  team: TeamMember[]
  isMine: boolean
  /** Part of a run from the same author — render without repeating the avatar and name. */
  grouped: boolean
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

  if (grouped) {
    return (
      <article className={`rounded-xl border border-transparent bg-white px-4 pb-2 pt-0 ${isMine ? "border-l-2 border-l-violet-300" : ""}`}>
        <div className="pl-8">
          {message.body && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
              <MessageBody text={message.body} />
            </p>
          )}
          <Attachments message={message} />
        </div>
      </article>
    )
  }

  return (
    <article
      className={`mt-2 rounded-xl border bg-white p-4 ${isMine ? "border-l-2 border-l-violet-400" : ""} ${
        message.isTask && !message.isDone
          ? overdue
            ? "border-red-300 bg-red-50/40"
            : "border-amber-300"
          : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* Initials rather than photographs: nobody has uploaded one, and a row of identical grey
            silhouettes distinguishes nothing. The colour is derived from the user id, so a person is
            the same colour on every message and the eye can follow one voice down the page without
            reading a single name. */}
        <Avatar name={message.authorName} seed={message.authorId ?? message.authorName} />
        <span className="text-xs font-bold text-slate-900">
          {isMine ? "You" : message.authorName}
        </span>
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
      {message.body && (
        <p
          className={`mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed ${
            message.isDone ? "text-slate-400 line-through" : "text-slate-800"
          }`}
        >
          <MessageBody text={message.body} muted={message.isDone} />
        </p>
      )}

      <Attachments message={message} />

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

/**
 * An image or a link card hanging off a message.
 *
 * Rendered below the text rather than replacing it, because the caption is usually the point — the
 * picture is what somebody is talking about, not the message itself.
 */
function Attachments({ message }: { message: BoardMessage }) {
  if (!message.imageUrl && !message.link) return null

  return (
    <div className="mt-2 space-y-2">
      {message.imageUrl && (
        /* Opens full size in a new tab rather than a lightbox. A modal would be a client component
           and a focus trap to maintain, to show one image somebody can already open. */
        <a href={message.imageUrl} target="_blank" rel="noreferrer noopener" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.imageUrl}
            alt=""
            loading="lazy"
            className="max-h-80 w-auto max-w-full rounded-xl border border-slate-200 object-contain"
          />
        </a>
      )}

      {message.link && (
        <a
          href={message.link.url}
          target="_blank"
          rel="noreferrer noopener"
          className="flex max-w-lg gap-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-slate-300 hover:bg-white"
        >
          {message.link.imageUrl && (
            /* Fixed width and shrink-0: a flex item will not go below its content width on its own,
               and a wide thumbnail would otherwise squeeze the title into a column of single
               letters. This exact bug has been fixed three times in this project. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={message.link.imageUrl}
              alt=""
              loading="lazy"
              className="h-auto w-24 shrink-0 self-stretch object-cover"
            />
          )}
          <div className={`min-w-0 flex-1 py-2.5 pr-3 ${message.link.imageUrl ? "" : "pl-3"}`}>
            {message.link.siteName && (
              <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {message.link.siteName}
              </p>
            )}
            {message.link.title && (
              <p className="mt-0.5 line-clamp-2 text-xs font-bold text-slate-800">
                {message.link.title}
              </p>
            )}
            {message.link.description && (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
                {message.link.description}
              </p>
            )}
          </div>
        </a>
      )}
    </div>
  )
}

function Composer({ team, canAttach }: { team: TeamMember[]; canAttach: boolean }) {
  return (
    /* multipart, or the file never leaves the browser — a server action reads a plain urlencoded
       form fine, and the image would silently arrive as a filename string. */
    <form
      action={postMessage}
      encType="multipart/form-data"
      className="rounded-2xl border-2 border-slate-300 bg-white p-3"
    >
      <textarea
        name="body"
        rows={3}
        maxLength={4000}
        placeholder="Write to the team… paste a link and it will preview"
        className="w-full resize-none border-0 bg-transparent p-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
        {canAttach && (
          /* A plain file input styled as a button. No preview thumbnail, which would mean making the
             whole composer a client component to show something the file picker already showed. */
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
            <span aria-hidden="true">📎</span>
            Photo
            <input
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
            />
          </label>
        )}
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

/**
 * Initials on a coloured disc, the colour derived from the person rather than their position.
 *
 * Seeding from the user id rather than the name matters: two people called Priya would otherwise be
 * the same colour, and a renamed account would silently change colour and break the recognition the
 * avatar exists to provide.
 *
 * The palette is picked for distinguishability rather than prettiness — the hues stay apart for the
 * common forms of colour blindness, and the initials carry the meaning regardless, so colour is a
 * shortcut here and never the information.
 */
const AVATAR_COLOURS = [
  "bg-violet-500",
  "bg-amber-500",
  "bg-teal-600",
  "bg-rose-500",
  "bg-sky-600",
  "bg-emerald-600",
  "bg-fuchsia-600",
  "bg-slate-600",
]

function Avatar({ name, seed }: { name: string; seed: string }) {
  const initials = name
    .split(/s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  const colour = AVATAR_COLOURS[hash % AVATAR_COLOURS.length]

  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${colour}`}
    >
      {initials || "?"}
    </span>
  )
}

/** Today, Yesterday, or the date — a board read weeks later needs to know which. */
function DayDivider({ date }: { date: Date }) {
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const day = date.toDateString()

  const label =
    day === today
      ? "Today"
      : day === yesterday
        ? "Yesterday"
        : date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })

  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-slate-200" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
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
