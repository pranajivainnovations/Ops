"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth"
import { getDbPool } from "@/lib/db"
import { fetchLinkPreview, firstUrl } from "@/lib/link-preview"
import { notifyTeam } from "@/lib/push"
import { uploadBoardImage } from "@/lib/s3"

import { attachmentsSchemaReady } from "./data"

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

  if (body.length > MAX_BODY) fail(`Messages are limited to ${MAX_BODY} characters.`)

  /**
   * Attachments only once their columns exist.
   *
   * Between this code deploying and AddBoardAttachments running, an INSERT naming image_url would
   * fail and the board would refuse every message. Checking first means the worst case in that
   * window is a photo that does not send, with the text still going through.
   */
  const canAttach = await attachmentsSchemaReady()

  let imageUrl: string | null = null
  const file = formData.get("image")
  if (canAttach && file instanceof File && file.size > 0) {
    try {
      const uploaded = await uploadBoardImage(Buffer.from(await file.arrayBuffer()), file.type)
      imageUrl = uploaded.url
    } catch (error) {
      fail(error instanceof Error ? error.message : "Could not upload that image.")
    }
  }

  // A photo with no caption is an ordinary message; nothing at all is not.
  if (!body && !imageUrl) fail("Write something, or attach an image.")

  /**
   * The link card is read once, here, and stored — see the migration for why not at render time.
   *
   * Never allowed to fail the post: a site that is slow, down, or blocking us costs the message its
   * preview and nothing else. The link is still in the text either way.
   */
  let preview: Awaited<ReturnType<typeof fetchLinkPreview>> = null
  if (canAttach) {
    const url = firstUrl(body)
    if (url) preview = await fetchLinkPreview(url).catch(() => null)
  }

  // Marking as a task at post time is a convenience, not the only route — anything can be marked
  // later, which is the point of storing both in one row.
  const isTask = formData.get("is_task") === "on"
  const assignee = str(formData, "assignee_id") || null
  const dueOn = str(formData, "due_on") || null

  if (canAttach) {
    await getDbPool().query(
      `INSERT INTO crossfriend.team_messages
         (author_id, body, is_task, assignee_id, due_on,
          image_url, link_url, link_title, link_description, link_image_url, link_site)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        userId, body, isTask, isTask ? assignee : null, isTask ? dueOn : null,
        imageUrl,
        preview?.url ?? null,
        preview?.title ?? null,
        preview?.description ?? null,
        preview?.imageUrl ?? null,
        preview?.siteName ?? null,
      ]
    )
  } else {
    await getDbPool().query(
      `INSERT INTO crossfriend.team_messages (author_id, body, is_task, assignee_id, due_on)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, body, isTask, isTask ? assignee : null, isTask ? dueOn : null]
    )
  }

  /**
   * Notify after the write, never before, and never in a way that can fail the post.
   *
   * The author's name is looked up rather than passed from the form for the same reason the author
   * id is: a notification saying who spoke has to be true. Awaited rather than fired and forgotten
   * because a server action's process can be torn down the moment it returns, and a floating promise
   * would be cancelled somewhere between "sometimes" and "usually".
   */
  const { rows } = await getDbPool().query(
    `SELECT COALESCE(name, email) AS name FROM baker_network.ops_users WHERE id = $1`,
    [userId]
  )
  const author = rows[0]?.name ?? "Someone"

  // A one-line preview. The whole message could be anything up to 4,000 characters, and a
  // notification is a doorway, not the room.
  const notificationText = body || "sent an image"
  const notificationPreview =
    notificationText.length > 120 ? `${notificationText.slice(0, 117)}…` : notificationText

  if (isTask && assignee && assignee !== userId) {
    // Assigned work is addressed to one person, so it is worth interrupting them specifically —
    // and it says so, rather than looking like any other message.
    await notifyTeam(
      { title: `${author} assigned you a task`, body: notificationPreview, url: "/board?view=tasks", tag: "ops-task" },
      { onlyUserId: assignee }
    )
    await notifyTeam(
      { title: `${author} added a task`, body: notificationPreview, url: "/board", tag: "ops-board" },
      { exceptUserId: userId }
    )
  } else {
    await notifyTeam(
      {
        title: isTask ? `${author} added a task` : `${author} posted`,
        body: notificationPreview,
        url: "/board",
        tag: "ops-board",
      },
      { exceptUserId: userId }
    )
  }

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

  const assignee = str(formData, "assignee_id") || null

  const { rows } = await getDbPool().query(
    `UPDATE crossfriend.team_messages
        SET assignee_id = $2::uuid,
            due_on      = $3::date
      WHERE id = $1 AND is_task AND deleted_at IS NULL
      RETURNING body`,
    [id, assignee, str(formData, "due_on") || null]
  )

  /**
   * Only the new assignee, and only if it is not the person doing the assigning.
   *
   * Assigning something to yourself is a note to self, not news. Telling the rest of the team about
   * every reassignment would also make the busiest board activity the least interesting one.
   */
  const actor = await getCurrentSession()
  if (assignee && assignee !== actor?.userId && rows[0]) {
    const body = rows[0].body as string
    await notifyTeam(
      {
        title: "A task was assigned to you",
        body: body.length > 120 ? `${body.slice(0, 117)}…` : body,
        url: "/board?view=tasks",
        tag: "ops-task",
      },
      { onlyUserId: assignee }
    )
  }

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
