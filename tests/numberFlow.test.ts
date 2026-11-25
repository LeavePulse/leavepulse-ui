import { expect, test } from "bun:test"
import { flightFraction } from "../src/composables/easing"

test("a frame stamped before the flight began counts as its start", () => {
  expect(flightFraction(995, 1000, 700)).toBe(0)
})

test("the flight runs from 0 to 1 and stays there", () => {
  expect(flightFraction(1000, 1000, 700)).toBe(0)
  expect(flightFraction(1350, 1000, 700)).toBe(0.5)
  expect(flightFraction(2000, 1000, 700)).toBe(1)
})

test("a flight with no duration has landed", () => {
  expect(flightFraction(1000, 1000, 0)).toBe(1)
})
