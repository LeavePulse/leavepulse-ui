import { isRef, toRaw } from "vue"

/*
 * `structuredClone` throws on a Vue proxy, and `toRaw` unwraps only the outer
 * one: a raw object that still holds a reactive value or a ref somewhere below
 * breaks the clone just the same. `cloneRaw` strips every proxy and ref on the
 * way down through plain objects, arrays, Maps and Sets (a ref becomes its
 * value), keeping shared references and cycles, then clones what is left.
 * A Date, a File or a class instance goes to `structuredClone` as it is.
 *
 * What `structuredClone` cannot copy (a function, a DOM node) still throws
 * DataCloneError: a loud failure, not a copy that quietly differs.
 *
 * tests/clone.test.ts keeps a bare `structuredClone` out of src/.
 */
export function cloneRaw<T>(value: T): T {
  return structuredClone(unwrap(value, new Map())) as T
}

function unwrap(input: unknown, seen: Map<object, unknown>): unknown {
  const value = toRaw(isRef(input) ? input.value : input)
  if (typeof value !== "object" || value === null) return value
  if (seen.has(value)) return seen.get(value)

  if (Array.isArray(value)) {
    const out: unknown[] = []
    seen.set(value, out)
    for (const item of value) out.push(unwrap(item, seen))
    return out
  }
  if (value instanceof Map) {
    const out = new Map<unknown, unknown>()
    seen.set(value, out)
    for (const [key, item] of value) out.set(unwrap(key, seen), unwrap(item, seen))
    return out
  }
  if (value instanceof Set) {
    const out = new Set<unknown>()
    seen.set(value, out)
    for (const item of value) out.add(unwrap(item, seen))
    return out
  }
  const proto: unknown = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return value
  const out: Record<string, unknown> = {}
  seen.set(value, out)
  for (const [key, item] of Object.entries(value)) out[key] = unwrap(item, seen)
  return out
}
