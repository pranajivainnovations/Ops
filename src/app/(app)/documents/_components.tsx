import { ROOT_FOLDER_ENV, driveConfig } from "@/lib/google-drive"

/**
 * Setup and failure states for the CrossFriend document library.
 *
 * These are deliberately not shared with the Pranajiva panels even though they look alike. The two
 * sections fail for different reasons and are fixed in different places: Pranajiva's root is already
 * connected and its likely fault is a pipeline that produced nothing, while this one's likely fault
 * is a folder nobody has shared yet. A panel that covered both would have to stop naming either, and
 * naming the exact variable and the exact folder is the only thing that makes a setup screen useful.
 */

const FOLDER_NAME = "CROSSFRIEND_MARKETING"

/** Shown when the CrossFriend root has not been configured. */
export function SetupPanel() {
  const hasCredentials = Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL && process.env.GOOGLE_DRIVE_PRIVATE_KEY
  )

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
      <h2 className="text-sm font-bold text-amber-900">
        The CrossFriend document folder is not connected yet
      </h2>
      <p className="mt-1 max-w-2xl text-xs text-amber-800">
        {hasCredentials ? (
          <>
            The Drive service account is already configured — the Pranajiva section uses it. All that
            is missing is which folder to read for CrossFriend.
          </>
        ) : (
          <>
            This section reads the CrossFriend marketing artefacts straight from Drive, using the same
            read-only service account as the Pranajiva knowledge base.
          </>
        )}
      </p>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs text-amber-900">
        <li>
          In Drive, share <strong>{FOLDER_NAME}</strong> with the service account as{" "}
          <strong>Viewer</strong>.
        </li>
        <li>
          Set <code className="rounded bg-amber-100 px-1">{ROOT_FOLDER_ENV.crossfriend}</code> to that
          folder&rsquo;s ID — the part of its Drive URL after <code>/folders/</code>.
        </li>
        <li>Restart OPS.</li>
      </ol>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-amber-900/90 p-3 text-[11px] leading-relaxed text-amber-50">
        {`${ROOT_FOLDER_ENV.crossfriend}=<the folder id from the Drive URL>`}
      </pre>
    </div>
  )
}

/**
 * Shown when the folder is configured but could not be read.
 *
 * Names the service account address, because the overwhelmingly common cause is a folder that was
 * created and never shared with it — and that address is the thing the person fixing it needs to
 * paste into Drive's share dialog.
 */
export function DriveErrorPanel({ message }: { message: string }) {
  const config = driveConfig("crossfriend")

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
      <h2 className="text-sm font-bold text-rose-900">Could not read from Google Drive</h2>
      <p className="mt-1 text-xs text-rose-800">{message}</p>
      {config && (
        <p className="mt-3 text-xs text-rose-800">
          Check that <strong>{FOLDER_NAME}</strong> is shared as Viewer with{" "}
          <code className="rounded bg-rose-100 px-1 font-semibold">{config.clientEmail}</code>. A
          folder that exists but has never been shared returns the same 404 as one that does not.
        </p>
      )}
    </div>
  )
}

/**
 * Stage names arrive as `03_CONTENT` — a sort key with a label welded to the front.
 *
 * The number is load-bearing for ordering and noise for reading, so it is stripped for display and
 * kept for the sort. Folders without one keep their name exactly as it is; inventing an order for
 * them would be guessing.
 */
export function stageLabel(name: string): string {
  return name.replace(/^\d+[_-]/, "").replace(/_/g, " ")
}

export function stageSort(a: string, b: string): number {
  const rank = (n: string) => {
    const match = /^(\d+)/.exec(n)
    // Unnumbered folders sort after every numbered one rather than interleaving at zero.
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
  }
  return rank(a) - rank(b) || a.localeCompare(b)
}
