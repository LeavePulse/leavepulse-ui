/*
 * Postal-address types, tile maths and the pluggable geocoder behind
 * LpAddressInput / LpMapPicker.
 *
 * Nothing here is bound to a particular service: the component takes a
 * `GeocodeProvider` and a `TileSource`, and the Nominatim/OSM pair below is
 * only the default. Swap either for a self-hosted instance, a paid provider or
 * a stub in tests without touching the components.
 */

export interface LatLon {
  lat: number
  lon: number
}

export interface AddressValue {
  /** Street and house number, e.g. "Baker Street 221B". */
  line: string
  /** Apartment, suite, floor — only shown when LpAddressInput asks for it. */
  line2?: string
  city: string
  postalCode: string
  /** ISO 3166-1 alpha-2, uppercase — same shape LpPhoneInput uses. */
  country: string
  /** Set once a point is picked on the map or a suggestion carries one. */
  lat?: number
  lon?: number
}

export function emptyAddress(): AddressValue {
  return { line: "", city: "", postalCode: "", country: "" }
}

export interface AddressSuggestion {
  /** Text to put in the field that asked for it. */
  value: string
  label: string
  /** Fuller context — the whole formatted address, shown under the label. */
  description?: string
  /** Parsed parts, as much as the provider resolved. */
  address: Partial<AddressValue>
  lat?: number
  lon?: number
}

/** Which field is being completed — providers can bias results accordingly. */
export type AddressField = "line" | "city" | "postalCode"

export interface GeocodeQuery {
  /** Restrict to a country (ISO2) when the form already has one. */
  country?: string
  /** Preferred result language, as an Accept-Language value. */
  language?: string
  limit?: number
  signal?: AbortSignal
}

export interface GeocodeProvider {
  search(term: string, field: AddressField, query?: GeocodeQuery): Promise<AddressSuggestion[]>
  /** Point → address. Undefined when the point resolves to nothing. */
  reverse(lat: number, lon: number, query?: GeocodeQuery): Promise<AddressSuggestion | undefined>
}

export interface NominatimOptions {
  /** Base URL of a Nominatim instance, no trailing slash. */
  endpoint?: string
  language?: string
  /**
   * Public Nominatim asks for an identifying UA and rate-limits hard; browsers
   * won't let us set User-Agent, so this rides along as `email` instead, which
   * their usage policy accepts. Point `endpoint` at your own instance for
   * anything busier than a settings form.
   */
  email?: string
}

interface NominatimAddress {
  road?: string
  house_number?: string
  city?: string
  town?: string
  village?: string
  municipality?: string
  postcode?: string
  country_code?: string
}

interface NominatimResult {
  display_name: string
  name?: string
  lat?: string
  lon?: string
  address?: NominatimAddress
}

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org"

export function createNominatimProvider(options: NominatimOptions = {}): GeocodeProvider {
  const endpoint = options.endpoint ?? NOMINATIM_ENDPOINT

  function common(query: GeocodeQuery | undefined, params: URLSearchParams) {
    params.set("format", "jsonv2")
    params.set("addressdetails", "1")
    if (options.email) params.set("email", options.email)
    if (query?.country) params.set("countrycodes", query.country.toLowerCase())
  }

  async function get<T>(path: string, params: URLSearchParams, query?: GeocodeQuery): Promise<T> {
    const language = query?.language ?? options.language
    const res = await fetch(`${endpoint}${path}?${params}`, {
      signal: query?.signal,
      headers: language ? { "Accept-Language": language } : undefined,
    })
    if (!res.ok) throw new Error(`geocoder responded ${res.status}`)
    return (await res.json()) as T
  }

  return {
    async search(term, field, query) {
      const params = new URLSearchParams({ q: term, limit: String(query?.limit ?? 6) })
      common(query, params)
      const results = await get<NominatimResult[]>("/search", params, query)
      return results.map((result) => toSuggestion(result, field))
    },

    async reverse(lat, lon, query) {
      const params = new URLSearchParams({ lat: String(lat), lon: String(lon) })
      common(query, params)
      // countrycodes is a /search filter; on /reverse it does nothing but is
      // rejected by stricter instances, so drop it here.
      params.delete("countrycodes")
      const result = await get<NominatimResult | { error: unknown }>("/reverse", params, query)
      if (!result || "error" in result) return undefined
      return toSuggestion(result, "line")
    },
  }
}

