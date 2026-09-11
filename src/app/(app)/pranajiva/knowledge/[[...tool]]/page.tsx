"use client"

import { NextStudio } from "next-sanity/studio"

import { pranajivaConfig } from "@/sanity/config"

/**
 * The Pranajiva Studio, inside OPS.
 *
 * Same arrangement as the CrossFriend one next door — see that file for why the Studio is embedded
 * rather than linked, why the catch-all segment is required, and why two logins is the right number.
 *
 * ── Why a second mount instead of one Studio with a workspace switcher ─────────────────────────
 * Sanity supports several workspaces in a single Studio. That would put a brand selector inside a
 * tool that already sits inside a brand section of OPS — two ways to be in the wrong place, one of
 * which is easy to miss. Here the brand is decided by the navigation you used to arrive.
 */
export default function PranajivaStudioPage() {
  return (
    <div className="h-[calc(100dvh-3.25rem)] sm:h-[100dvh]">
      <NextStudio config={pranajivaConfig} />
    </div>
  )
}
