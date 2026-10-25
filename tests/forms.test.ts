import { expect, test } from "bun:test"
import { anchorPattern, stripDisallowed } from "../src/composables/useInputFilter"
import { formatColor, hsvToRgb, parseColor, rgbToHex, rgbToHsv } from "../src/components/color"
import { filterCountries, type Country } from "../src/components/countries"
import { groupBreaks, joinCells, upperCells } from "../src/components/otp"
import { addTags } from "../src/components/tags"

const countries: Country[] = [
  { iso2: "UA", name: "Ukraine", dial: "380" },
  { iso2: "GB", name: "United Kingdom", dial: "44" },
  { iso2: "US", name: "United States", dial: "1" },
]

test("country search by name does not match every dial code", () => {
  expect(filterCountries(countries, "ukr").map((c) => c.iso2)).toEqual(["UA"])
  expect(filterCountries(countries, "+44").map((c) => c.iso2)).toEqual(["GB"])
  expect(filterCountries(countries, "  ")).toHaveLength(3)
})

test("pattern anchoring keeps an escaped trailing dollar", () => {
  const re = anchorPattern(/\d+\$/)
  expect(re.test("12$")).toBe(true)
  expect(re.test("12")).toBe(false)
  expect(anchorPattern(/^\d+$/).test("12")).toBe(true)
  expect(anchorPattern("[a-z]+").test("abc1")).toBe(false)
})

test("disallowed characters are stripped with the caret kept in place", () => {
  expect(stripDisallowed("1a2b3", /[0-9]/, 3)).toEqual({ text: "123", caret: 2 })
  expect(stripDisallowed("123", /[0-9]/)).toEqual({ text: "123", caret: 3 })
})

test("otp cells keep their positions across a cleared middle cell", () => {
  const cells: (string | undefined)[] = ["1", "2", "3", "4"]
  delete cells[1]
  expect(joinCells(cells)).toBe("134")
  expect(joinCells(["1", "", "3"])).toBe("13")
})

test("otp letters are capitalised in place, holes and digits untouched", () => {
  const cells: (string | number | undefined)[] = ["a", "b", "3", "d"]
  delete cells[1]
  const upper = upperCells(cells)
  expect(upper).toHaveLength(4)
  expect(1 in upper).toBe(false)
  expect(joinCells(upper)).toBe("A3D")
  expect(upperCells([1, 2])).toEqual([1, 2])
})

test("otp groups break between blocks and never after the last cell", () => {
  expect([...groupBreaks(8, 4)]).toEqual([3])
  expect([...groupBreaks(6, 3)]).toEqual([2])
  expect([...groupBreaks(7, 3)]).toEqual([2, 5])
  expect(groupBreaks(6, undefined).size).toBe(0)
  expect(groupBreaks(6, 6).size).toBe(0)
  expect(groupBreaks(6, 0).size).toBe(0)
  // Exact sizes split like LpCodeDisplay's groups; the remainder is one block.
  expect([...groupBreaks(15, [4, 6, 5])]).toEqual([3, 9])
  expect([...groupBreaks(10, [2, 3])]).toEqual([1, 4])
  expect(groupBreaks(6, []).size).toBe(0)
})

test("hsl output round-trips within one step per channel", () => {
  for (let i = 0; i < 5000; i++) {
    const rgb = { r: (i * 37) % 256, g: (i * 91) % 256, b: (i * 53) % 256, a: 1 }
    const back = parseColor(formatColor(rgbToHsv(rgb), "hsl"))
    expect(back).not.toBeNull()
    expect(Math.abs(back!.r - rgb.r)).toBeLessThanOrEqual(1)
    expect(Math.abs(back!.g - rgb.g)).toBeLessThanOrEqual(1)
    expect(Math.abs(back!.b - rgb.b)).toBeLessThanOrEqual(1)
  }
})

test("hex and rgb agree on whether a colour is opaque", () => {
  const nearly = { h: 0, s: 1, v: 1, a: 0.996 }
  expect(formatColor(nearly, "hex")).toBe("#ff0000fe")
  expect(formatColor(nearly, "rgb")).toBe("rgba(255, 0, 0, 0.996)")
  const opaque = { h: 0, s: 1, v: 1, a: 0.999 }
  expect(formatColor(opaque, "hex")).toBe("#ff0000")
  expect(formatColor(opaque, "rgb")).toBe("rgb(255, 0, 0)")
  expect(rgbToHex({ r: 1, g: 2, b: 3, a: 1 })).toBe("#010203")
})

test("hsv conversion survives a non-finite hue", () => {
  expect(hsvToRgb({ h: Number.NaN, s: 1, v: 1, a: 1 })).toEqual({ r: 255, g: 0, b: 0, a: 1 })
})

test("addTags reports an ignored repeat so the UI can point at the original", () => {
  const result = addTags(["vue"], ["Vue", "react"], { duplicates: "ignore", normalize: (t) => t.toLowerCase() })
  expect(result.tags).toEqual(["vue", "react"])
  expect(result.rejected).toEqual([])
  expect(result.ignored).toEqual(["vue"])
})
