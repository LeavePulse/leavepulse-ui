/*
 * Lightweight country helpers for LpPhoneInput. The heavy dial-code TABLE lives
 * in ./countries-data.ts and is loaded lazily via loadCountries() so it lands in
 * its own chunk — apps that never render a phone field don't pay for it. Only the
 * type + tiny pure helpers stay here (importing these does not pull the data).
 */
export interface Country {
  /** ISO 3166-1 alpha-2, uppercase (e.g. "US"). Drives the flag. */
  iso2: string
  name: string
  /** Calling code without "+", e.g. "1", "44", "380". */
  dial: string
}

/** Turn an ISO2 code into its flag emoji (two regional-indicator symbols). */
export function flagEmoji(iso2: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso2)) return ""
  const base = 0x1f1e6 - 0x41 // regional indicator 'A' minus ASCII 'A'
  return String.fromCodePoint(
    ...iso2.toUpperCase().split("").map((c) => base + c.charCodeAt(0)),
  )
}

let cache: Country[] | undefined

/**
 * Load the country table (code-split chunk). Cached after first call, so repeat
 * calls are synchronous-ish (resolved promise) with no re-import cost.
 */
export async function loadCountries(): Promise<Country[]> {
  if (cache) return cache
  const mod = await import("./countries-data")
  cache = mod.COUNTRIES
  return cache
}

// Several countries share a dial code (notably NANP "+1" → US, CA, …). Without
// area-code parsing we can't disambiguate, so we pick a sensible primary per
// shared code. Anything not listed falls back to the first list match.
const PRIMARY_BY_DIAL: Record<string, string> = {
  "1": "US",
  "7": "RU",
  "39": "IT",
}

/**
 * Best-effort: pick the country whose dial code prefixes the given E.164-ish
 * value (longest match wins, so "1868" beats "1"). For shared codes the primary
 * country is preferred. Pass the list (from loadCountries). Undefined if none.
 */
export function matchCountryByValue(
  value: string,
  list: Country[],
): Country | undefined {
  const digits = value.replace(/[^\d]/g, "")
  if (!digits) return undefined
  let best: Country | undefined
  for (const c of list) {
    if (!digits.startsWith(c.dial)) continue
    if (!best || c.dial.length > best.dial.length) {
      best = c
    } else if (c.dial.length === best.dial.length && PRIMARY_BY_DIAL[c.dial] === c.iso2) {
      best = c // same length, but this one is the designated primary
    }
  }
  return best
}
