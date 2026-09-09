"use client"

import { useEffect } from "react"

/**
 * Opens the board at the newest message.
 *
 * The thread now scrolls inside its own pane rather than the page, and a fresh scroll container
 * starts at the top — which on a chat means the oldest thing anyone ever wrote. Every other message
 * app opens at the bottom because that is where the unread things are, and a board that opened on
 * last month's conversation would be one people scroll past on arrival, every time.
 *
 * Instant rather than smooth: an animated scroll on load is a page that visibly moves under someone
 * who has already started reading. There is nothing to watch here, only a starting position.
 *
 * Runs once, on mount. Posting a message reloads the page, so a new message arrives as a new mount
 * and lands at the bottom again without any of this having to track it.
 */
export default function ScrollToLatest({ targetId }: { targetId: string }) {
  useEffect(() => {
    const pane = document.getElementById(targetId)
    if (pane) pane.scrollTop = pane.scrollHeight
  }, [targetId])

  return null
}
