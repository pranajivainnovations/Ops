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

const MAX_PAGES = 3
const PAGE_TOKEN_DELAY_MS = 3000
const SEARCH_RADIUS_METERS = 5000
/** Market-sizing research doesn't need every last result the way a real vendor pipeline does — default
 *  to 1 page (up to 20 results) unless the caller explicitly asks for more. */
const DEFAULT_MAX_PAGES = 1

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeCategory(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ")
}

export interface ResearchRunResult {
  found: number
  pagesSearched: number
  moreMayExist: boolean
  error?: string
}

/**
 * Pure market research — is there real vendor presence for a category in a pincode? Same search
 * mechanics as bakery discovery (locationRestriction circle, auto-paginate to Google's own 60-result
 * cap, respect the page-token propagation delay), but writes to the standalone `research` schema,
 * never `baker_network`. No review/onboard workflow here — this is exploration, not a pipeline.
 */
export async function runResearchSearch(
  categoryInput: string,
  pincode: string,
  maxPages: number = DEFAULT_MAX_PAGES
): Promise<ResearchRunResult> {
  const db = getDbPool()
  const categoryName = normalizeCategory(categoryInput)
  if (!categoryName) return { found: 0, pagesSearched: 0, moreMayExist: false, error: "Category is required." }
  if (!/^\d{6}$/.test(pincode)) {
    return { found: 0, pagesSearched: 0, moreMayExist: false, error: "Enter a valid 6-digit pincode." }
  }
  const pageLimit = Math.min(Math.max(1, Math.floor(maxPages) || DEFAULT_MAX_PAGES), MAX_PAGES)

  const categoryRow = await db.query(
    `INSERT INTO research.categories (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [categoryName]
  )
  const categoryId = categoryRow.rows[0].id

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
    searchQuery = `${categoryName} in ${pincode}`
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
    searchQuery = area
      ? `${categoryName} in ${area.district}, ${area.state_name}`
      : `${categoryName} near pincode ${pincode}, India`
  }

  let totalFound = 0
  let pagesSearched = 0
  let pageToken: string | undefined
  let moreMayExist = false

  for (let page = 1; page <= pageLimit; page++) {
    if (pageToken) await sleep(PAGE_TOKEN_DELAY_MS)

    let places: ParsedPlace[]
    let nextPageToken: string | null
    try {
      const result = await searchPlacesText({ textQuery: searchQuery, pageToken, locationRestriction })
      places = result.places
      nextPageToken = result.nextPageToken
    } catch (err) {
      const message = err instanceof GooglePlacesError ? err.message : "Places search failed."
      return {
        found: totalFound,
        pagesSearched,
        moreMayExist,
        error: `${message} (after ${pagesSearched} page(s))`,
      }
    }

    pagesSearched++
    for (const p of places) {
      await db.query(
        `INSERT INTO research.search_results
          (category_id, place_id, search_pincode, search_query, display_name, formatted_address,
           district, state_name, postal_code, lat, lng, rating, user_rating_count, phone, website_url,
           business_status, primary_type, raw_response)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (category_id, place_id) DO UPDATE SET
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
           fetched_at = NOW()`,
        [
          categoryId,
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
    totalFound += places.length

    if (!nextPageToken) break
    pageToken = nextPageToken
    if (page === pageLimit) moreMayExist = true
  }

  revalidatePath("/rnd")
  return { found: totalFound, pagesSearched, moreMayExist }
}