function toSuggestion(result: NominatimResult, field: AddressField): AddressSuggestion {
  const parts = result.address ?? {}
  const city = parts.city || parts.town || parts.village || parts.municipality || ""
  const street = [parts.road, parts.house_number].filter(Boolean).join(" ")
  const address: Partial<AddressValue> = {
    line: street || undefined,
    city: city || undefined,
    postalCode: parts.postcode || undefined,
    country: parts.country_code ? parts.country_code.toUpperCase() : undefined,
  }
  const lat = result.lat ? Number(result.lat) : undefined
  const lon = result.lon ? Number(result.lon) : undefined

  // The value is whatever the asking field wants; the full display name always
  // rides along as context so two similar streets stay tellable apart.
  const value =
    field === "city"
      ? city || result.name || result.display_name
      : field === "postalCode"
        ? parts.postcode || ""
        : street || result.name || result.display_name

  return { value, label: value || result.display_name, description: result.display_name, address, lat, lon }
}

/**
 * Every user-facing string in LpAddressInput, so an app can translate it
 * without the kit taking an i18n dependency. Pass a partial — anything absent
 * keeps the English default.
 */
export interface AddressLabels {
  line: string
  linePlaceholder: string
  secondLine: string
  secondLinePlaceholder: string
  city: string
  cityPlaceholder: string
  postalCode: string
  postalCodePlaceholder: string
  country: string
  countryPlaceholder: string
  countrySearch: string
  pickOnMap: string
  mapTitle: string
  mapHint: string
  use: string
  cancel: string
  searching: string
  noSuggestions: string
  nothingHere: string
}

/** Formats an address the way a shipping label would read. */
export function formatAddress(value: AddressValue, countryName?: string): string {
  const locality = [value.postalCode, value.city].filter(Boolean).join(" ")
  return [value.line, locality, countryName ?? value.country].filter(Boolean).join(", ")
}

export interface TileSource {
  /** Template with {z}/{x}/{y}, plus optional {s} for a subdomain. */
  url: string
  /** Rendered under the map — most tile terms require crediting the source. */
  attribution?: string
  subdomains?: string[]
  minZoom?: number
  maxZoom?: number
  /** Edge length of one tile in CSS pixels. Default 256. */
  tileSize?: number
}

export const OSM_TILES: TileSource = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
  minZoom: 1,
  maxZoom: 19,
}

export function tileUrl(source: TileSource, z: number, x: number, y: number): string {
  const subdomains = source.subdomains
  const subdomain = subdomains?.length ? subdomains[Math.abs(x + y) % subdomains.length] : ""
  return source.url
    .replace("{s}", subdomain)
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y))
}

/*
 * Web Mercator, the projection every {z}/{x}/{y} tile scheme uses. `project`
 * gives world pixels at a zoom level (world edge = tileSize * 2^zoom), which is
 * the space the map does all its panning arithmetic in.
 */
export const MAX_LATITUDE = 85.05112878

export function project(lat: number, lon: number, zoom: number, tileSize = 256) {
  const size = tileSize * 2 ** zoom
  const clamped = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat))
  const sin = Math.sin((clamped * Math.PI) / 180)
  return {
    x: ((lon + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  }
}

export function unproject(x: number, y: number, zoom: number, tileSize = 256) {
  const size = tileSize * 2 ** zoom
  const n = Math.PI - (2 * Math.PI * y) / size
  return {
    lat: (180 / Math.PI) * Math.atan(Math.sinh(n)),
    lon: (x / size) * 360 - 180,
  }
}
