import { getCurrentSession } from "@/lib/auth"
import { callBackend } from "@/lib/backend"
import { SectionHeader } from "../_components/header"
import KeyForm from "./key-form"

export const dynamic = "force-dynamic"

interface Credential {
  provider: string
  model: string
  keyLast4: string
  monthlyCapCents: number
  spentThisMonthCents: number
}

/**
 * The operator's own API key, and the ceiling on what it may be charged here.
 *
 * ── Why this screen asks the database through the backend ─────────────────────────────────────
 * Every other OPS screen reads Postgres directly. This one does not, because the row it wants
 * holds an encrypted credential and the summary it needs — the last four characters, the spend so
 * far — is assembled where the decryption key lives. OPS never touches the ciphertext, which is
 * the point.
 */
export default async function SocialSettingsPage() {
  const session = await getCurrentSession()

  const { data } = await callBackend<{ credential: Credential | null }>("/ops/social/credentials", {
    action: "get",
    opsUserId: session?.userId,
  })

  const credential = data?.credential ?? null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionHeader
        title="API key & spend"
        description="Video generation is billed per second to a Gemini API key. A Pro subscription does not include API access, so each person brings their own key and pays for their own renders."
      />

      <div className="max-w-2xl space-y-4 px-6 py-4">
        <KeyForm credential={credential} />

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            What a reel costs
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-amber-900">
            Google bills video as output tokens — 5,792 tokens per second of 720p at $17.50 per
            million, which works out to about <strong>10&cent; per second</strong>. A finished
            25-second reel is therefore around <strong>$2.50</strong>, and realistically{" "}
            <strong>$7&ndash;10</strong> once you count the takes that did not work. There is no free
            tier for video.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-900">
            The ceiling above is counted from renders made <em>through this tool</em> and nothing
            else. It cannot see what the same key has been spent on elsewhere, so it is a guard
            against a runaway chain here, not a statement about your Google bill.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Where the key goes
          </h2>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600">
            <li>
              Encrypted with AES-256-GCM before it is stored, using a key derived on the backend. The
              ciphertext never leaves it.
            </li>
            <li>
              <strong>It cannot be read back</strong> — not by this screen, not by anyone. Only
              replaced. If you lose it, make a new one in Google AI Studio.
            </li>
            <li>Sent to Google on your renders and nowhere else. No other brand or person uses it.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
