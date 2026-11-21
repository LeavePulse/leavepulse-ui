import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { isProxy, isRef, nextTick, reactive, readonly, ref, shallowReactive, toRaw } from "vue"
import { cloneRaw } from "../src/composables/clone"
import { deepEqual, useForm } from "../src/composables/useForm"

function hasProxyOrRef(value: unknown, seen = new Set<unknown>()): boolean {
  if (isProxy(value) || isRef(value)) return true
  if (typeof value !== "object" || value === null || seen.has(value)) return false
  seen.add(value)
  if (value instanceof Map) return [...value].some(([key, item]) => hasProxyOrRef(key, seen) || hasProxyOrRef(item, seen))
  if (value instanceof Set) return [...value].some((item) => hasProxyOrRef(item, seen))
  return Object.values(value).some((item) => hasProxyOrRef(item, seen))
}

const tick = async () => {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

describe("cloneRaw", () => {
  test("clones a reactive object that structuredClone refuses", () => {
    const state = reactive({ debugger: { enabled: true, port: 5005 }, wrapper: ["mangohud"] })
    expect(() => structuredClone(state)).toThrow()
    const copy = cloneRaw(state)
    expect(copy).toEqual({ debugger: { enabled: true, port: 5005 }, wrapper: ["mangohud"] })
    expect(hasProxyOrRef(copy)).toBe(false)
    copy.debugger.port = 6006
    expect(state.debugger.port).toBe(5005)
  })

  test("unwraps reactive values nested inside a raw object", () => {
    const outer = { settings: reactive({ env: { RUST_LOG: "debug" } }), list: [reactive({ id: 1 })], frozen: readonly({ a: 1 }) }
    expect(() => structuredClone(toRaw(outer))).toThrow()
    const copy = cloneRaw(outer)
    expect(copy).toEqual({ settings: { env: { RUST_LOG: "debug" } }, list: [{ id: 1 }], frozen: { a: 1 } })
    expect(hasProxyOrRef(copy)).toBe(false)
  })

  test("replaces refs with their values", () => {
    const copy = cloneRaw({ port: ref(5005), nested: { flags: ref(["-Xmx2G"]) } }) as unknown
    expect(copy).toEqual({ port: 5005, nested: { flags: ["-Xmx2G"] } })
    expect(hasProxyOrRef(copy)).toBe(false)
  })

  test("unwraps through Maps, Sets and a shallowReactive root", () => {
    const state = shallowReactive({
      byId: new Map([["a", reactive({ n: 1 })]]),
      tags: new Set([reactive({ t: "x" })]),
    })
    const copy = cloneRaw(state)
    expect(copy.byId).toBeInstanceOf(Map)
    expect(copy.byId.get("a")).toEqual({ n: 1 })
    expect([...copy.tags]).toEqual([{ t: "x" }])
    expect(hasProxyOrRef(copy)).toBe(false)
  })

  test("keeps shared references and cycles", () => {
    const shared = reactive({ v: 1 })
    const root: { a: unknown; b: unknown; self?: unknown } = { a: shared, b: shared }
    root.self = root
    const copy = cloneRaw(reactive(root)) as typeof root
    expect(copy.a).toBe(copy.b)
    expect(copy.self).toBe(copy)
  })

  test("copies Dates and passes primitives through", () => {
    expect(cloneRaw(5)).toBe(5)
    expect(cloneRaw(null)).toBeNull()
    const date = new Date(0)
    const copy = cloneRaw({ when: reactive({ date }) })
    expect(copy.when.date).toBeInstanceOf(Date)
    expect(copy.when.date).not.toBe(date)
    expect(copy.when.date.getTime()).toBe(0)
  })

  test("throws on what structuredClone cannot copy instead of returning something else", () => {
    expect(() => cloneRaw({ run: () => 1 })).toThrow()
  })
})

describe("deepEqual on Maps, Sets and Dates", () => {
  test("compares members by value", () => {
    expect(deepEqual(new Map([["a", { n: 1 }]]), new Map([["a", { n: 1 }]]))).toBe(true)
    expect(deepEqual(new Map([["a", 1]]), new Map([["a", 2]]))).toBe(false)
    expect(deepEqual(new Map([[{ k: 1 }, 1]]), new Map([[{ k: 1 }, 1]]))).toBe(true)
    expect(deepEqual(new Set([{ t: "x" }]), new Set([{ t: "x" }]))).toBe(true)
    expect(deepEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false)
    expect(deepEqual(new Map(), {})).toBe(false)
    expect(deepEqual(new Date(0), {})).toBe(false)
    expect(deepEqual(new Date(0), new Date(0).toISOString())).toBe(false)
  })
})

describe("useForm with nested reactive values", () => {
  test("reset, dirty and submit keep Dates and Maps", async () => {
    const due = new Date(Date.UTC(2026, 0, 2))
    const form = useForm({
      initial: { name: "Ada", meta: { due, limits: new Map([["cpu", 2]]) } as { due: Date; limits: Map<string, number> } | null },
    })
    expect(form.dirty.value).toBe(false)

    form.values.meta = reactive({ due: new Date(Date.UTC(2027, 5, 6)), limits: new Map([["cpu", 4]]) })
    await tick()
    expect(form.dirty.value).toBe(true)
    expect(form.isDirty("meta")).toBe(true)

    form.values.meta!.limits.set("cpu", 2)
    form.values.meta!.due = new Date(due)
    await tick()
    expect(form.dirty.value).toBe(false)
    form.values.meta!.limits.set("ram", 8)
    await tick()
    expect(form.dirty.value).toBe(true)

    let sent: unknown
    await form.handleSubmit((values) => {
      sent = values
    })()
    const payload = sent as { meta: { due: Date; limits: Map<string, number> } }
    expect(payload.meta.due).toBeInstanceOf(Date)
    expect(payload.meta.due.getTime()).toBe(due.getTime())
    expect(payload.meta.limits).toBeInstanceOf(Map)
    expect([...payload.meta.limits]).toEqual([["cpu", 2], ["ram", 8]])
    expect(hasProxyOrRef(payload)).toBe(false)
    expect(form.dirty.value).toBe(false)

    form.values.meta = reactive({ due: new Date(0), limits: new Map() })
    await tick()
    expect(form.dirty.value).toBe(true)
    form.reset()
    expect(form.dirty.value).toBe(false)
    expect(form.values.meta!.due).toBeInstanceOf(Date)
    expect(form.values.meta!.due.getTime()).toBe(due.getTime())
    expect(form.values.meta!.limits).toBeInstanceOf(Map)
    expect([...form.values.meta!.limits]).toEqual([["cpu", 2]])
  })

  test("an initial holding a ref and a reactive value is cloned, not stringified", () => {
    const when = ref(new Date(5))
    const form = useForm({ initial: { when, tags: reactive(new Set(["a"])) } as unknown as { when: Date; tags: Set<string> } })
    expect(form.values.when).toBeInstanceOf(Date)
    expect(form.values.when.getTime()).toBe(5)
    expect(form.values.tags).toBeInstanceOf(Set)
    expect(form.dirty.value).toBe(false)
  })
})

/* structuredClone throws on a Vue proxy nested anywhere; cloneRaw is the one call. */
const SRC = join(import.meta.dir, "../src")
const CLONE = "composables/clone.ts"

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.(ts|vue)$/.test(entry.name) ? [path] : []
  })
}

describe("clone guard", () => {
  test("no source file calls structuredClone but the clone utility", () => {
    const found = sources(SRC)
      .map((path) => relative(SRC, path).replaceAll("\\", "/"))
      .filter((name) => name !== CLONE && /(^|[^.\w])structuredClone\(/.test(readFileSync(join(SRC, name), "utf8")))
    expect(found).toEqual([])
    expect(readFileSync(join(SRC, CLONE), "utf8")).toContain("structuredClone(")
  })
})
