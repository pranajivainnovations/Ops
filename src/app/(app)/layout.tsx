import { getCurrentSession } from "@/lib/auth"
import { pushSchemaReady, unreadCount } from "./board/data"
import AppShell from "./app-shell"

/**
 * The unread count is fetched here rather than inside the shell because the shell is a client
 * component and the count needs the database and the session cookie.
 *
 * It costs one indexed count per page load across all of OPS, which for a team of this size is
 * nothing — and it is what makes the board work at all. A board nobody is told about is a board
 * nobody opens.
 *
 * Every failure path returns zero. A badge is a convenience; it must never be the reason a page
 * fails to render, and "no badge" is a much better wrong answer than an error screen.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let unread = 0

  try {
    const session = await getCurrentSession()
    if (session?.userId && (await pushSchemaReady())) {
      unread = await unreadCount(session.userId)
    }
  } catch {
    unread = 0
  }

  return <AppShell boardUnread={unread}>{children}</AppShell>
}
