import { NextResponse } from "next/server"

/**
 * What this container was built from.
 *
 * Read at request time from environment variables stamped into the runner stage by `docker build
 * --build-arg`, so the answer describes the image that is actually running — not what a repo, a log
 * file, or anyone's memory says should be running. Those diverge: a fix sat in the working tree
 * through two production builds while everyone believed it had shipped, and work that had shipped
 * was repeatedly reported as pending. A rollback shows the rolled-back commit here, and a deploy
 * from a different machine is still reported correctly, because nothing about this depends on the
 * developer's checkout.
 *
 * `tree` is the field that decides how much the commit is worth. `clean` means the named commit is
 * exactly what shipped. `dirty` means uncommitted files were built in, so the commit identifies
 * roughly-what-shipped and the timestamp is the more reliable comparison.
 *
 * Deliberately public and unauthenticated. A short commit hash from a private repo is not
 * actionable on its own, and gating it would mean a shared secret in five more places — the same
 * env plumbing that has already failed twice here. It exposes no configuration and touches no
 * database.
 */
export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(
    {
      service: "crossfriend-ops",
      commit: process.env.BUILD_COMMIT || "unknown",
      branch: process.env.BUILD_BRANCH || "unknown",
      tree: process.env.BUILD_TREE || "unknown",
      builtAt: process.env.BUILD_TIME || "unknown",
      // Not build provenance, but it travels with it and is the other thing worth knowing when a
      // deploy looks wrong.
      node: process.version,
    },
    {
      // A cached answer here would be worse than no answer: the whole point is to reflect the
      // running container at the moment it is asked.
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  )
}
