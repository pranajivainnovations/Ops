import { notFound } from "next/navigation"
import { getDbPool } from "@/lib/db"
import BakerForm from "../baker-form"
import { updateBakerAction } from "../actions"
import BakerImageUploader from "./baker-image-uploader"
import InvitePanel, { type ActivationState } from "./invite-panel"

export const dynamic = "force-dynamic"

interface BakerImageRow {
  id: string
  purpose: string
  url: string
  uploaded_at: string
}

export default async function EditBakerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDbPool()
  const [bakerResult, imagesResult, activationResult] = await Promise.all([
    db.query(`SELECT * FROM baker_network.bakers WHERE id = $1`, [id]),
    db.query(
      `SELECT id, purpose, url, uploaded_at FROM baker_network.baker_images
       WHERE baker_id = $1 ORDER BY uploaded_at DESC`,
      [id]
    ),
    // Whether this bakery can log in yet. "Claimed" is deliberately derived from the existence of
    // an active baker_users row rather than stored as a flag — a flag would be a second source of
    // truth that can disagree with the account it describes.
    db.query(
      `SELECT
         EXISTS (
           SELECT 1 FROM baker_network.baker_users
            WHERE baker_id = $1 AND is_active
         ) AS claimed,
         (
           SELECT expires_at FROM baker_network.baker_activations
            WHERE baker_id = $1 AND used_at IS NULL AND revoked_at IS NULL
            ORDER BY created_at DESC LIMIT 1
         ) AS live_invite_expires_at`,
      [id]
    ),
  ])
  const baker = bakerResult.rows[0]
  if (!baker) notFound()

  const { claimed, live_invite_expires_at: liveInviteExpiresAt } = activationResult.rows[0]
  const inviteExpiry: Date | null = liveInviteExpiresAt ? new Date(liveInviteExpiresAt) : null

  const activationState: ActivationState = claimed
    ? "activated"
    : !inviteExpiry
      ? "not_invited"
      : inviteExpiry.getTime() > Date.now()
        ? "invited"
        : "expired"

  const profileImage: BakerImageRow | undefined = imagesResult.rows.find((r) => r.purpose === "profile")
  const bannerImage: BakerImageRow | undefined = imagesResult.rows.find((r) => r.purpose === "banner")
  const galleryImages: BakerImageRow[] = imagesResult.rows.filter((r) => r.purpose === "generic")

  const boundUpdate = updateBakerAction.bind(null, id)

  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Edit {baker.name}</h1>
      </header>

      {/* Banner — shown across the top, same as it'll appear when a customer opens this vendor's page */}
      <div className="relative h-40 w-full overflow-hidden bg-slate-200">
        {bannerImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerImage.url} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute bottom-2 right-2">
          <BakerImageUploader bakerId={id} purpose="banner" label={bannerImage ? "Replace banner" : "Upload banner"} />
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="max-w-3xl">
          {/* Profile image — small, fixed size, shown as-is, not meant to be enlarged */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white">
              {profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileImage.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl text-slate-300">🏪</div>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Profile image</p>
              <BakerImageUploader
                bakerId={id}
                purpose="profile"
                label={profileImage ? "Replace profile image" : "Upload profile image"}
              />
            </div>
          </div>

          {/* Gallery */}
          <div className="mb-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Gallery ({galleryImages.length})
              </p>
              <BakerImageUploader bakerId={id} purpose="generic" label="+ Add photo" />
            </div>
            {galleryImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {galleryImages.map((img) => (
                  <a
                    key={img.id}
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-full w-full object-cover transition hover:opacity-80" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <InvitePanel
            bakerId={id}
            state={activationState}
            expiresAt={inviteExpiry ? inviteExpiry.toISOString() : null}
          />

          <BakerForm action={boundUpdate} submitLabel="Save changes" defaultValues={baker} />
        </div>
      </div>
    </main>
  )
}
