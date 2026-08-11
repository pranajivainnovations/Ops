/**
 * Thin client for Places API (New) Text Search.
 *
 * Field mask is deliberately explicit — the API returns nothing without one,
 * and billing is per-call at the highest tier requested. We're already
 * paying Enterprise-tier price for phone/rating, so the marginal cost of
 * including reviews/openingHours/priceLevel/delivery/takeout in the same
 * call is zero — they're not promoted to their own DB columns, but they
 * land in raw_response, so nothing requested is ever thrown away.
 */

const PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "types",
  "businessStatus",
  "rating",
  "userRatingCount",
  "currentOpeningHours",
  "priceLevel",
  "internationalPhoneNumber",
  "websiteUri",
  "reviews",
  "delivery",
  "takeout",
]

/** Search responses nest places under a `places` array, so every path is prefixed. */
const FIELD_MASK = PLACE_FIELDS.map((f) => `places.${f}`).join(",")

/** Place Details returns a bare place, so the same fields are requested unprefixed. */
const DETAILS_FIELD_MASK = PLACE_FIELDS.join(",")

export interface ParsedPlace {
  placeId: string
  displayName: string | null
  formattedAddress: string | null
  district: string | null
  stateName: string | null
  postalCode: string | null
  lat: number | null
  lng: number | null
  rating: number | null
  userRatingCount: number | null
  phone: string | null
  websiteUrl: string | null
  businessStatus: string | null
  primaryType: string | null
  raw: unknown
}

interface GoogleAddressComponent {
  longText?: string
  shortText?: string
  types?: string[]
}

interface GooglePlace {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  addressComponents?: GoogleAddressComponent[]
  location?: { latitude?: number; longitude?: number }
  types?: string[]
  businessStatus?: string
  rating?: number
  userRatingCount?: number
  internationalPhoneNumber?: string
  websiteUri?: string
}

function findComponent(components: GoogleAddressComponent[] | undefined, type: string): string | null {
  return components?.find((c) => c.types?.includes(type))?.longText ?? null
}

function parsePlace(place: GooglePlace): ParsedPlace {
  const components = place.addressComponents
  return {
    placeId: place.id,
    displayName: place.displayName?.text ?? null,
    formattedAddress: place.formattedAddress ?? null,
    district:
      findComponent(components, "administrative_area_level_2") ??
      findComponent(components, "locality"),
    stateName: findComponent(components, "administrative_area_level_1"),
    postalCode: findComponent(components, "postal_code"),
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    phone: place.internationalPhoneNumber ?? null,
    websiteUrl: place.websiteUri ?? null,
    businessStatus: place.businessStatus ?? null,
    primaryType: place.types?.[0] ?? null,
    raw: place,
  }
}

export class GooglePlacesError extends Error {}

export interface PlacesSearchResult {
  places: ParsedPlace[]
  /** Present only if Google has more results beyond this page (max 3 pages / 60 results total, ever). */
  nextPageToken: string | null
}

/**
 * Runs a single Text Search call — a fresh query, or the next page of a previous one.
 *
 * Google's pagination is NOT "send the token alone" — its own docs say "all parameters other than
 * pageSize/pageToken must be the same as the previous request," meaning textQuery must be resent
 * unchanged alongside pageToken, or the API rejects it with "Empty text_query" (hit this for real:
 * the first version of this function swapped textQuery out for pageToken instead of adding to it).
 * Pages are a strict chain regardless — no jumping ahead, hard cap of 60 results / 3 pages total.
 */
export interface LocationRestriction {
  rectangle: {
    low: { latitude: number; longitude: number }
    high: { latitude: number; longitude: number }
  }
}

/**
 * Text Search's locationRestriction only accepts a rectangle (northeast/southwest corners), not a
 * circle — circle is only valid for locationBias, or for the separate Nearby Search endpoint. Hit
 * this for real: "Unknown name 'circle' at 'location_restriction'". Approximates a circle by its
 * bounding square (111km per degree latitude; longitude degrees shrink with cos(latitude)) — that
 * makes the box a superset of the true circle at the corners, which is fine here since the returned
 * postal_code is what actually gates correctness, not the box shape itself.
 */
