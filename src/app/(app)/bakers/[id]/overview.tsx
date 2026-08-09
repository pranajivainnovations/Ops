import Link from "next/link"

import { getDbPool } from "@/lib/db"
import type { ActivationState } from "./invite-panel"

/**
 * Everything known about a bakery, with nothing to submit.
 *
 * The point of a read-only tab is that it can be opened mid-phone-call without any risk of
 * changing something by accident, and read top-to-bottom without hunting through form fields for
 * the one value you need. So: no inputs, no buttons that write, and empty values shown as an
 * explicit dash rather than silently collapsed — "we do not know their GST number" and "there is
 * no GST field" should not look the same.
 */

interface ImageRow {
  id: string
  purpose: string
  url: string
}

const ACTIVATION_LABELS: Record<ActivationState, string> = {
  not_invited: "Never invited",
  invited: "Invited — waiting for them to set a password",
  expired: "Invite expired",
  activated: "Active — they can sign in",
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-emerald-600 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-slate-400 text-white",
}

const fmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
})

function when(value: string | Date | null): string {
  return value ? fmt.format(new Date(value)) : "—"
}

function daysSince(value: string | Date | null): number | null {
  if (!value) return null
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const empty =
    children === null || children === undefined || children === "" || children === false
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:w-44 sm:pt-0.5">
        {label}
      </dt>
      <dd className={`text-sm ${empty ? "text-slate-300" : "text-slate-800"}`}>
        {empty ? "—" : children}
      </dd>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-sm font-bold text-slate-900">{title}</h2>
      <dl className="divide-y divide-slate-100">{children}</dl>
    </section>
  )
}

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}

