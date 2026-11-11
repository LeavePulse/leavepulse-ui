import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { uk } from "../src/locales/uk"

const SRC = join(import.meta.dir, "..", "src")

/** Every scope named by a `useLabels("scope", ...)` call, with or without a type argument. */
function scopesInSource(): Set<string> {
  const scopes = new Set<string>()
  const call = /useLabels\s*(?:<[^(]*?>)?\(\s*"([^"]+)"/g
  for (const entry of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.(ts|vue)$/.test(entry.name)) continue
    const text = readFileSync(join(entry.parentPath, entry.name), "utf8")
    for (const match of text.matchAll(call)) scopes.add(match[1]!)
  }
  return scopes
}

describe("uk label pack", () => {
  const scopes = scopesInSource()

  test("the source scan finds the label scopes", () => {
    expect(scopes.size).toBeGreaterThan(50)
  })

  test("every label scope has a Ukrainian entry", () => {
    const missing = [...scopes].filter((scope) => !(scope in uk)).sort()
    expect(missing).toEqual([])
  })

  test("no entry is left for a scope that no component reads", () => {
    const stale = Object.keys(uk).filter((scope) => !scopes.has(scope)).sort()
    expect(stale).toEqual([])
  })

  test("every label is a string", () => {
    for (const [scope, labels] of Object.entries(uk)) {
      for (const [key, text] of Object.entries(labels)) {
        expect(typeof text, `${scope}.${key}`).toBe("string")
      }
    }
  })
})