export function boundingBoxRestriction(
  center: { latitude: number; longitude: number },
  radiusMeters: number
): LocationRestriction {
  const radiusKm = radiusMeters / 1000
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos((center.latitude * Math.PI) / 180))
  return {
    rectangle: {
      low: { latitude: center.latitude - latDelta, longitude: center.longitude - lngDelta },
      high: { latitude: center.latitude + latDelta, longitude: center.longitude + lngDelta },
    },
  }
}

/**
 * How Google orders the candidates it considers eligible — which decides who survives the 60-result
 * cut, since far more than 60 bakeries qualify in a dense pincode.
 *
 * Not to be confused with locationRestriction, which is a separate axis: the restriction decides
 * *which* places are eligible at all (a hard geographic cutoff), this decides the *order* among them.
 *
 * - RELEVANCE — Google's default when the field is omitted. Weighted heavily by prominence, so a
 *   famous bakery several km away outranks a small one next door.
 * - DISTANCE — nearest first. Google still applies its own relevance filter before sorting, so this
 *   is not "everything nearby"; low-prominence places stay excluded under either mode.
 *
 * Measured against 201016 with an identical 5km box: RELEVANCE returned 13 results whose real postal
 * code was actually 201016, DISTANCE returned 22. Only 30 of the 60 overlapped — so these are closer
 * to two complementary sweeps than one being strictly better, and running both unions to ~90 unique
 * places for 2x the calls. Also verified that omitting the field returns results identical to
 * RELEVANCE, which is why nothing changes for callers that don't pass it.
 */
export type RankPreference = "RELEVANCE" | "DISTANCE"

export async function searchPlacesText(params: {
  textQuery: string
  pageToken?: string
  /** Hard geographic filter (excludes results outside the box) — not the same as locationBias,
   *  which only nudges ranking. Must be identical across paginated requests, same as textQuery.
   *  Build with boundingBoxRestriction() rather than constructing rectangle bounds by hand. */
  locationRestriction?: LocationRestriction
  /** Omit for Google's default (RELEVANCE). Like textQuery and locationRestriction this must be
   *  resent unchanged on every paginated request — it rides along inside `params` for that reason. */
  rankPreference?: RankPreference
}): Promise<PlacesSearchResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new GooglePlacesError("GOOGLE_PLACES_API_KEY is not set")
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": `${FIELD_MASK},nextPageToken`,
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new GooglePlacesError(`Places API request failed (${res.status}): ${body.slice(0, 500)}`)
  }

  const data: { places?: GooglePlace[]; nextPageToken?: string } = await res.json()
  return {
    places: (data.places ?? []).map(parsePlace),
    nextPageToken: data.nextPageToken ?? null,
  }
}

/** Fetches one known place by its Places API id. One billed call, no ranking, no 60-result cap. */
export async function getPlaceDetails(placeId: string): Promise<ParsedPlace> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new GooglePlacesError("GOOGLE_PLACES_API_KEY is not set")

  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": DETAILS_FIELD_MASK },
  })

  if (!res.ok) {
    // 404 and 400 both mean "this id is no good" — reached routinely, since the id reconstructed from
    // a Maps URL is a guess until proven. Kept short so the fallback's message is what a user reads,
    // rather than a wall of Google's error JSON.
    if (res.status === 404) throw new GooglePlacesError(`Google has no place with id ${placeId}.`)
    if (res.status === 400) throw new GooglePlacesError(`${placeId} is not a valid Google place id.`)
    const body = await res.text().catch(() => "")
    throw new GooglePlacesError(`Place Details failed (${res.status}): ${body.slice(0, 300)}`)
  }
  return parsePlace((await res.json()) as GooglePlace)
}

export interface ParsedMapsUrl {
  /** Derived from the URL's ftid when present — still needs confirming against the API. */
  placeId: string | null
  /** Business name from the /place/<Name>/ segment, used for the search fallback. */
  name: string | null
  /** The @lat,lng viewport centre, used to keep the search fallback tightly local. */
  coords: { latitude: number; longitude: number } | null
}

