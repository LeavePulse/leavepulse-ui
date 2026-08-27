import {
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue"

/*
 * "The form I had filled in is still here."
 *
 * Long forms get abandoned mid-way by things that have nothing to do with the
 * person filling them in: a session that ages out, a reload, a tab closed by
 * accident, a laptop that sleeps. What was typed is held in component state,
 * so all of those end the same way — an empty form and a person who has to
 * remember what they had already read off the thing in their hand.
 *
 * The panel's own inventory forms are the case that prompted this: an operator
 * standing at a shelf, copying figures off a label, is exactly the person who
 * cannot retype them from memory.
 *
 * Consumers were writing this by hand, field by field: one object literal to
 * save thirty values and thirty typed branches to read them back, which has to
 * be kept in step with the form forever and silently stops covering whatever
 * field was added last. This owns the mechanism instead — what to keep is the
 * caller's business, keeping it is not.
 *
 * What this deliberately does NOT do: decide that a draft is worth restoring.
 * It reports one and hands back the value; showing it, and asking, is the
 * caller's, because only the caller knows whether the record moved underneath
 * it in the meantime.
 */

/** Bumped when the envelope changes shape. A draft written by an older kit is
 *  dropped rather than half-read: a partially-applied draft is worse than none,
 *  because it looks like something a person typed. */
const ENVELOPE_VERSION = 1

interface DraftEnvelope<T> {
  version: number
  savedAt: string
  value: T
}

export interface UseFormDraftOptions<T> {
  /**
   * Where this draft lives. Include whatever identifies the subject — a draft
   * for device A must not surface while editing device B.
   */
  key: MaybeRefOrGetter<string>
  /** The form's current value. Watched deeply; every change rewrites the draft. */
  value: MaybeRefOrGetter<T>
  /**
   * Whether there is anything worth keeping. Return false while the form still
   * matches what was loaded, so an untouched form leaves nothing behind and no
   * later visit is offered its own starting state back as a "draft".
   */
  dirty?: MaybeRefOrGetter<boolean>
  /**
   * How long a draft stays offerable, in milliseconds. Older ones are dropped
   * on read: a fortnight-old draft of a record that has been edited twice since
   * is not a rescue, it is a way to overwrite current facts with stale ones.
   * Defaults to a week. `0` keeps them indefinitely.
   */
  maxAgeMs?: number
  /** Skip the write without tearing the composable out of the component. */
  disabled?: MaybeRefOrGetter<boolean>
}

export interface UseFormDraft<T> {
  /** A draft was found for this key, and has not been restored or discarded. */
  hasDraft: Ref<boolean>
  /** When that draft was written, ISO-8601, or `null` when there is none. */
  savedAt: Ref<string | null>
  /**
   * The stored value, or `null`. Reading does not apply it — the caller decides
   * what to do with each field, because only it knows the form's shape.
   */
  read: () => T | null
  /** Forget the draft. Call after applying it, and after a successful save. */
  discard: () => void
  /** Write now, ignoring `dirty`. For "save and come back to this later". */
  save: () => void
}

function storage(): Storage | null {
  // Private windows, storage disabled by policy, SSR. A form that cannot keep
  // a draft still has to work, so every access is allowed to fail.
  try {
    if (typeof window === "undefined") return null
    return window.localStorage
  } catch {
    return null
  }
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Keeps an unsaved form in browser storage, so losing the page does not lose
 * what was typed into it.
 *
 * ```ts
 * const draft = useFormDraft({
 *   key: () => `lp.draft.device-power:${deviceId.value}`,
 *   value: () => interfaces.value,
 *   dirty: () => hasUnsavedChanges.value,
 * })
 * ```
 * ```vue
 * <LpAlert v-if="draft.hasDraft.value" variant="info">
 *   {{ t("draft.found", { when: draft.savedAt.value }) }}
 *   <LpButton @click="applyDraft">Restore</LpButton>
 *   <LpButton variant="ghost" @click="draft.discard()">Discard</LpButton>
 * </LpAlert>
 * ```
 *
 * `hasDraft` answers for the key as it is now, so a form that switches subject
 * re-reads rather than carrying the previous subject's answer.
 *
 * Call `discard()` once the record is saved. A draft that outlives the save it
 * describes is offered back on the next visit as though it were newer than the
 * record, which is how a form helpfully undoes somebody's work.
 */
export function useFormDraft<T>(options: UseFormDraftOptions<T>): UseFormDraft<T> {
  const hasDraft = ref(false)
  const savedAt = ref<string | null>(null)
  const maxAge = options.maxAgeMs ?? WEEK_MS

  function currentKey(): string {
    return String(toValue(options.key) || "").trim()
  }

  function read(): T | null {
    const store = storage()
    const key = currentKey()
    if (!store || !key) return null
    let raw: string | null = null
    try {
      raw = store.getItem(key)
    } catch {
      return null
    }
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as DraftEnvelope<T>
      if (!parsed || parsed.version !== ENVELOPE_VERSION) {
        discard()
        return null
      }
      if (maxAge > 0) {
        const age = Date.now() - Date.parse(parsed.savedAt)
        // NaN when the stamp is unreadable, and NaN > maxAge is false — an
        // unreadable stamp is treated as "no idea how old", which errs towards
        // offering the draft rather than throwing away somebody's typing.
        if (age > maxAge) {
          discard()
          return null
        }
      }
      return parsed.value
    } catch {
      // Corrupt or hand-edited. Nothing to rescue, and leaving it means asking
      // about it on every visit forever.
      discard()
      return null
    }
  }

  function write(value: T) {
    const store = storage()
    const key = currentKey()
    if (!store || !key) return
    const stamp = new Date().toISOString()
    try {
      store.setItem(
        key,
        JSON.stringify({
          version: ENVELOPE_VERSION,
          savedAt: stamp,
          value,
        } satisfies DraftEnvelope<T>),
      )
    } catch {
      // Quota, or storage turned off between the read and now. The form is
      // unharmed; it simply has no safety net.
      return
    }
    hasDraft.value = true
    savedAt.value = stamp
  }

  function discard() {
    const store = storage()
    const key = currentKey()
    hasDraft.value = false
    savedAt.value = null
    if (!store || !key) return
    try {
      store.removeItem(key)
    } catch {
      // Nothing to do about it, and nothing depends on it.
    }
  }

  function save() {
    write(toValue(options.value))
  }

  // Look for an existing draft, and look again when the subject changes.
  watch(
    () => currentKey(),
    () => {
      hasDraft.value = false
      savedAt.value = null
      const store = storage()
      const key = currentKey()
      if (!store || !key) return
      let raw: string | null = null
      try {
        raw = store.getItem(key)
      } catch {
        return
      }
      if (!raw) return
      try {
        const parsed = JSON.parse(raw) as DraftEnvelope<T>
        if (parsed?.version !== ENVELOPE_VERSION) return
        hasDraft.value = true
        savedAt.value = parsed.savedAt
      } catch {
        // Left for `read` to clear: reporting it here would mean writing to
        // storage from what is meant to be a look.
      }
    },
    { immediate: true },
  )

  watch(
    () => [toValue(options.value), toValue(options.dirty), toValue(options.disabled)],
    ([value, dirty, disabled]) => {
      if (disabled) return
      // `dirty` unset means "every change is worth keeping"; the option exists
      // so a form that knows it is untouched leaves no trace.
      if (options.dirty !== undefined && !dirty) return
      write(value as T)
    },
    { deep: true },
  )

  onScopeDispose(() => {
    // The draft outlives the component on purpose — that is the whole point —
    // so there is nothing to clean up but the local flags.
    hasDraft.value = false
  })

  return { hasDraft, savedAt, read, discard, save }
}
