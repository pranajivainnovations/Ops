"use client"

import { NextStudio } from "next-sanity/studio"

import { crossfriendConfig } from "@/sanity/config"

/**
 * The CrossFriend Studio, inside OPS.
 *
 * ── Why it is mounted here rather than linked out to sanity.io ─────────────────────────────────
 * Everything else about running these brands happens in OPS — pincodes, bakers, announcements, the
 * board. Sending someone to a different domain with a different login to write an article makes
 * publishing the one task that lives outside the tool, which is how it stops happening. Mounted
 * here it sits in the same navigation as the rest of the work.
 *
 * ── The catch-all segment is not optional ──────────────────────────────────────────────────────
 * `[[...tool]]` exists because the Studio does its own routing underneath this path — every
 * document, pane and tab is a URL. Without the catch-all the first navigation inside the Studio
 * lands on a 404 from Next before the Studio ever sees it.
 *
 * ── Two layers of auth, and why both are wanted ────────────────────────────────────────────────
 * OPS's own proxy.ts already refuses this route without an `ops_session`. Sanity then requires its
 * own login before it will read or write anything, because the browser talks to sanity.io directly
 * rather than through OPS. That is not redundancy to remove: the OPS session keeps the Studio off
 * the public internet, and the Sanity session is what actually authorises the edit and records who
 * made it.
 */
export default function CrossFriendStudioPage() {
  return (
    /* The Studio manages its own scrolling and expects a definite height. The shell's header is
       3.25rem on a phone and absent from sm: upwards, matching the board screen. */
    <div className="h-[calc(100dvh-3.25rem)] sm:h-[100dvh]">
      <NextStudio config={crossfriendConfig} />
    </div>
  )
}
