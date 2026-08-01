"use server"

import { revalidatePath } from "next/cache"
import { getDbPool } from "@/lib/db"

/**
 * Two separate single-purpose statements rather than one parameterized by a
 * boolean — a value used both as a direct assignment AND inside a CASE
 * comparison in the same query can trip Postgres's parameter type
 * inference ("inconsistent types deduced", 42P08), as happened building the
 * baker update action. Simplest fix here: don't reuse a bound parameter
 * across contexts at all.
 */

export async function onboardPincode(pincode: string) {
  const db = getDbPool()
  await db.query(
    `UPDATE baker_network.pincode_service_status
     SET service_enabled = true,
         service_enabled_at = CASE WHEN service_enabled = false THEN NOW() ELSE service_enabled_at END,
         updated_at = NOW()
     WHERE pincode = $1`,
    [pincode]
  )
  revalidatePath("/pincodes")
  revalidatePath("/pincodes/onboarded")
}

export async function offboardPincode(pincode: string) {
  const db = getDbPool()
  await db.query(
    `UPDATE baker_network.pincode_service_status
     SET service_enabled = false, updated_at = NOW()
     WHERE pincode = $1`,
    [pincode]
  )
  revalidatePath("/pincodes")
  revalidatePath("/pincodes/onboarded")
}
