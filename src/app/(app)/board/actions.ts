"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth"
import { getDbPool } from "@/lib/db"

/**
 * Writing to the team board.
 *
 * Every action re-reads the session rather than trusting anything the form carries. A hidden author
 * field would be a text box anyone could retype, and "who said this" is the only thing on this
 * screen that has to be true — a board where a message can be posted under someone else's name is
 * worse than no board.
 */

const MAX_BODY = 4000

function fail(message: string): never {
  redirect(`/board?error=${encodeURIComponent(message)}`)
}

function str(formData: FormData, key: string): string {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

async function requireUser(): Promise<string> {
  const session = await getCurrentSession()
  if (!session?.userId) fail("Your session has expired — please sign in again.")
  return session.userId
}

export async function postMessage(formData: FormData): Promise<void> {
  const userId = await requireUser()
  const body = str(formData, "body")

  if (!body) fail("Write something first.")
  if (body.length > MAX_BODY) fail(`Messages are limited to ${MAX_BODY} characters.`)

  // Marking as a task at post time is a convenience, not the only route — anything can be marked
  // later, which is the point of storing both in one row.
  const isTask = formData.get("is_task") === "on"
  const assignee = str(formData, "assignee_id") || null
  const dueOn = str(formData, "due_on") || null

  await getDbPool().query(
    `INSERT INTO crossfriend.team_messages (author_id, body, is_task, assignee_id, due_on)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, body, isTask, isTask ? assignee : null, isTask ? dueOn : null]
  )

  revalidatePath("/board")
}

/** Promote a message to a task, or demote it back to an ordinary message. */
export async function toggleTask(formData: FormData): Promise<void> {
  await requireUser()
  const id = str(formData, "id")
  if (!id) fail("Missing message.")

  await getDbPool().query(
    `UPDATE crossfriend.team_messages
        SET is_task = NOT is_task,
            /* Demoting clears the task state rather than leaving a closed task hiding inside an
               ordinary message, which would reappear the next time anyone marked it. */
            is_done     = CASE WHEN is_task THEN FALSE ELSE is_done END,
            done_at     = CASE WHEN is_task THEN NULL  ELSE done_at END,
            done_by     = CASE WHEN is_task THEN NULL  ELSE done_by END,
            assignee_id = CASE WHEN is_task THEN NULL  ELSE assignee_id END,
            due_on      = CASE WHEN is_task THEN NULL  ELSE due_on END
      WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )

  revalidatePath("/board")
}

export async function toggleDone(formData: FormData): Promise<void> {
  const userId = await requireUser()
  const id = str(formData, "id")
  if (!id) fail("Missing task.")

  await getDbPool().query(
    `UPDATE crossfriend.team_messages
        SET is_done = NOT is_done,
            done_at = CASE WHEN is_done THEN NULL ELSE NOW() END,
            /* The cast is load-bearing. A bare $2 inside a CASE alongside NULL gives Postgres
               nothing to infer from, so it types the parameter as text and refuses to assign it to a
               uuid column — "column done_by is of type uuid but expression is of type text". Direct
               assignments elsewhere infer from the target column and need no cast; only the CASE
               loses that. */
            done_by = CASE WHEN is_done THEN NULL ELSE $2::uuid END
      WHERE id = $1 AND is_task AND deleted_at IS NULL`,
    [id, userId]
  )

  revalidatePath("/board")
}

export async function assignTask(formData: FormData): Promise<void> {
  await requireUser()
  const id = str(formData, "id")
  if (!id) fail("Missing task.")

  await getDbPool().query(
    `UPDATE crossfriend.team_messages
        SET assignee_id = $2::uuid,
            due_on      = $3::date
      WHERE id = $1 AND is_task AND deleted_at IS NULL`,
    [id, str(formData, "assignee_id") || null, str(formData, "due_on") || null]
  )

  revalidatePath("/board")
}

/**
 * Soft delete, and only your own.
 *
 * Removing the row outright would leave the conversation around it senseless — answers to a question
 * nobody can see. The board renders a tombstone instead, which is honest about what happened.
 */
export async function deleteMessage(formData: FormData): Promise<void> {
  const userId = await requireUser()
  const id = str(formData, "id")
  if (!id) fail("Missing message.")

  await getDbPool().query(
    `UPDATE crossfriend.team_messages
        SET deleted_at = NOW()
      WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`,
    [id, userId]
  )

  revalidatePath("/board")
}
