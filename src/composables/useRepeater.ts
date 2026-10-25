import { computed, toRaw } from "vue"

export type RepeaterItemKey<T> = keyof T | ((item: T) => string | number)

/** Keys live beside the model: unsaved rows need identity without adding fields to a DTO. */
export function useRepeater<T extends object>(options: {
  value: () => T[]
  set: (items: T[]) => void
  createItem: () => T
  itemKey: () => RepeaterItemKey<T> | undefined
  disabled: () => boolean
}) {
  const keys = new WeakMap<object, string>()
  let sequence = 0

  function keyFor(item: T): string {
    const key = options.itemKey()
    const explicit = typeof key === "function" ? key(item) : key === undefined ? undefined : item[key]
    if (explicit !== undefined && explicit !== null) return `item:${typeof explicit}:${String(explicit)}`
    const raw = toRaw(item)
    if (!keys.has(raw)) keys.set(raw, `local:${sequence++}`)
    return keys.get(raw)!
  }

  const rows = computed(() => options.value().map((item) => ({ item, key: keyFor(item) })))

  function add() {
    if (!options.disabled()) options.set([...options.value(), options.createItem()])
  }

  function remove(index: number) {
    if (options.disabled() || index < 0 || index >= options.value().length) return
    options.set(options.value().filter((_, i) => i !== index))
  }

  function update(index: number, item: T) {
    const previous = options.value()[index]
    if (options.disabled() || previous === undefined) return
    keys.set(toRaw(item), keyFor(previous))
    options.set(options.value().map((value, i) => i === index ? item : value))
  }

  return { rows, add, remove, update }
}
