import { getDbPool } from "@/lib/db"

/**
 * Reading the team board.
 *
 * One query, in chronological order, because that is what a conversation is. Filtering happens in
 * the page rather than in SQL for the task views — the board is bounded by how much a small team
 * writes, and a second round trip to hide a few rows is a worse trade than reading them all once.
 */

export interface BoardMessage {
  id: string
  body: string
  authorId: string | null
  authorName: string
  createdAt: Date
  editedAt: Date | null
  deletedAt: Date | null
  isTask: boolean
  isDone: boolean
  assigneeId: string | null
  assigneeName: string | null
  dueOn: string | null
  doneAt: Date | null
  doneByName: string | null
}

export interface TeamMember {
  id: string
  name: string
}

/** True when the table has not been created yet, so the page can say so instead of erroring. */
export async function boardSchemaReady(): Promise<boolean> {
  const { rows } = await getDbPool().query<{ ready: boolean }>(
    `SELECT to_regclass('crossfriend.team_messages') IS NOT NULL AS ready`
  )
  return Boolean(rows[0]?.ready)
}

/**
 * The whole board, oldest first.
 *
 * A hard limit rather than pagination. The board is read from the bottom like any chat, so the
 * useful direction is backwards from now — and a team that has written more than a thousand messages
 * has earned a proper search, which is a different feature than a scrollback.
 */
export async function loadBoard(limit = 500): Promise<BoardMessage[]> {
  const { rows } = await getDbPool().query(
    `SELECT m.id,
            m.body,
            m.author_id,
            COALESCE(author.name, author.email, 'Removed user') AS author_name,
            m.created_at,
            m.edited_at,
            m.deleted_at,
            m.is_task,
            m.is_done,
            m.assignee_id,
            COALESCE(assignee.name, assignee.email)             AS assignee_name,
            m.due_on,
            m.done_at,
            COALESCE(closer.name, closer.email)                 AS done_by_name
       FROM crossfriend.team_messages m
       LEFT JOIN baker_network.ops_users author   ON author.id   = m.author_id
       LEFT JOIN baker_network.ops_users assignee ON assignee.id = m.assignee_id
       LEFT JOIN baker_network.ops_users closer   ON closer.id   = m.done_by
      ORDER BY m.created_at DESC
      LIMIT $1`,
    [limit]
  )

  // Newest first out of the database so the limit takes the most recent, then reversed so the board
  // reads top to bottom like a conversation.
  return rows
    .map((r) => ({
      id: r.id,
      body: r.body,
      authorId: r.author_id,
      authorName: r.author_name,
      createdAt: r.created_at,
      editedAt: r.edited_at,
      deletedAt: r.deleted_at,
      isTask: r.is_task,
      isDone: r.is_done,
      assigneeId: r.assignee_id,
      assigneeName: r.assignee_name,
      // DATE comes back as a Date in this driver; the board only ever shows the day.
      dueOn: r.due_on ? new Date(r.due_on).toISOString().slice(0, 10) : null,
      doneAt: r.done_at,
      doneByName: r.done_by_name,
    }))
    .reverse()
}

/** Active team members, for the assignee picker. */
export async function loadTeam(): Promise<TeamMember[]> {
  const { rows } = await getDbPool().query(
    `SELECT id, COALESCE(name, email) AS name
       FROM baker_network.ops_users
      WHERE is_active
      ORDER BY COALESCE(name, email)`
  )
  return rows.map((r) => ({ id: r.id, name: r.name }))
}
