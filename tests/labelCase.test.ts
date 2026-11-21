import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { labelCaseVars } from "../src/components/labelCase"

describe("labelCaseVars", () => {
  test("upper sets capitals with spacing, none the text as written at normal spacing", () => {
    expect(labelCaseVars("lp-table-header", "upper")).toEqual({
      "--lp-table-header-transform": "uppercase",
      "--lp-table-header-tracking": "0.08em",
    })
    expect(labelCaseVars("lp-table-header", "none")).toEqual({
      "--lp-table-header-transform": "none",
      "--lp-table-header-tracking": "normal",
    })
  })

  test("unset leaves the theme's tokens in charge", () => {
    expect(labelCaseVars("lp-table-header", undefined)).toBeUndefined()
  })

  test("the theme defaults match the upper case", () => {
    const tokens = readFileSync(new URL("../src/tokens/tokens.css", import.meta.url), "utf8")
    for (const name of ["lp-table-header", "lp-toc-heading"]) {
      for (const [prop, value] of Object.entries(labelCaseVars(name, "upper")!)) {
        expect(tokens).toContain(`${prop}: ${value};`)
      }
    }
  })
})
