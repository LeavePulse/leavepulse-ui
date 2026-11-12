import { afterAll, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { refsInText } from "../src/iconSubset.mjs"
import { iconsPlugin } from "../src/nuxt"

/*
 * The Nuxt module registers, up front, the icons an app names: lucide from the
 * kit's own set, and any other set from the app's own @iconify-json package,
 * so a "logos:google-icon" on a login page renders in the server pass and never
 * asks the iconify API.
 */
const root = mkdtempSync(join(tmpdir(), "lp-icons-"))
const src = join(root, "src")
mkdirSync(src)
writeFileSync(join(root, "package.json"), '{"name":"app"}')
const set = join(root, "node_modules", "@iconify-json", "fake")
mkdirSync(set, { recursive: true })
writeFileSync(join(set, "package.json"), '{"name":"@iconify-json/fake","exports":{"./icons.json":"./icons.json"}}')
writeFileSync(
  join(set, "icons.json"),
  JSON.stringify({ prefix: "fake", width: 16, height: 16, icons: { sun: { body: "<path d='S'/>" }, moon: { body: "<path d='M'/>" } } }),
)
writeFileSync(join(src, "login.vue"), `<LpIcon name="fake:sun" /> <LpIcon name="lucide:check" /> import "node:fs"`)
afterAll(() => rmSync(root, { recursive: true, force: true }))

/** The collections a plugin registers, by prefix. */
function registered(code: string): Record<string, { icons: Record<string, unknown> }> {
  const out: Record<string, { icons: Record<string, unknown> }> = {}
  for (const m of code.matchAll(/registerIconCollection\((\{.*\})\)/g)) {
    const set = JSON.parse(m[1]!) as { prefix: string; icons: Record<string, unknown> }
    out[set.prefix] = set
  }
  return out
}

describe("icon refs", () => {
  test("any prefix is found, templates are not", () => {
    expect(refsInText('"logos:google-icon" "lucide:check" `lucide:${x}`')).toEqual([
      ["logos", "google-icon"],
      ["lucide", "check"],
    ])
  })
})

describe("the module's icon plugin", () => {
  test("a scan registers the app's other sets from its own packages, only the named icons", () => {
    const sets = registered(iconsPlugin("scan", src, root))
    expect(Object.keys(sets.fake!.icons)).toEqual(["sun"])
    expect(Object.keys(sets.lucide!.icons)).toEqual(["check"])
    // "node:fs" names no installed set, so nothing is registered for it.
    expect(sets.node).toBeUndefined()
  })

  test("a list takes prefixed names from any installed set, bare names from lucide", () => {
    const sets = registered(iconsPlugin(["fake:moon", "check"], src, root))
    expect(Object.keys(sets.fake!.icons)).toEqual(["moon"])
    expect(Object.keys(sets.lucide!.icons)).toEqual(["check"])
  })

  test("all keeps the whole lucide set and still registers the other sets", () => {
    const code = iconsPlugin("all", src, root)
    expect(code).toContain('import "@leavepulse/ui/icons-all"')
    expect(Object.keys(registered(code).fake!.icons)).toEqual(["sun"])
  })

  test("kit registers nothing", () => {
    expect(iconsPlugin("kit", src, root)).toBe("")
  })
})
