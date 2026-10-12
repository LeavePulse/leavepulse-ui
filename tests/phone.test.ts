import { expect, test } from "bun:test"
import * as phoneLib from "libphonenumber-js/min"
import { caretAfterDigits, digitsBefore, E164_MAX_DIGITS, formatPhone } from "../src/components/phone"

test("caret maps by digits across formatting", () => {
  expect(digitsBefore("+380501234567", 6)).toBe(5)
  expect(caretAfterDigits("+380 50 123 4567", 5)).toBe(7)
  expect(caretAfterDigits("+380 50 123 4567", 0)).toBe(1)
  expect(caretAfterDigits("+380 50", 99)).toBe(7)
})

test("formats per country as typed", () => {
  expect(formatPhone("+380501234567", phoneLib).display).toBe("+380 50 123 4567")
  expect(formatPhone("+15551234567", phoneLib).display).toBe("+1 555 123 4567")
  expect(formatPhone("+33123456789", phoneLib).display).toBe("+33 1 23 45 67 89")
  expect(formatPhone("+38 (050) 123-45-67", phoneLib).e164).toBe("+380501234567")
})

test("drops digits past the country's longest number", () => {
  // A Ukrainian mobile is complete at nine national digits; what follows goes.
  const r = formatPhone("+380501234567123", phoneLib)
  expect(r.e164).toBe("+380501234567")
  expect(r.dropped).toBe(3)
})

test("caps at E.164 without the library", () => {
  const r = formatPhone("+1234567890123456789", undefined)
  expect(r.e164.length - 1).toBe(E164_MAX_DIGITS)
  expect(r.dropped).toBe(4)
})

test("reports validity and the problem", () => {
  const ok = formatPhone("+380501234567", phoneLib)
  expect(ok.valid).toBe(true)
  const short = formatPhone("+38050123", phoneLib)
  expect(short.valid).toBe(false)
  expect(short.problem).toBe("too-short")
})

test("a length no format covers is still grouped", () => {
  expect(formatPhone("+3802012345671", phoneLib).display).toBe("+380 201 234 567 1")
})

test("a complete valid number does not take a digit that would break it", async () => {
  const r = formatPhone("+38050123456789", phoneLib)
  expect(r.display).toBe("+380 50 123 4567")
  expect(r.valid).toBe(true)
  expect(r.dropped).toBeGreaterThan(0)
})
