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

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.types",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.currentOpeningHours",
  "places.priceLevel",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.reviews",
  "places.delivery",
  "places.takeout",
].join(",")

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

export async function searchPlacesText(params: {
  textQuery: string
  pageToken?: string
  /** Hard geographic filter (excludes results outside the box) — not the same as locationBias,
   *  which only nudges ranking. Must be identical across paginated requests, same as textQuery.
   *  Build with boundingBoxRestriction() rather than constructing rectangle bounds by hand. */
  locationRestriction?: LocationRestriction
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
