"use client"

import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react"
import { useFormStatus } from "react-dom"

import { postMessage } from "./actions"
import type { TeamMember } from "./data"

/**
 * The box you write in.
 *
 * ── Why the send button knows it is sending ────────────────────────────────────────────────────
 * This is the bug that produced five copies of one message. Posting takes a moment — the image
 * uploads to S3, a link is fetched for its preview, the row is written — and during all of it the
 * form looked untouched: text still in the box, button still live, nothing moving. So it read as
 * "that did not work", and pressing again is the reasonable thing to do. Five presses, five rows.
 *
 * `useFormStatus` is what the form itself knows about its own submission, so the guard cannot drift
 * from reality the way a hand-rolled flag can. It disables the button, disables the box, and says
 * "Sending…", which answers the question that caused the retries. React 19 clears the fields once
 * the action resolves; a failed post redirects instead, and the message stays where it was typed.
 *
 * ── Why the box is one line until you touch it ─────────────────────────────────────────────────
 * A three-line box costs three lines of thread whether or not anybody is typing, and on a phone the
 * thread is the part that has no room. Chat apps all resolve this the same way: one line at rest,
 * room to write once you are writing. It expands on focus and stays expanded while there is a draft
 * or an attachment in it — collapsing under someone who has typed two lines and looked away would
 * hide their own words from them, which is worse than the space it saves.
 *
 * ── Why the task fields are hidden until they are needed ───────────────────────────────────────
 * The assignee and due date used to sit on screen permanently. On a phone the date input renders as
 * an unlabelled empty rectangle and the pair wrapped onto a second row, costing height on the one
 * screen that has none to spare, for two controls that mean nothing unless the message is a task.
 */
export default function Composer({
  team,
  canAttach,
}: {
  team: TeamMember[]
  canAttach: boolean
}) {
  const [hasText, setHasText] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isTask, setIsTask] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  /**
   * React resets the form's own fields, but not what this component remembers about them. Without
   * this the button would stay live over an empty box and a filename would linger under a cleared
   * file input.
   *
   * A failed post throws (it redirects), so none of this runs on failure — which is what keeps a
   * rejected message in the box instead of vanishing with the error.
   */
  const submit = async (formData: FormData) => {
    await postMessage(formData)
    setHasText(false)
    setFileName(null)
    setIsTask(false)
    if (fileInput.current) fileInput.current.value = ""
  }

  return (
    /* multipart, or the file never leaves the browser — a server action reads a plain urlencoded
       form fine, and the image would silently arrive as a filename string. */
    <form
      action={submit}
      encType="multipart/form-data"
      className="rounded-2xl border-2 border-slate-300 bg-white p-2.5 focus-within:border-slate-400 small:p-3"
    >
      {/* The fields live in a child because useFormStatus reports on the form above it, and would
          read "never pending" if it were called in the component that renders the form itself. */}
      <Fields
        team={team}
        canAttach={canAttach}
        hasText={hasText}
        setHasText={setHasText}
        fileName={fileName}
        setFileName={setFileName}
        isTask={isTask}
        setIsTask={setIsTask}
        fileInput={fileInput}
      />
    </form>
  )
}

function Fields({
  team,
  canAttach,
  hasText,
  setHasText,
  fileName,
  setFileName,
  isTask,
  setIsTask,
  fileInput,
}: {
  team: TeamMember[]
  canAttach: boolean
  hasText: boolean
  setHasText: Dispatch<SetStateAction<boolean>>
  fileName: string | null
  setFileName: Dispatch<SetStateAction<string | null>>
  isTask: boolean
  setIsTask: Dispatch<SetStateAction<boolean>>
  fileInput: RefObject<HTMLInputElement | null>
}) {
  const { pending } = useFormStatus()
  const [focused, setFocused] = useState(false)
  const canPost = (hasText || fileName !== null) && !pending

  // Anything worth reading back keeps the box open: a draft, an attachment, or a cursor in it.
  const expanded = focused || hasText || fileName !== null || pending

  const clearFile = () => {
    setFileName(null)
    if (fileInput.current) fileInput.current.value = ""
  }

  return (
    <>
      {/* Height rather than the rows attribute, so the change can be animated — rows snaps, and an
          input box that jumps under a thumb reads as a glitch rather than a response. */}
      <textarea
        name="body"
        rows={3}
        maxLength={4000}
        disabled={pending}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={expanded ? "Write to the team… paste a link and it will preview" : "Message the team…"}
        onChange={(event) => setHasText(event.target.value.trim().length > 0)}
        className={`w-full resize-none border-0 bg-transparent p-1 text-sm text-slate-900 transition-[height] duration-150 placeholder:text-slate-400 focus:outline-none disabled:text-slate-400 ${
          expanded ? "h-[4.25rem]" : "h-7"
        }`}
      />

      {fileName && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600">
          <span aria-hidden="true">🖼️</span>
          <span className="min-w-0 flex-1 truncate font-medium">{fileName}</span>
          <button
            type="button"
            onClick={clearFile}
            disabled={pending}
            className="shrink-0 font-bold text-slate-400 transition hover:text-red-500 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
        {canAttach && (
          /* A plain file input styled as a button. The chosen filename is echoed above rather than
             thumbnailed — the file picker already showed the picture, and the useful confirmation
             here is that something is attached at all. */
          <label
            className={`flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition ${
              pending ? "opacity-50" : "cursor-pointer hover:bg-slate-50"
            }`}
          >
            <span aria-hidden="true">📎</span>
            Photo
            <input
              ref={fileInput}
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp"
              disabled={pending}
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
              className="sr-only"
            />
          </label>
        )}

        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            name="is_task"
            checked={isTask}
            disabled={pending}
            onChange={(event) => setIsTask(event.target.checked)}
            className="h-3.5 w-3.5 accent-amber-500"
          />
          It&rsquo;s a task
        </label>

        {isTask && (
          <>
            <select
              name="assignee_id"
              defaultValue=""
              disabled={pending}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
            >
              <option value="">Anyone</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            {/* An empty date input shows nothing at all on most mobile browsers, so it is labelled
                here rather than left as a blank rectangle nobody can identify. */}
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              By
              <input
                type="date"
                name="due_on"
                disabled={pending}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
              />
            </label>
          </>
        )}

        <button
          type="submit"
          disabled={!canPost}
          className="ml-auto min-w-[4.5rem] rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {pending ? "Sending…" : "Post"}
        </button>
      </div>
    </>
  )
}
