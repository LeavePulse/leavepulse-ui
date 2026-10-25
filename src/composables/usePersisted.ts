import { getCurrentInstance, inject, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue"
import { LP_CONFIG, type KitStorage, type LpConfig } from "./useLpConfig"

/*
 * Browser storage, made safe to touch. Private windows, storage disabled by
 * policy, a full quota and SSR all throw or have nothing to give; a component
 * that cannot remember still has to work, so every access may fail quietly.
 */
export const browserStorage: KitStorage = {
  get(key) {
    try {
      return typeof window === "undefined" ? null : window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(key, value)
    } catch {
      // Quota or policy: the value simply is not remembered.
    }
  },
  remove(key) {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(key)
    } catch {
      // As above.
    }
  },
}

/**
 * The store the nearest `provideLpConfig` names, else the browser's. Callable
 * outside a component too (a composable run from a store), where only the
 * browser's is reachable.
 */
export function useKitStorage(): KitStorage {
  if (!getCurrentInstance()) return browserStorage
  const config = toValue(inject<MaybeRefOrGetter<LpConfig>>(LP_CONFIG, {}))
  return config.storage ?? browserStorage
}

export interface PersistedOptions<T> {
  /**
   * Accept a stored value or reject it. What was written by an older version,
   * or by hand, must not reach the component: a rejected value reads as
   * nothing stored and the initial value is used.
   */
  validate?: (value: unknown) => value is T
}

/**
 * A ref that outlives the page: read from the kit's storage under `key` and
 * written back on every change. With no key (undefined, null, "") it is a
 * plain ref, which is how a component makes remembering opt-in:
 *
 *   const collapsed = usePersisted(() => props.persist && `lp-sidebar:${props.persist}`, false)
 *
 * A changed key reads the new key's value, so one component instance can
 * follow the thing it shows (a drawer per record).
 */
export function usePersisted<T>(
  key: MaybeRefOrGetter<string | false | null | undefined>,
  initial: T,
  options: PersistedOptions<T> = {},
): Ref<T> {
  const storage = useKitStorage()
  // A copy taken now: an object initial edited in place under one key must
  // not come back edited as the starting value of the next.
  const pristine = initial === undefined ? undefined : JSON.stringify(initial)
  const fresh = (): T => (pristine === undefined ? initial : (JSON.parse(pristine) as T))
  const value = ref(fresh()) as Ref<T>

  function stored(name: string): { ok: true; value: T } | { ok: false } {
    const raw = storage.get(name)
    if (raw == null) return { ok: false }
    try {
      const parsed: unknown = JSON.parse(raw)
      return options.validate && !options.validate(parsed) ? { ok: false } : { ok: true, value: parsed as T }
    } catch {
      return { ok: false }
    }
  }

  // Nothing usable under the new key (never written, broken, rejected) starts
  // from the initial value, not from what the previous key held.
  function read(name: string | false | null | undefined, previous?: string | false | null) {
    if (!name) return
    const found = stored(name)
    if (found.ok) value.value = found.value
    else if (previous) value.value = fresh()
  }

  watch(() => toValue(key), (name, previous) => read(name, previous), { immediate: true })
  watch(
    value,
    (next) => {
      const name = toValue(key)
      // Writing back a value just read is harmless: the same text lands again.
      if (!name) return
      if (next === undefined) storage.remove(name)
      else storage.set(name, JSON.stringify(next))
    },
    { deep: true },
  )
  return value
}