/**
 * A Google Maps URL does not contain a Places API place id. It carries two other identifiers, and
 * neither is accepted by the API — verified directly: the `!16s/g/11vht8bb8y` entity id returns 404,
 * and the CID from `!1s0x...:0xBBBB` converted to decimal returns 400 "not a valid Place ID".
 *
 * What does work is reconstructing the place id from the `ftid` in `!1s0xAAAA:0xBBBB`. A `ChIJ` place
 * id is base64url of a 20-byte protobuf holding exactly those two 64-bit values:
 *
 *   0a 12 09 <A as 8-byte little-endian> 11 <B as 8-byte little-endian>
 *
 * (field 1, length 18, then two fixed64 fields). Confirmed against a real business: the URL for Cuppa
 * Cafe carries 0x390cef4c10da331f:0x2780049ed3f9dc59, and this produces ChIJHzPaEEzvDDkRWdz5054EgCc,
 * which is byte-identical to the id Google's own Text Search returns for it.
 *
 * This encoding is not documented, so it is treated strictly as a hint: the caller must confirm it by
 * actually fetching the place, and fall back to a name search if the fetch fails. That keeps a future
 * change in Google's id format a graceful degradation rather than an outage.
 */
export function parseMapsUrl(rawUrl: string): ParsedMapsUrl {
  const ftid = /!1s(0x[0-9a-f]+):(0x[0-9a-f]+)/i.exec(rawUrl)
  let placeId: string | null = null
  if (ftid) {
    try {
      const le = (hex: string) => {
        const b = Buffer.alloc(8)
        b.writeBigUInt64LE(BigInt(hex))
        return b
      }
      placeId = Buffer.concat([
        Buffer.from([0x0a, 0x12, 0x09]),
        le(ftid[1]),
        Buffer.from([0x11]),
        le(ftid[2]),
      ])
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
    } catch {
      placeId = null // Malformed or oversized hex — fall through to the name search.
    }
  }

  // Some URLs carry the real place id outright, in a query param or a !19s segment.
  if (!placeId) {
    const direct = /(?:[?&]place_id=|!19s)(ChI[A-Za-z0-9_-]+)/.exec(rawUrl)
    if (direct) placeId = direct[1]
  }

  const nameMatch = /\/place\/([^/@?]+)/.exec(rawUrl)
  const coordMatch = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(rawUrl)

  return {
    placeId,
    name: nameMatch ? decodeURIComponent(nameMatch[1].replace(/\+/g, " ")) : null,
    coords: coordMatch
      ? { latitude: parseFloat(coordMatch[1]), longitude: parseFloat(coordMatch[2]) }
      : null,
  }
}

/**
 * Turns whatever someone pasted into one place.
 *
 * Accepts a full Maps URL, a share link (which is expanded by following its redirect — share links
 * contain no identifiers at all until then), or a bare place id.
 *
 * Two routes to the answer, in order of confidence: the id reconstructed from the URL, which is exact
 * when it works; then a name search boxed to 1km around the URL's own coordinates, which is what
 * rescues businesses like Cuppa Cafe that a pincode sweep cannot reach — it ranks 40th in its own
 * neighbourhood and never survives the 60-result cut, but searched by name it is the only result.
 */
export async function resolvePlaceFromInput(input: string): Promise<ParsedPlace> {
  const trimmed = input.trim()
  if (!trimmed) throw new GooglePlacesError("Paste a Google Maps link or a place id.")

  // A bare place id, pasted directly.
  if (/^ChI[A-Za-z0-9_-]+$/.test(trimmed)) return getPlaceDetails(trimmed)

  if (!/^https?:\/\//i.test(trimmed)) {
    throw new GooglePlacesError("That is not a Google Maps link. Paste the full URL from the browser.")
  }

  let url = trimmed
  if (/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url)) {
    try {
      const res = await fetch(url, { redirect: "follow" })
      url = res.url
    } catch {
      throw new GooglePlacesError("Could not expand that short link. Paste the full maps.google.com URL instead.")
    }
  }

  const parsed = parseMapsUrl(url)

  if (parsed.placeId) {
    try {
      return await getPlaceDetails(parsed.placeId)
    } catch {
      // Reconstruction is undocumented, so a failure here is expected-if-rare, not fatal.
    }
  }

  if (parsed.name) {
    const { places } = await searchPlacesText({
      textQuery: parsed.name,
      locationRestriction: parsed.coords ? boundingBoxRestriction(parsed.coords, 1000) : undefined,
    })
    if (places.length > 0) return places[0]
  }

  throw new GooglePlacesError(
    "Could not identify a business from that link. Open the place in Google Maps and copy the URL from the address bar."
  )
}
