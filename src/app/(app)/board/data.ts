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
  /** An image shared with the message, in our own bucket. Null on an ordinary message. */
  imageUrl: string | null
  /** The Open Graph card for the first link, captured when the message was posted. */
  link: LinkCard | null
}

export interface LinkCard {
  url: string
  title: string | null
  description: string | null
  imageUrl: string | null
  siteName: string | null
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
 * True when the attachment columns exist.
 *
 * Checked separately from the table because the two migrations land independently: between deploying
 * this code and running AddBoardAttachments, every board query would name columns that are not there
 * and the page would fail whole. Asking first costs one cheap catalogue lookup and keeps the board
 * readable in that window, minus the attachments it cannot store yet.
 */
export async function attachmentsSchemaReady(): Promise<boolean> {
  const { rows } = await getDbPool().query<{ ready: boolean }>(
    `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'crossfriend'
           AND table_name   = 'team_messages'
           AND column_name  = 'image_url'
      ) AS ready`
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
export async function loadBoard(hasAttachments: boolean, limit = 500): Promise<BoardMessage[]> {
  /* Selected as literal NULLs before the migration lands, so the shape of every row is identical
     either way and nothing downstream has to know which state the database is in. */
  const attachmentColumns = hasAttachments
    ? `m.image_url,
            m.link_url,
            m.link_title,
            m.link_description,
            m.link_image_url,
            m.link_site`
    : `NULL::text AS image_url,
            NULL::text AS link_url,
            NULL::text AS link_title,
            NULL::text AS link_description,
            NULL::text AS link_image_url,
            NULL::text AS link_site`

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
            COALESCE(closer.name, closer.email)                 AS done_by_name,
            ${attachmentColumns}
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
      imageUrl: r.image_url ?? null,
      /* The card is assembled only when there is a URL to point it at. The database enforces the
         same rule, so a row with orphaned preview text cannot exist — this is the reader agreeing
         with the constraint rather than re-deciding it. */
      link: r.link_url
        ? {
            url: r.link_url,
            title: r.link_title ?? null,
            description: r.link_description ?? null,
            imageUrl: r.link_image_url ?? null,
            siteName: r.link_site ?? null,
          }
        : null,
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

/**
 * How many messages have arrived since this person last opened the board.
 *
 * Own messages are excluded — being told about your own typing is the fastest route to a badge
 * everybody learns to ignore. Someone who has never opened the board has no row, and rather than
 * showing them every message ever written, the count starts from their first visit: a first-day
 * badge reading "412" is noise, not a welcome.
 */
export async function unreadCount(userId: string): Promise<number> {
  const { rows } = await getDbPool().query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM crossfriend.team_messages m
       JOIN crossfriend.team_board_reads r ON r.user_id = $1
      WHERE m.created_at > r.last_seen_at
        AND m.author_id IS DISTINCT FROM $1
        AND m.deleted_at IS NULL`,
    [userId]
  )
  return rows[0]?.n ?? 0
}

/** Records that this person has now seen the board. Called when the page renders. */
export async function markBoardSeen(userId: string): Promise<void> {
  await getDbPool().query(
    `INSERT INTO crossfriend.team_board_reads (user_id, last_seen_at)
     VALUES ($1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET last_seen_at = NOW()`,
    [userId]
  )
}

/** True when the push tables exist, so the board can degrade rather than error before migration. */
export async function pushSchemaReady(): Promise<boolean> {
  const { rows } = await getDbPool().query<{ ready: boolean }>(
    `SELECT to_regclass('crossfriend.team_board_reads') IS NOT NULL AS ready`
  )
  return Boolean(rows[0]?.ready)
}