export default async function BakerOverview({
  baker,
  images,
  activationState,
}: {
  baker: Record<string, any>
  images: ImageRow[]
  activationState: ActivationState
}) {
  const db = getDbPool()
  // One round trip for the whole summary — the database is in another cloud, so five small
  // queries here would cost five times the latency for the same information.
  const counts = await db.query(
    `SELECT
       (SELECT count(*)::int FROM baker_network.baker_contacts WHERE baker_id = $1 AND is_active) AS contacts,
       (SELECT count(*)::int FROM baker_network.baker_interactions WHERE baker_id = $1) AS interactions,
       (SELECT count(*)::int FROM baker_network.baker_appointments
          WHERE baker_id = $1 AND status = 'scheduled') AS upcoming,
       (SELECT count(*)::int FROM baker_network.baker_products WHERE baker_id = $1) AS products,
       (SELECT c.name FROM baker_network.baker_contacts c
          WHERE c.baker_id = $1 AND c.is_primary AND c.is_active LIMIT 1) AS primary_contact,
       (SELECT max(i.occurred_at) FROM baker_network.baker_interactions i WHERE i.baker_id = $1)
         AS last_logged`,
    [baker.id]
  )
  const c = counts.rows[0]
  const stale = daysSince(baker.last_contacted_at)

  const profile = images.find((i) => i.purpose === "profile")
  const banner = images.find((i) => i.purpose === "banner")
  const gallery = images.filter((i) => i.purpose === "generic")

  return (
    <div className="flex flex-col gap-4">
      {/* At a glance — the things someone needs before they pick up the phone */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {baker.status}
          </span>
          {baker.confidence && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${CONFIDENCE_STYLES[baker.confidence]}`}
            >
              {baker.confidence} confidence
            </span>
          )}
          {baker.is_active ? <Pill tone="green">Active</Pill> : <Pill tone="rose">Inactive</Pill>}
          {baker.is_public ? <Pill tone="green">Public</Pill> : <Pill>Not public</Pill>}
          {baker.blue_tick && <Pill tone="green">Blue tick</Pill>}
          {baker.trust_badge && <Pill tone="green">Trust badge</Pill>}
          {stale !== null && (
            <Pill tone={stale >= 14 ? "amber" : "slate"}>
              Last contact {stale === 0 ? "today" : `${stale}d ago`}
            </Pill>
          )}
          {stale === null && <Pill>Never contacted</Pill>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Conversations", value: c.interactions },
            { label: "People", value: c.contacts },
            { label: "Upcoming", value: c.upcoming },
            { label: "Products", value: c.products },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{s.value}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Everything on this tab is read-only.{" "}
          <Link href={`/bakers/${baker.id}?tab=pipeline`} className="font-semibold underline">
            Log a call or move the stage
          </Link>{" "}
          ·{" "}
          <Link href={`/bakers/${baker.id}?tab=edit`} className="font-semibold underline">
            Change these details
          </Link>
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Identity">
          <Row label="Name">{baker.name}</Row>
          <Row label="Public ID">{baker.public_id}</Row>
          <Row label="Slug">{baker.slug}</Row>
          <Row label="Primary contact">{c.primary_contact}</Row>
          <Row label="Contact person">{baker.contact_person}</Row>
          <Row label="Phone">{baker.phone}</Row>
          <Row label="WhatsApp">{baker.whatsapp_number}</Row>
          <Row label="Email">{baker.email}</Row>
          <Row label="Website">
            {baker.website_url && (
              <a
                href={baker.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {baker.website_url}
              </a>
            )}
          </Row>
        </Card>

        <Card title="Location & service area">
          <Row label="Address">{baker.address}</Row>
          <Row label="City">{baker.city}</Row>
          <Row label="State">{baker.state}</Row>
          <Row label="Pincode">{baker.pincode}</Row>
          <Row label="Coordinates">
            {baker.lat != null && baker.lng != null ? `${baker.lat}, ${baker.lng}` : null}
          </Row>
          <Row label="Service radius">
            {baker.service_radius_km != null ? `${baker.service_radius_km} km` : null}
          </Row>
          <Row label="Serviceable pincodes">
            {baker.serviceable_pincodes?.length ? (
              <span className="flex flex-wrap gap-1">
                {baker.serviceable_pincodes.map((p: string) => (
                  <Pill key={p}>{p}</Pill>
                ))}
              </span>
            ) : null}
          </Row>
        </Card>

        <Card title="Pipeline">
          <Row label="Stage">{baker.status}</Row>
          <Row label="Stage changed">{when(baker.status_updated_at)}</Row>
          <Row label="Confidence">{baker.confidence}</Row>
          <Row label="Last contact">{when(baker.last_contacted_at)}</Row>
          <Row label="Last logged entry">{when(c.last_logged)}</Row>
          <Row label="Source">{baker.source}</Row>
          <Row label="Assigned to">{baker.assigned_to}</Row>
          <Row label="Added">{when(baker.created_at)}</Row>
        </Card>

        <Card title="Storefront & account">
          <Row label="Login">{ACTIVATION_LABELS[activationState]}</Row>
          <Row label="Visible publicly">{baker.is_public ? "Yes" : "No"}</Row>
          <Row label="Account active">{baker.is_active ? "Yes" : "No"}</Row>
          <Row label="Featured priority">{baker.featured_priority}</Row>
          <Row label="Blue tick">
            {baker.blue_tick ? `Yes — ${when(baker.blue_tick_granted_at)}` : "No"}
          </Row>
          <Row label="Trust badge">
            {baker.trust_badge ? `Yes — ${when(baker.trust_badge_granted_at)}` : "No"}
          </Row>
          <Row label="Bio">{baker.bio}</Row>
        </Card>

        <Card title="Operations">
          <Row label="Turnaround">
            {baker.avg_turnaround_hours != null ? `${baker.avg_turnaround_hours} hours` : null}
          </Row>
          <Row label="Reliability">{baker.reliability_rating}</Row>
          <Row label="Specialities">
            {baker.specialty_tags?.length ? (
              <span className="flex flex-wrap gap-1">
                {baker.specialty_tags.map((t: string) => (
                  <Pill key={t}>{t}</Pill>
                ))}
              </span>
            ) : null}
          </Row>
          <Row label="Google rating">
            {baker.google_rating != null
              ? `${baker.google_rating} (${baker.google_review_count ?? 0} reviews)`
              : null}
          </Row>
          <Row label="Google place ID">{baker.google_place_id}</Row>
        </Card>

        <Card title="Notes">
          <Row label="General">
            {baker.notes ? <span className="whitespace-pre-wrap">{baker.notes}</span> : null}
          </Row>
          <Row label="Wholesale pricing">
            {baker.wholesale_pricing_notes ? (
              <span className="whitespace-pre-wrap">{baker.wholesale_pricing_notes}</span>
            ) : null}
          </Row>
        </Card>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-slate-900">
          Images ({images.length})
        </h2>
        {images.length === 0 ? (
          <p className="text-sm text-slate-500">
            None uploaded. A bakery with no photos cannot be shown well on the storefront.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {banner && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Banner
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banner.url}
                  alt=""
                  className="h-32 w-full rounded-lg object-cover"
                />
              </div>
            )}
            <div className="flex flex-wrap items-start gap-3">
              {profile && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Profile
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profile.url}
                    alt=""
                    className="h-20 w-20 rounded-full border border-slate-200 object-cover"
                  />
                </div>
              )}
              {gallery.length > 0 && (
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Gallery ({gallery.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {gallery.map((img) => (
                      <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt=""
                          className="h-16 w-16 rounded-lg border border-slate-200 object-cover transition hover:opacity-80"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
