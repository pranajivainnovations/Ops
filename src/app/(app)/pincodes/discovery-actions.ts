"use server"

import { revalidatePath } from "next/cache"
import { getDbPool } from "@/lib/db"
import {
  searchPlacesText,
  boundingBoxRestriction,
  GooglePlacesError,
  type ParsedPlace,
  type LocationRestriction,
} from "@/lib/google-places"

const SEARCH_RADIUS_METERS = 5000

export interface DiscoveryRunResult {
  found: number
  pagesSearched: number
  /** True only in the edge case where Google still returned a token after the 3rd page — informational
   *  only, not actionable, since Text Search hard-caps at 60 results / 3 pages no matter what. */
  moreMayExist: boolean
  error?: string
}

const MAX_PAGES = 3
/** Google's own guidance: a page token needs a moment to propagate before it's usable. */
const PAGE_TOKEN_DELAY_MS = 3000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function upsertDiscovery(pincode: string, searchQuery: string, p: ParsedPlace) {
  const db = getDbPool()
  await db.query(
    `INSERT INTO baker_network.baker_discoveries
      (place_id, search_pincode, search_query, display_name, formatted_address, district, state_name,
       postal_code, lat, lng, rating, user_rating_count, phone, website_url, business_status,
       primary_type, raw_response)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (place_id) DO UPDATE SET
       rating = EXCLUDED.rating,
       user_rating_count = EXCLUDED.user_rating_count,
       display_name = EXCLUDED.display_name,
       formatted_address = EXCLUDED.formatted_address,
       district = EXCLUDED.district,
       state_name = EXCLUDED.state_name,
       postal_code = EXCLUDED.postal_code,
       lat = EXCLUDED.lat,
       lng = EXCLUDED.lng,
       phone = EXCLUDED.phone,
       website_url = EXCLUDED.website_url,
       business_status = EXCLUDED.business_status,
       primary_type = EXCLUDED.primary_type,
       raw_response = EXCLUDED.raw_response,
       fetched_at = NOW()
     WHERE baker_network.baker_discoveries.review_status IN ('pending', 'on_hold')`,
    [
      p.placeId,
      pincode,
      searchQuery,
      p.displayName,
      p.formattedAddress,
      p.district,
      p.stateName,
      p.postalCode,
      p.lat,
      p.lng,
      p.rating,
      p.userRatingCount,
      p.phone,
      p.websiteUrl,
      p.businessStatus,
      p.primaryType,
      JSON.stringify(p.raw),
    ]
  )
}

/**
 * Runs a discovery search for a pincode, automatically fetching every page Google offers up to its own
 * hard cap (60 results / 3 pages, always, no matter what) — there's no separate "load more" step; a
 * single click already gets everything available. Each subsequent page needs its token to propagate on
 * Google's side first (their own documented ~2-5s requirement), so this can take several seconds.
 *
 * Uses locationRestriction (a hard geographic filter, not just a ranking nudge) centered on this
 * pincode's own coordinates to keep results local, rather than a whole-district text search that
 * used to pull in results from a dozen-plus neighboring pincodes. Nothing returned is ever discarded,
 * though, even results whose actual postal code turns out to be a different pincode — that data is
 * still valuable once ops gets to that other pincode later, so every candidate is stored and simply
 * surfaced on whichever pincode's page its own address actually belongs to (see the [pincode] detail
 * page query, which filters by the candidate's real postal_code, not by which search found it).
 */
