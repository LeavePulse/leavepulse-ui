import { expect, test } from "bun:test"
import { ref } from "vue"
import { useRepeater } from "../src/composables/useRepeater"

function setup() {
  const value = ref([{ id: 1, name: "first" }, { id: 2, name: "middle" }, { id: 3, name: "last" }])
  const disabled = ref(false)
  const keyed = ref(false)
  const repeater = useRepeater({
    value: () => value.value,
    set: (items) => { value.value = items },
    createItem: () => ({ id: 4, name: "new" }),
    itemKey: () => keyed.value ? "id" as const : undefined,
    disabled: () => disabled.value,
  })
  return { value, disabled, keyed, ...repeater }
}

test("removing the middle row preserves the surviving rows' identities and leaves DTOs untouched", () => {
  const list = setup()
  const keys = list.rows.value.map((row) => row.key)
  list.remove(1)
  expect(list.rows.value.map((row) => row.key)).toEqual([keys[0], keys[2]])
  expect(list.value.value).toEqual([{ id: 1, name: "first" }, { id: 3, name: "last" }])
})

test("an immutable row edit preserves local state, a new row gets a new identity", () => {
  const list = setup()
  const key = list.rows.value[1]!.key
  list.update(1, { id: 2, name: "edited" })
  expect(list.rows.value[1]!.key).toBe(key)
  list.add()
  expect(new Set(list.rows.value.map((row) => row.key)).size).toBe(4)
})

test("business keys preserve row identity through immutable reload and reordering", () => {
  const list = setup()
  list.keyed.value = true
  const keys = list.rows.value.map((row) => row.key)
  list.value.value = [{ id: 3, name: "reloaded" }, { id: 1, name: "reloaded" }]
  expect(list.rows.value.map((row) => row.key)).toEqual([keys[2], keys[0]])
})

test("disabled repeaters refuse every mutation, and invalid indices do not add or remove rows", () => {
  const list = setup()
  list.disabled.value = true
  list.add()
  list.remove(0)
  list.update(0, { id: 1, name: "wrong" })
  expect(list.value.value.map((row) => row.name)).toEqual(["first", "middle", "last"])
  list.disabled.value = false
  list.remove(-1)
  list.remove(99)
  list.update(99, { id: 99, name: "wrong" })
  expect(list.value.value).toHaveLength(3)
})
