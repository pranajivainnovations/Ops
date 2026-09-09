import type { MetadataRoute } from "next"

/**
 * The web app manifest, which exists for one reason: iOS.
 *
 * Safari exposes the push API only to a page launched from the Home Screen, and the board tells
 * anyone on an iPhone to put it there. Without a manifest that instruction half-works — the shortcut
 * opens in a browser tab, the API stays missing, and the advice looks wrong. `display: standalone`
 * is what makes the shortcut a real web app.
 *
 * Everywhere else this is harmless: desktop Chrome may offer to install OPS, which for a tool the
 * team opens every day is a small improvement rather than a change of direction.
 *
 * No icons declared. There is no OPS icon asset yet, and pointing at one that does not exist would
 * be worse than letting each platform fall back to what it already does.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CrossFriend Ops",
    short_name: "Ops",
    description: "Operations for CrossFriend and Pranajiva.",
    start_url: "/board",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
  }
}
