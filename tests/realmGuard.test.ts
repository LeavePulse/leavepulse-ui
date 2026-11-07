import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

/*
 * A component renders in the window it is in, which inside an LpFrame is not the
 * global one: another document, and another realm's classes. Nothing fails at
 * build time when code forgets that, so it is checked here. Use the helpers in
 * composables/realm.ts and useView.ts. A file belongs below only when what it
 * reads truly is the page's, whichever window the code runs for.
 */
const PAGE_LEVEL: Record<string, string> = {
  "components/LpFrame.vue": "mirrors the page's stylesheets and scroll lock into the frame",
  "composables/useGamepadNav.ts": "one gamepad drives the page",
  "composables/useHintSystem.ts": "tips live on the page",
  "composables/useHints.ts": "tips live on the page",
  "composables/useClipboard.ts": "the legacy copy fallback uses the page's document",
  "theme/backdrop.ts": "the theme belongs to the page",
  "theme/studio.ts": "the theme belongs to the page",
}

const RULES: [RegExp, string][] = [
  [/\binstanceof\s+(HTML\w*|SVG\w*|Element|Node)\b/, "use isElement, isHTMLElement or isNode"],
  [/\bnew\s+(ResizeObserver|MutationObserver|IntersectionObserver|MouseEvent|KeyboardEvent|PointerEvent)\b/, "take the class from nodeWindow(el)"],
  [/(^|[^.\w])getComputedStyle\(/, "use nodeWindow(el).getComputedStyle"],
  [/(^|[^.\w])document\.activeElement\b/, "use el.ownerDocument.activeElement"],
]

/* Comments may name what they warn about. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1").replace(/<!--[\s\S]*?-->/g, "")
}

export function violations(source: string): string[] {
  return withoutComments(source)
    .split("\n")
    .flatMap((line) => RULES.filter(([rule]) => rule.test(line)).map(([, fix]) => `${line.trim()} (${fix})`))
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.(ts|vue)$/.test(entry.name) ? [path] : []
  })
}

const SRC = join(import.meta.dir, "../src")

describe("realm guard", () => {
  test("catches what it exists to catch", () => {
    expect(violations("if (el instanceof HTMLElement) go()")).toHaveLength(1)
    expect(violations("const o = new ResizeObserver(run)")).toHaveLength(1)
    expect(violations("const s = getComputedStyle(el)")).toHaveLength(1)
    expect(violations("return document.activeElement")).toHaveLength(1)
  })

  test("lets the safe forms through", () => {
    expect(violations("nodeWindow(el).getComputedStyle(el)")).toEqual([])
    expect(violations("new (nodeWindow(el).ResizeObserver)(run)")).toEqual([])
    expect(violations("new win.MouseEvent('click')")).toEqual([])
    expect(violations("el.ownerDocument.activeElement")).toEqual([])
    expect(violations("// instanceof Element would be wrong here")).toEqual([])
    expect(violations("value instanceof Date")).toEqual([])
  })

  test("every source file works in the window it renders in", () => {
    const found = sources(SRC).flatMap((path) => {
      const name = relative(SRC, path).replaceAll("\\", "/")
      if (name in PAGE_LEVEL) return []
      return violations(readFileSync(path, "utf8")).map((hit) => `${name}: ${hit}`)
    })
    expect(found).toEqual([])
  })

  test("the page-level list holds only files that still need it", () => {
    const stale = Object.keys(PAGE_LEVEL).filter((name) => !violations(readFileSync(join(SRC, name), "utf8")).length)
    expect(stale).toEqual([])
  })
})
