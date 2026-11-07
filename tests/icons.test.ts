import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { getIcon } from "@iconify/vue"
import lucide from "@iconify-json/lucide/icons.json"
import { failedIcons, loadOnce, registerIcons, requestIcon } from "../src/icons"
import { namesInText, subset } from "../src/iconSubset.mjs"

const g = globalThis as Record<string, unknown>
const collection = lucide as unknown as { icons: Record<string, unknown>; aliases: Record<string, { parent: string }> }
const alias = Object.keys(collection.aliases)[0]

afterEach(() => {
  delete g.window
  failedIcons.clear()
})

const settled = () => new Promise((resolve) => setTimeout(resolve, 20))

describe("loadOnce", () => {
  test("shares one load while it succeeds", async () => {
    let calls = 0
    const load = loadOnce(async () => ++calls)
    expect(await load()).toBe(1)
    expect(await load()).toBe(1)
  })

  test("forgets a failure so the next call tries again", async () => {
    let calls = 0
    const load = loadOnce(async () => {
      if (++calls === 1) throw new Error("chunk lost")
      return calls
    })
    expect(load()).rejects.toThrow("chunk lost")
    await settled()
    expect(await load()).toBe(2)
  })
})

describe("registerIcons", () => {
  test("an alias renders its parent's body", async () => {
    await registerIcons([alias])
    const parent = collection.aliases[alias].parent
    expect(getIcon(`lucide:${alias}`)?.body).toBe((collection.icons[parent] as { body: string }).body)
  })

  test("names with and without the prefix both register", async () => {
    await registerIcons(["lucide:cat", "dog"])
    expect(getIcon("lucide:cat")).toBeTruthy()
    expect(getIcon("lucide:dog")).toBeTruthy()
  })
})

describe("requestIcon", () => {
  test("does nothing on the server", async () => {
    requestIcon("lucide:not-an-icon")
    await settled()
    expect(failedIcons.size).toBe(0)
  })

  test("an unknown name is marked failed without a rejection", async () => {
    g.window = {}
    requestIcon("lucide:not-an-icon")
    await settled()
    expect(failedIcons.has("lucide:not-an-icon")).toBe(true)
  })

  test("a known name is loaded and not marked", async () => {
    g.window = {}
    const warn = spyOn(console, "warn")
    requestIcon("lucide:bird")
    await settled()
    expect(getIcon("lucide:bird")).toBeTruthy()
    expect(failedIcons.size).toBe(0)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe("icon subset", () => {
  test("an alias keeps itself and its parent", () => {
    const parent = collection.aliases[alias].parent
    const data = subset(lucide, new Set([alias]))
    expect(data.aliases?.[alias]).toEqual(collection.aliases[alias])
    expect(data.icons[parent]).toBeTruthy()
  })

  test("only literal names are found, not templates", () => {
    expect(namesInText('icon: "lucide:settings" `lucide:${name}`')).toEqual(["settings"])
  })
})
