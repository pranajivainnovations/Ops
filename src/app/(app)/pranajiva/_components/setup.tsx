import { driveConfig } from "@/lib/google-drive"

/**
 * Shown when Drive is not configured at all.
 *
 * An unconfigured integration and a pipeline that has produced nothing look identical from the
 * outside — both are an empty list. Distinguishing them is the whole job of this panel, so it says
 * which of the three variables is missing rather than a generic "not set up".
 */
export function SetupPanel() {
  const missing = [
    ["GOOGLE_DRIVE_CLIENT_EMAIL", process.env.GOOGLE_DRIVE_CLIENT_EMAIL],
    ["GOOGLE_DRIVE_PRIVATE_KEY", process.env.GOOGLE_DRIVE_PRIVATE_KEY],
    ["GOOGLE_DRIVE_ROOT_FOLDER_ID", process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name as string)

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
      <h2 className="text-sm font-bold text-amber-900">Google Drive is not connected yet</h2>
      <p className="mt-1 max-w-2xl text-xs text-amber-800">
        This section reads the Cowork research pipelines&rsquo; output straight from Drive. Three
        environment variables connect it — {missing.length === 3 ? "none are set" : `missing: ${missing.join(", ")}`}.
      </p>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs text-amber-900">
        <li>
          In Google Cloud, create a service account and a JSON key. It needs no roles &mdash; access
          comes from Drive sharing, not IAM.
        </li>
        <li>
          Share the research root folder with the service account&rsquo;s email address as{" "}
          <strong>Viewer</strong>. Share only that folder.
        </li>
        <li>Set the three variables below from the JSON key, and restart OPS.</li>
      </ol>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-amber-900/90 p-3 text-[11px] leading-relaxed text-amber-50">
        {`GOOGLE_DRIVE_CLIENT_EMAIL=...@....iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
GOOGLE_DRIVE_ROOT_FOLDER_ID=<the folder id from the Drive URL>`}
      </pre>
    </div>
  )
}

/**
 * Shown when the research reads fine but the decisions table is not there yet.
 *
 * Separated from the Drive panels because the two halves of this section fail independently: Drive
 * supplies the research, Postgres supplies the judgement on it, and one being unavailable says
 * nothing about the other. Naming the migration is the point — "database error" would send someone
 * looking in the wrong repository.
 */
export function MigrationPendingPanel() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-bold text-amber-900">Decisions cannot be saved yet</p>
      <p className="mt-1 max-w-3xl text-xs text-amber-800">
        The <code className="rounded bg-amber-100 px-1">pranajiva.decisions</code> table does not
        exist on this database, so the decision controls below will not persist anything. Everything
        read from Drive is unaffected. Apply{" "}
        <code className="rounded bg-amber-100 px-1">
          1724100000000-CreatePranajivaResearchSchema
        </code>{" "}
        in the Backend repo and this notice disappears.
      </p>
    </div>
  )
}

/**
 * Shown when Drive is configured but the read failed.
 *
 * Names the service account, because the overwhelmingly common cause is a folder that was never
 * shared with it — and that address is the thing the person fixing it needs to paste into Drive.
 */
export function DriveErrorPanel({ message }: { message: string }) {
  const config = driveConfig()

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
      <h2 className="text-sm font-bold text-rose-900">Could not read from Google Drive</h2>
      <p className="mt-1 text-xs text-rose-800">{message}</p>
      {config && (
        <p className="mt-3 text-xs text-rose-800">
          Check that the research folder is shared as Viewer with{" "}
          <code className="rounded bg-rose-100 px-1 font-semibold">{config.clientEmail}</code>.
        </p>
      )}
    </div>
  )
}
