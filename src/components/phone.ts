/*
 * The phone-number engine behind LpPhoneInput, split from the component so its
 * rules are testable. libphonenumber-js (the `min` metadata build) is loaded
 * on first use, the way the country table is: an app that never renders a
 * phone field never downloads it, and until it arrives the field still takes
 * digits, just without formatting or checks.
 */
import type { CountryCode } from "libphonenumber-js/min"

export type PhoneLib = typeof import("libphonenumber-js/min")
type Examples = typeof import("libphonenumber-js/examples.mobile.json")["default"]

let lib: Promise<PhoneLib> | undefined
let examples: Promise<Examples> | undefined

export function loadPhoneLib(): Promise<PhoneLib> {
  lib ??= import("libphonenumber-js/min")
  return lib
}

export function loadPhoneExamples(): Promise<Examples> {
  examples ??= import("libphonenumber-js/examples.mobile.json").then((m) => m.default)
  return examples
}

/** E.164 allows at most 15 digits, country code included. */
export const E164_MAX_DIGITS = 15

export function digitsOf(text: string): string {
  return text.replace(/\D/g, "")
}

/** How many digits sit before `caret` in `text`. */
export function digitsBefore(text: string, caret: number): number {
  return digitsOf(text.slice(0, caret)).length
}

/**
 * The caret position in `formatted` that has `count` digits before it, placed
 * right after the last of them so typing continues from there. Zero digits
 * puts it after a leading "+".
 */
export function caretAfterDigits(formatted: string, count: number): number {
  if (count <= 0) return formatted.startsWith("+") ? 1 : 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      seen++
      if (seen === count) return i + 1
    }
  }
  return formatted.length
}

export type PhoneProblem = "too-short" | "too-long" | "invalid" | "invalid-country"

export interface FormattedPhone {
  /** What the field shows: "+380 50 123 4567". */
  display: string
  /** Normalised "+380501234567", or "" when there are no digits. */
  e164: string
  /** Digits that were typed past the longest number the country allows. */
  dropped: number
  /** The calling code the number starts with ("380"), once recognised. */
  callingCode?: string
  /** Country libphonenumber recognised from the number, when it did. */
  country?: CountryCode
  possible: boolean
  valid: boolean
  type?: string
  problem?: PhoneProblem
}

/**
 * Format what was typed, dropping digits beyond what the number may hold:
 * the country's own maximum once libphonenumber knows the country, the E.164
 * cap otherwise. The value always starts with "+", since the field holds a
 * full international number.
 */
export function formatPhone(input: string, phone: PhoneLib | undefined): FormattedPhone {
  let digits = digitsOf(input)
  let dropped = 0
  if (digits.length > E164_MAX_DIGITS) {
    dropped += digits.length - E164_MAX_DIGITS
    digits = digits.slice(0, E164_MAX_DIGITS)
  }
  if (!digits) return { display: input.trim().startsWith("+") ? "+" : "", e164: "", dropped, possible: false, valid: false }
  if (!phone) return { display: `+${digits}`, e164: `+${digits}`, dropped, possible: false, valid: false }

  while (digits.length > 1 && phone.validatePhoneNumberLength(`+${digits}`) === "TOO_LONG") {
    digits = digits.slice(0, -1)
    dropped++
  }

  // A number that was already complete and valid does not take one more
  // digit that would make it neither: a Ukrainian mobile ends at nine digits
  // after +380 although the country's longest number type allows ten, and
  // that tenth digit is almost always a slip rather than another kind of line.
  const isValid = (d: string) => phone.parsePhoneNumberFromString(`+${d}`)?.isValid() ?? false
  while (digits.length > 1 && !isValid(digits) && isValid(digits.slice(0, -1))) {
    digits = digits.slice(0, -1)
    dropped++
  }

  const typer = new phone.AsYouType()
  let display = typer.input(`+${digits}`)
  // A length the country allows but no format covers (a 10-digit Ukrainian
  // national number) comes back as one run of digits; group it by threes after
  // the calling code so it still reads as a phone number.
  const code = typer.getCallingCode()
  if (code && !/\s/.test(display.slice(code.length + 2))) {
    const national = digits.slice(code.length)
    display = `+${code}${national ? " " + (national.match(/.{1,3}/g) ?? []).join(" ") : ""}`
  }
  const parsed = phone.parsePhoneNumberFromString(`+${digits}`)
  const country = typer.getCountry() ?? parsed?.country
  const possible = parsed?.isPossible() ?? false
  const valid = parsed?.isValid() ?? false
  const length = phone.validatePhoneNumberLength(`+${digits}`)
  const problem: PhoneProblem | undefined = valid
    ? undefined
    : length === "TOO_SHORT" || length === "NOT_A_NUMBER"
      ? "too-short"
      : length === "INVALID_COUNTRY"
        ? "invalid-country"
        : length === "TOO_LONG"
          ? "too-long"
          : "invalid"
  return {
    display,
    e164: `+${digits}`,
    dropped,
    callingCode: code,
    country,
    possible,
    valid,
    type: valid ? parsed?.getType() : undefined,
    problem,
  }
}
