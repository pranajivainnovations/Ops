"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { getDbPool } from "@/lib/db"
import { getCurrentSession } from "@/lib/auth"

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  const s = typeof v === "string" ? v.trim() : ""
  return s.length ? s : null
}

function numOrNull(formData: FormData, key: string): number | null {
  const v = str(formData, key)
  if (v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on"
}

function pincodeArray(formData: FormData, key: string): string[] {
  const raw = str(formData, key)
  if (!raw) return []
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => /^\d{6}$/.test(p))
}

function tagArray(formData: FormData, key: string): string[] {
  const raw = str(formData, key)
  if (!raw) return []
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

function fieldsFromForm(formData: FormData) {
  return {
    name: str(formData, "name"),
    contact_person: str(formData, "contact_person"),
    phone: str(formData, "phone"),
    whatsapp_number: str(formData, "whatsapp_number"),
    email: str(formData, "email"),
    address: str(formData, "address"),
    city: str(formData, "city"),
    state: str(formData, "state"),
    pincode: str(formData, "pincode"),
    service_radius_km: numOrNull(formData, "service_radius_km"),
    serviceable_pincodes: pincodeArray(formData, "serviceable_pincodes"),
    // Nullable on purpose. The edit form no longer renders a status field — stage changes go
    // through the Pipeline panel so they get recorded — and a `?? "prospect"` default here would
    // silently demote every baker to the start of the pipeline on an unrelated save.
    status: str(formData, "status"),
    source: str(formData, "source"),
    assigned_to: str(formData, "assigned_to"),
    notes: str(formData, "notes"),
    wholesale_pricing_notes: str(formData, "wholesale_pricing_notes"),
    avg_turnaround_hours: numOrNull(formData, "avg_turnaround_hours"),
    specialty_tags: tagArray(formData, "specialty_tags"),
    reliability_rating: numOrNull(formData, "reliability_rating"),
    is_public: bool(formData, "is_public"),
    bio: str(formData, "bio"),
    blue_tick: bool(formData, "blue_tick"),
    trust_badge: bool(formData, "trust_badge"),
    is_active: bool(formData, "is_active"),
  }
}

export async function createBakerAction(formData: FormData) {
  const f = fieldsFromForm(formData)
  if (!f.name) throw new Error("Name is required")

  const db = getDbPool()
  const created = await db.query(
    `INSERT INTO baker_network.bakers
      (name, contact_person, phone, whatsapp_number, email,
       address, city, state, pincode, service_radius_km, serviceable_pincodes,
       status, source, assigned_to, notes,
       wholesale_pricing_notes, avg_turnaround_hours, specialty_tags, reliability_rating,
       is_public, bio,
       blue_tick, blue_tick_granted_at, trust_badge, trust_badge_granted_at, is_active)
     VALUES ($1,$2,$3,$4,$5, $6,$7,$8,$9,$10,$11, $12,$13,$14,$15, $16,$17,$18,$19, $20,$21,
             $22, CASE WHEN $22 THEN NOW() ELSE NULL END,
             $23, CASE WHEN $23 THEN NOW() ELSE NULL END,
             $24)
     RETURNING id, status`,
    [
      f.name,
      f.contact_person,
      f.phone,
      f.whatsapp_number,
      f.email,
      f.address,
      f.city,
      f.state,
      f.pincode,
      f.service_radius_km,
      f.serviceable_pincodes,
      f.status ?? "prospect",
      f.source,
      f.assigned_to,
      f.notes,
      f.wholesale_pricing_notes,
      f.avg_turnaround_hours,
      f.specialty_tags,
      f.reliability_rating,
      f.is_public,
      f.bio,
      f.blue_tick,
      f.trust_badge,
      f.is_active,
    ]
  )

  // Open the stage history at the moment the baker enters the pipeline, so no baker ever reads as
  // "never moved" and time-in-stage can be measured from the beginning rather than from the first
  // transition — which would make every prospect look brand new until it moved.
  const row = created.rows[0]
  if (row) {
    const session = await getCurrentSession()
    await db.query(
      `INSERT INTO baker_network.baker_stage_history (baker_id, from_stage, to_stage, reason, changed_by)
       VALUES ($1, NULL, $2, 'Added to the pipeline', $3)`,
      [row.id, row.status, session?.userId ?? null]
    )
  }

  revalidatePath("/bakers")
  redirect("/bakers")
}

export async function updateBakerAction(id: string, formData: FormData) {
  const f = fieldsFromForm(formData)
  if (!f.name) throw new Error("Name is required")

  const db = getDbPool()
  await db.query(
    // Every value that's both assigned AND compared in a CASE (status, blue_tick, trust_badge)
    // is passed as two separate placeholders — Postgres can fail to unify a single reused
    // parameter's type across an assignment and a comparison context ("inconsistent types
    // deduced" / 42P08), even when both sites are logically the same column type.
    `UPDATE baker_network.bakers SET
       name=$1, contact_person=$2, phone=$3, whatsapp_number=$4, email=$5,
       address=$6, city=$7, state=$8, pincode=$9, service_radius_km=$10, serviceable_pincodes=$11,
       -- COALESCE, not a plain assignment: this form no longer submits a status field at all, and
       -- a null must mean "leave the stage where it is" rather than wipe it.
       --
       -- Both placeholders are cast explicitly. An uncast parameter tested only with IS NOT NULL
       -- gives Postgres nothing to infer from, so the whole statement fails with 42P08 the moment
       -- that parameter is actually null — which, now that the form omits the field, is every save.
       status = COALESCE($12::varchar, status),
       status_updated_at = CASE WHEN $13::varchar IS NOT NULL AND status IS DISTINCT FROM $13::varchar THEN NOW() ELSE status_updated_at END,
       source=$14, assigned_to=$15, notes=$16,
       wholesale_pricing_notes=$17, avg_turnaround_hours=$18, specialty_tags=$19, reliability_rating=$20,
       is_public=$21, bio=$22,
       blue_tick=$23, blue_tick_granted_at = CASE WHEN $24 AND NOT blue_tick THEN NOW() ELSE blue_tick_granted_at END,
       trust_badge=$25, trust_badge_granted_at = CASE WHEN $26 AND NOT trust_badge THEN NOW() ELSE trust_badge_granted_at END,
       is_active=$27,
       updated_at = NOW()
     WHERE id = $28`,
    [
      f.name,
      f.contact_person,
      f.phone,
      f.whatsapp_number,
      f.email,
      f.address,
      f.city,
      f.state,
      f.pincode,
      f.service_radius_km,
      f.serviceable_pincodes,
      f.status,
      f.status,
      f.source,
      f.assigned_to,
      f.notes,
      f.wholesale_pricing_notes,
      f.avg_turnaround_hours,
      f.specialty_tags,
      f.reliability_rating,
      f.is_public,
      f.bio,
      f.blue_tick,
      f.blue_tick,
      f.trust_badge,
      f.trust_badge,
      f.is_active,
      id,
    ]
  )

  revalidatePath("/bakers")
  redirect("/bakers")
}
