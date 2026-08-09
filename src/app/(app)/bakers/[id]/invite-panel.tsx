"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"

import { issueInviteAction } from "./invite-actions"
import { EMPTY_INVITE_STATE, type InviteState } from "./invite-types"

export type ActivationState = "not_invited" | "invited" | "expired" | "activated"

const BADGE: Record<ActivationState, { label: string; className: string }> = {
  not_invited: { label: "Not invited", className: "bg-slate-100 text-slate-600" },
  invited: { label: "Invited", className: "bg-amber-100 text-amber-800" },
  expired: { label: "Invite expired", className: "bg-red-100 text-red-700" },
  activated: { label: "Activated", className: "bg-emerald-100 text-emerald-700" },
}

/**
 * Baker account invitation.
 *
 * The activation URL is shown exactly once, right after it is generated, and is never recoverable —
 * only its hash is stored. The copy above the link says so plainly, because an OPS user who assumes
 * they can come back for it later will close this panel and then have to re-issue, silently
 * invalidating the link they already sent.
 *
 * Re-inviting is offered but framed as what it actually does: it revokes the previous link. That
 * matters when a baker says "I never got it" — sending a second link means the first one dies, so
 * whoever does it needs to know that before clicking, not after.
 */
export default function InvitePanel({
  bakerId,
  state,
  expiresAt,
}: {
  bakerId: string
  state: ActivationState
  expiresAt: string | null
}) {
  const [result, formAction] = useActionState<InviteState, FormData>(
    issueInviteAction.bind(null, bakerId),
    EMPTY_INVITE_STATE
  )

  const badge = BADGE[state]
  const isReinvite = state === "invited" || state === "expired"

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Baker portal access</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Invite this bakery to set up their own login at the baker portal.
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {state === "activated" ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          This bakery has already set up its account and can sign in with its Baker ID. Nothing more
          to do here.
        </p>
      ) : (
        <>
          {state === "invited" && expiresAt && (
            <p className="mt-4 text-xs text-slate-500">
              An invite is already active until{" "}
              <span className="font-semibold text-slate-700">
                {new Date(expiresAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              . The link was shown once when it was created and can&apos;t be retrieved again.
            </p>
          )}
          {state === "expired" && (
            <p className="mt-4 text-xs text-slate-500">
              The previous invite expired without being used. Send a new one.
            </p>
          )}

          <form action={formAction} className="mt-4">
            <SubmitButton isReinvite={isReinvite} />
            {isReinvite && (
              <p className="mt-2 text-xs text-amber-700">
                Sending a new invite immediately cancels the previous link.
              </p>
            )}
          </form>
        </>
      )}

      {result.error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {result.error}
        </p>
      )}

      {result.activationUrl && (
        <ActivationLink url={result.activationUrl} expiresAt={result.expiresAt} />
      )}
    </section>
  )
}

function SubmitButton({ isReinvite }: { isReinvite: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
    >
      {pending ? "Creating…" : isReinvite ? "Send a new invite" : "Invite baker"}
    </button>
  )
}

function ActivationLink({ url, expiresAt }: { url: string; expiresAt: string | null }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard access can be denied (insecure origin, permissions). The link is selectable text
      // right there, so this needs no error state — just don't claim success.
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-xs font-bold text-amber-900">
        Copy this link now — it won&apos;t be shown again
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Send it to the bakery. They&apos;ll use it once to set their password.
        {expiresAt && (
          <>
            {" "}
            It expires on{" "}
            {new Date(expiresAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            .
          </>
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Activation link"
          className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 font-mono text-xs text-slate-800"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  )
}