export async function runBakeryDiscovery(pincode: string): Promise<DiscoveryRunResult> {
  const db = getDbPool()

  // Prefer a Head Office row's coordinates as the most canonical point for this pincode, else any
  // available coordinates, else fall back to a district-level text search with no geographic circle.
  const coordsResult = await db.query(
    `SELECT latitude, longitude FROM baker_network.pincode_directory
     WHERE pincode = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL
     ORDER BY (office_type = 'HO') DESC
     LIMIT 1`,
    [pincode]
  )
  const coords = coordsResult.rows[0]

  let searchQuery: string
  let locationRestriction: LocationRestriction | undefined

  if (coords) {
    searchQuery = `bakeries, cake shops, and desserts in ${pincode}`
    locationRestriction = boundingBoxRestriction(
      { latitude: coords.latitude, longitude: coords.longitude },
      SEARCH_RADIUS_METERS
    )
  } else {
    const areaResult = await db.query(
      `SELECT DISTINCT district, state_name FROM baker_network.pincode_directory WHERE pincode = $1 AND district IS NOT NULL LIMIT 1`,
      [pincode]
    )
    const area = areaResult.rows[0]
    searchQuery = area ? `bakery in ${area.district}, ${area.state_name}` : `bakery near pincode ${pincode}, India`
  }

  let totalFound = 0
  let pagesSearched = 0
  let pageToken: string | undefined
  let moreMayExist = false

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (pageToken) await sleep(PAGE_TOKEN_DELAY_MS)

    let places: ParsedPlace[]
    let nextPageToken: string | null
    try {
      const result = await searchPlacesText({ textQuery: searchQuery, pageToken, locationRestriction })
      places = result.places
      nextPageToken = result.nextPageToken
    } catch (err) {
      const message = err instanceof GooglePlacesError ? err.message : "Places search failed."
      // Partial results already saved from earlier pages are still useful — surface the error but
      // don't discard what we already have.
      return { found: totalFound, pagesSearched, moreMayExist, error: `${message} (after ${pagesSearched} page(s))` }
    }

    pagesSearched++
    for (const p of places) {
      await upsertDiscovery(pincode, searchQuery, p)
    }
    totalFound += places.length

    if (!nextPageToken) break
    pageToken = nextPageToken
    if (page === MAX_PAGES) moreMayExist = true
  }

  revalidatePath(`/pincodes/${pincode}`)
  return { found: totalFound, pagesSearched, moreMayExist }
}

export async function onboardDiscovery(discoveryId: string) {
  const db = getDbPool()
  const discoveryResult = await db.query(
    `SELECT * FROM baker_network.baker_discoveries WHERE id = $1 AND review_status != 'onboarded'`,
    [discoveryId]
  )
  const d = discoveryResult.rows[0]
  if (!d) return

  // If this Google place was already onboarded some other way, just link to that existing baker
  // instead of erroring on the google_place_id unique constraint.
  const existing = await db.query(`SELECT id FROM baker_network.bakers WHERE google_place_id = $1`, [d.place_id])

  let bakerId: string
  if (existing.rows[0]) {
    bakerId = existing.rows[0].id
  } else {
    const inserted = await db.query(
      `INSERT INTO baker_network.bakers
        (name, address, city, state, pincode, lat, lng, phone, website_url,
         google_place_id, google_rating, google_review_count, source, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Google Places sweep','prospect')
       RETURNING id`,
      [
        d.display_name,
        d.formatted_address,
        d.district,
        d.state_name,
        d.postal_code,
        d.lat,
        d.lng,
        d.phone,
        d.website_url,
        d.place_id,
        d.rating,
        d.user_rating_count,
      ]
    )
    bakerId = inserted.rows[0].id

    // Opens the stage history at the moment this candidate became a real prospect, so the board
    // can measure how long it has been sitting there. Promotions from a sweep are the most common
    // way a baker enters the pipeline, so without this most bakers would have no history at all.
    await db.query(
      `INSERT INTO baker_network.baker_stage_history (baker_id, from_stage, to_stage, reason)
       VALUES ($1, NULL, 'prospect', 'Promoted from a Google Places sweep')`,
      [bakerId]
    )
  }

  await db.query(
    `UPDATE baker_network.baker_discoveries SET review_status = 'onboarded', promoted_baker_id = $2 WHERE id = $1`,
    [discoveryId, bakerId]
  )

  revalidatePath(`/pincodes/${d.search_pincode}`)
  revalidatePath("/bakers")
  revalidatePath("/bakers/discoveries")
}

export async function holdDiscovery(discoveryId: string) {
  const db = getDbPool()
  const result = await db.query(
    `UPDATE baker_network.baker_discoveries SET review_status = 'on_hold'
     WHERE id = $1 AND review_status != 'onboarded' RETURNING search_pincode`,
    [discoveryId]
  )
  const pincode = result.rows[0]?.search_pincode
  if (pincode) revalidatePath(`/pincodes/${pincode}`)
  revalidatePath("/bakers/discoveries")
}

export async function dismissDiscovery(discoveryId: string) {
  const db = getDbPool()
  const result = await db.query(
    `UPDATE baker_network.baker_discoveries SET review_status = 'dismissed'
     WHERE id = $1 AND review_status != 'onboarded' RETURNING search_pincode`,
    [discoveryId]
  )
  const pincode = result.rows[0]?.search_pincode
  if (pincode) revalidatePath(`/pincodes/${pincode}`)
  revalidatePath("/bakers/discoveries")
}
