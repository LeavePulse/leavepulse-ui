import { describe, expect, test } from "bun:test"
import { nextTick, ref } from "vue"
import { addTags, splitTags } from "../src/components/tags"
import { deepEqual, useForm } from "../src/composables/useForm"

const tick = async () => {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

describe("splitTags", () => {
  test("splits on every delimiter and trims", () => {
    expect(splitTags(" a, b\nc\t ,", [",", "\n", "\t"])).toEqual(["a", "b", "c"])
    expect(splitTags("a; b;c", /;/)).toEqual(["a", "b", "c"])
  })
})

describe("addTags", () => {
  test("keeps the rejected parts with their reason", () => {
    const { tags, rejected } = addTags(["a@x.io"], ["b@x.io", "a@x.io", "nope"], {
      validate: (t) => (t.includes("@") ? undefined : "Not an email"),
    })
    expect(tags).toEqual(["a@x.io", "b@x.io"])
    expect(rejected).toEqual([
      { value: "a@x.io", reason: "duplicate" },
      { value: "nope", reason: "invalid", message: "Not an email" },
    ])
  })

  test("limit, silent duplicates and normalisation", () => {
    expect(addTags(["a"], ["b", "c"], { max: 2 }).rejected).toEqual([{ value: "c", reason: "max" }])
    expect(addTags(["a"], ["A"], { duplicates: "ignore", normalize: (t) => t.toLowerCase() })).toEqual({
      tags: ["a"],
      rejected: [],
    })
    expect(addTags(["a"], ["a"], { duplicates: "allow" }).tags).toEqual(["a", "a"])
  })
})

describe("deepEqual", () => {
  test("compares structure, not identity", () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
    expect(deepEqual({ a: [1] }, { a: [1, 2] })).toBe(false)
    expect(deepEqual(new Date(5), new Date(5))).toBe(true)
  })
})

describe("useForm", () => {
  const required = (v: string) => (v ? undefined : "Required")

  test("dirty follows the baseline, and an untouched form adopts a reloaded initial", async () => {
    const record = ref({ name: "", tags: [] as string[] })
    const form = useForm({ initial: () => record.value })
    expect(form.dirty.value).toBe(false)
    record.value = { name: "Ada", tags: ["x"] }
    await tick()
    expect(form.values.name).toBe("Ada")
    expect(form.dirty.value).toBe(false)
    form.values.tags.push("y")
    expect(form.dirty.value).toBe(true)
    expect(form.isDirty("name")).toBe(false)
    record.value = { name: "Bob", tags: [] }
    await tick()
    expect(form.values.name).toBe("Ada")
  })

  test("errors stay hidden until touched or submitted", async () => {
    const form = useForm({ initial: { name: "", email: "" }, rules: { name: required, email: required } })
    expect(await form.validate()).toBe(false)
    expect(form.errors.value.name).toBe("Required")
    expect(form.visibleErrors.value).toEqual({})
    form.touch("name")
    await tick()
    expect(form.field("name").error).toBe("Required")
    expect(form.field("email").error).toBeUndefined()
  })

  test("submit validates, blocks a second run, and saves the baseline", async () => {
    const form = useForm({ initial: { name: "" }, rules: { name: required } })
    let calls = 0
    const submit = form.handleSubmit(async () => {
      calls++
      await new Promise((r) => setTimeout(r, 5))
    })
    await submit()
    expect(calls).toBe(0)
    expect(form.visibleErrors.value.name).toBe("Required")
    form.set("name", "Ada")
    await tick()
    expect(form.visibleErrors.value.name).toBeUndefined()
    await Promise.all([submit(), submit()])
    expect(calls).toBe(1)
    expect(form.dirty.value).toBe(false)
  })

  test("async rules keep only the latest answer, and form-level checks land too", async () => {
    let slow = true
    const form = useForm({
      initial: { user: "", a: 1, b: 2 },
      rules: {
        user: async (v) => {
          const wait = slow
          await new Promise((r) => setTimeout(r, wait ? 20 : 1))
          return v === "taken" ? "Taken" : undefined
        },
      },
      validate: (v) => (v.a > v.b ? { b: "Must be at least a" } : undefined),
    })
    form.set("user", "taken")
    const first = form.validate("user")
    slow = false
    form.set("user", "free")
    await form.validate("user")
    await first
    expect(form.errors.value.user).toBeUndefined()
    form.set("a", 3)
    expect(await form.validate()).toBe(false)
    expect(form.errors.value.b).toBe("Must be at least a")
  })

  test("external errors show at once and clear on edit", async () => {
    const form = useForm({ initial: { email: "a@x.io" } })
    form.setErrors({ email: "Already registered" })
    expect(form.field("email").error).toBe("Already registered")
    form.set("email", "b@x.io")
    await tick()
    expect(form.field("email").error).toBeUndefined()
  })
})
