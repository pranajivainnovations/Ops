"use server"

import { revalidatePath } from "next/cache"
import { getDbPool } from "@/lib/db"
import {
  searchPlacesText,
  boundingBoxRestriction,
  resolvePlaceFromInput,
  GooglePlacesError,
  type ParsedPlace,
  type LocationRestriction,
  type RankPreference,
} from "@/lib/google-places"

const SEARCH_RADIUS_METERS = 5000

/**
 * Nearest-first, because that is what a pincode sweep is for: the goal is coverage of one small area,
 * not the region's most famous bakeries. Under RELEVANCE (Google's default) a 5km box spends most of
 * its 60 slots on prominent shops several km away that belong to other pincodes and are found by
 * those pincodes' own sweeps anyway. See the RankPreference doc comment for the measured numbers.
 */
const DEFAULT_RANK_PREFERENCE: RankPreference = "DISTANCE"

export interface DiscoveryRunResult {
  found: number
  /** Places this run had never seen before — the number that says whether the run was worth its cost. */
  added: number
  /** Already known and still untriaged, so refreshed in place. */
  refreshed: number
  /** Already known but already onboarded or dismissed, so deliberately left untouched. */
  skipped: number
  pagesSearched: number
  rankPreference: RankPreference
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

type UpsertOutcome = "added" | "refreshed" | "skipped"

/**
 * `xmax = 0` is the standard Postgres way to tell an INSERT from an ON CONFLICT UPDATE in the same
 * statement: a freshly inserted tuple has no deleting transaction, an updated one carries the id of
 * the transaction that superseded the old version. Needed because running a second sweep in the other
 * rank mode is only worth its API cost if it actually surfaces places the first one missed, and
 * "found 60" cannot answer that on its own.
 *
 * RETURNING yields no row at all when the DO UPDATE's WHERE excludes it — that is the already-triaged
 * case (onboarded or dismissed), which we intentionally never overwrite.
 */
async function upsertDiscovery(
  /** Null for a manual add whose place carries no postal code — better than an empty string, which
   *  would silently fail the `postal_code IS NULL AND search_pincode = $1` fallback on the detail page. */
  pincode: string | null,
  searchQuery: string,
  p: ParsedPlace
): Promise<UpsertOutcome> {
  const db = getDbPool()
  const result = await db.query<{ inserted: boolean }>(
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
     WHERE baker_network.baker_discoveries.review_status IN ('pending', 'on_hold')
     RETURNING (xmax = 0) AS inserted`,
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
  const row = result.rows[0]
  if (!row) return "skipped"
  return row.inserted ? "added" : "refreshed"
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
/*
 * `rankPreference` is exposed rather than fixed because the two modes return substantially different
 * sets — only half their results overlap — so running the same pincode under both is a legitimate way
 * to widen coverage without any new API surface. Doing so cannot create duplicate rows: place_id is
 * the conflict key, so a place both sweeps return updates one row instead of inserting a second.
 */
export async function runBakeryDiscovery(
  pincode: string,
  rankPreference: RankPreference = DEFAULT_RANK_PREFERENCE
): Promise<DiscoveryRunResult> {
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
  const tally: Record<UpsertOutcome, number> = { added: 0, refreshed: 0, skipped: 0 }

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (pageToken) await sleep(PAGE_TOKEN_DELAY_MS)

    let places: ParsedPlace[]
    let nextPageToken: string | null
    try {
      const result = await searchPlacesText({
        textQuery: searchQuery,
        pageToken,
        locationRestriction,
        rankPreference,
      })
      places = result.places
      nextPageToken = result.nextPageToken
    } catch (err) {
      const message = err instanceof GooglePlacesError ? err.message : "Places search failed."
      // Partial results already saved from earlier pages are still useful — surface the error but
      // don't discard what we already have.
      return {
        found: totalFound,
        ...tally,
        pagesSearched,
        rankPreference,
        moreMayExist,
        error: `${message} (after ${pagesSearched} page(s))`,
      }
    }

    pagesSearched++
    for (const p of places) {
      tally[await upsertDiscovery(pincode, searchQuery, p)]++
    }
    totalFound += places.length

    if (!nextPageToken) break
    pageToken = nextPageToken
    if (page === MAX_PAGES) moreMayExist = true
  }

  revalidatePath(`/pincodes/${pincode}`)
  return { found: totalFound, ...tally, pagesSearched, rankPreference, moreMayExist }
}

export interface AddByUrlResult {
  outcome?: UpsertOutcome
  name?: string
  address?: string
  /** The place's own postal code — which decides the pincode page it appears on, not the one we were on. */
  pincode?: string | null
  rating?: number | null
  reviews?: number | null
  /** True when Google does not categorise this business as a bakery — added anyway, but worth saying. */
  notABakery?: boolean
  error?: string
}

/**
 * Adds a single business from a pasted Google Maps link, bypassing search entirely.
 *
 * The reason this exists: Text Search caps at 60 results per query no matter how many businesses
 * qualify, so in a dense pincode a real bakery can be permanently invisible to sweeps. Cuppa Cafe in
 * 201016 is the worked example — Google tags it `bakery`, it sits 2.1km from the pincode centre, and
 * it still never appears under either ranking mode because it ranks below 60. No amount of re-running
 * a sweep finds it; only asking for it by name does.
 *
 * Deliberately no bakery type check that blocks the insert. Google's categories are unreliable at the
 * edges — plenty of home bakers are filed as `store` or nothing at all — and someone who went to the
 * trouble of pasting a specific link has better judgement about it than the type array does. The
 * result flags it instead, and normal triage handles the rest.
 */
export async function addDiscoveryByUrl(input: string): Promise<AddByUrlResult> {
  let place: ParsedPlace
  try {
    place = await resolvePlaceFromInput(input)
  } catch (err) {
    return {
      error: err instanceof GooglePlacesError ? err.message : "Could not look up that link.",
    }
  }

  // search_pincode records the place's own postal code rather than whichever page this was pasted on,
  // so a manual add is attributed the same way a sweep result is, and "last searched" stays meaningful.
  const outcome = await upsertDiscovery(place.postalCode, `Added by link: ${input.trim()}`, place)

  const types = ((place.raw as { types?: string[] } | null)?.types ?? []) as string[]
  const notABakery = !types.some((t) => ["bakery", "cafe", "dessert_shop", "confectionery", "store", "food"].includes(t))

  if (place.postalCode) revalidatePath(`/pincodes/${place.postalCode}`)
  revalidatePath("/bakers/discoveries")

  return {
    outcome,
    name: place.displayName ?? "Unnamed",
    address: place.formattedAddress ?? undefined,
    pincode: place.postalCode,
    rating: place.rating,
    reviews: place.userRatingCount,
    notABakery,
  }
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
