import {
  computed,
  reactive,
  ref,
  toRaw,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
  type UnwrapRef,
} from "vue"

/*
 * Form state that every form ends up writing by hand: the values, which
 * fields were touched, whether anything differs from what was loaded, the
 * errors, and a submit that cannot run twice.
 *
 * Errors are computed for every field but shown only once a field was touched
 * (blurred, or edited after a blur) or a submit was attempted, so nobody is
 * told off for a field they have not reached yet.
 *
 * `dirty` is the same signal useFormDraft asks for, so the two pair directly:
 *
 * ```ts
 * const form = useForm({ initial: () => record.value, rules: { email: required } })
 * const draft = useFormDraft({ key: () => `draft:${id}`, value: () => form.values, dirty: form.dirty })
 * function restore() { form.setValues(draft.read() ?? {}); draft.discard() }
 * const save = form.handleSubmit(async (values) => { await api.save(values); draft.discard() })
 * ```
 *
 * A reactive `initial` (a record that loads after mount) is adopted while the
 * form is untouched, and becomes the new baseline for `dirty`; once the user
 * has changed something, a reload of the record no longer overwrites it.
 */

export type FormErrorMessage = string | null | undefined | void | false
export type FieldRule<V, T> = (value: V, values: T) => FormErrorMessage | Promise<FormErrorMessage>
export type FormRules<T> = { [K in keyof T]?: FieldRule<T[K], T> | FieldRule<T[K], T>[] }
export type FormErrors<T> = Partial<Record<keyof T | "form", string>>

export interface UseFormOptions<T extends object> {
  initial: MaybeRefOrGetter<T>
  rules?: FormRules<T>
  /** Cross-field checks; return messages by field, or under `form` for the whole form. */
  validate?: (values: T) => FormErrors<T> | void | Promise<FormErrors<T> | void>
}

export interface FieldBinding<V> {
  modelValue: V
  "onUpdate:modelValue": (value: V) => void
  onBlur: () => void
  error: string | undefined
  invalid: boolean
}

export interface UseForm<T extends object> {
  values: UnwrapRef<T>
  /** Errors as currently computed, shown or not. */
  errors: ComputedRef<FormErrors<T>>
  /** Errors the user should see now. */
  visibleErrors: ComputedRef<FormErrors<T>>
  touched: Partial<Record<keyof T, boolean>>
  dirty: ComputedRef<boolean>
  valid: ComputedRef<boolean>
  validating: Ref<boolean>
  submitting: Ref<boolean>
  submitCount: Ref<number>
  isDirty: (name: keyof T) => boolean
  /** Props for a kit control: `<LpInput v-bind="form.field('email')" />`. */
  field: <K extends keyof T>(name: K) => FieldBinding<T[K]>
  set: <K extends keyof T>(name: K, value: T[K]) => void
  setValues: (values: Partial<T>) => void
  touch: (name: keyof T) => void
  /** Run the checks for one field, or all of them; resolves to whether it passed. */
  validate: (name?: keyof T) => Promise<boolean>
  /** Errors from elsewhere, a server reply most often. Cleared field by field on edit. */
  setErrors: (errors: FormErrors<T>) => void
  /** Back to `values` (or the current initial), which also become the new baseline. */
  reset: (values?: T) => void
  /**
   * Wrap the submit handler: touches everything, validates, and calls `fn`
   * only when valid and not already submitting. A successful `fn` makes the
   * submitted values the new baseline.
   */
  handleSubmit: (fn: (values: T) => unknown) => (event?: Event) => Promise<void>
}

function clone<T>(value: T): T {
  try {
    return structuredClone(toRaw(value))
  } catch {
    return JSON.parse(JSON.stringify(value)) as T
  }
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

function message(result: FormErrorMessage): string | undefined {
  return typeof result === "string" && result ? result : undefined
}

export function useForm<T extends object>(options: UseFormOptions<T>): UseForm<T> {
  let baseline = clone(toValue(options.initial))
  const values = reactive(clone(baseline)) as UnwrapRef<T>
  const plain = () => values as unknown as T
  const errors = reactive<FormErrors<T>>({}) as FormErrors<T>
  const external = reactive<FormErrors<T>>({}) as FormErrors<T>
  const touched = reactive<Partial<Record<keyof T, boolean>>>({}) as Partial<Record<keyof T, boolean>>
  const validating = ref(false)
  const submitting = ref(false)
  const submitCount = ref(0)
  const runs = new Map<keyof T | "form", number>()
  // What the form-level check set last, so its next run can take back what no
  // longer holds without touching an error a field rule set on the same key.
  const fromForm = new Map<keyof T | "form", string>()
  const baseVersion = ref(0)

  const keys = (): (keyof T)[] => Object.keys(plain()) as (keyof T)[]

  const dirty = computed(() => {
    void baseVersion.value
    return !deepEqual(plain(), baseline)
  })

  function isDirty(name: keyof T): boolean {
    void baseVersion.value
    return !deepEqual(plain()[name], baseline[name])
  }

  async function checkField(name: keyof T): Promise<string | undefined> {
    const rule = options.rules?.[name]
    const list = (Array.isArray(rule) ? rule : rule ? [rule] : []) as FieldRule<unknown, T>[]
    for (const r of list) {
      const found = message(await r(plain()[name], plain()))
      if (found) return found
    }
    return undefined
  }

  async function runField(name: keyof T): Promise<boolean> {
    const run = (runs.get(name) ?? 0) + 1
    runs.set(name, run)
    const found = await checkField(name)
    if (runs.get(name) !== run) return !errors[name]
    if (found) errors[name] = found
    else delete errors[name]
    return !found && !external[name]
  }

  async function runForm(): Promise<boolean> {
    if (!options.validate) return true
    const run = (runs.get("form") ?? 0) + 1
    runs.set("form", run)
    const found = (await options.validate(plain())) ?? {}
    if (runs.get("form") !== run) return true
    for (const [name, text] of fromForm) if (errors[name] === text) delete errors[name]
    fromForm.clear()
    let ok = true
    for (const [name, text] of Object.entries(found) as [keyof T | "form", string | undefined][]) {
      if (!text) continue
      ok = false
      if (errors[name]) continue
      errors[name] = text
      fromForm.set(name, text)
    }
    return ok
  }

  async function validate(name?: keyof T): Promise<boolean> {
    validating.value = true
    try {
      if (name !== undefined) return await runField(name)
      const fields = await Promise.all(keys().map(runField))
      const form = await runForm()
      return fields.every(Boolean) && form && !Object.values(external).some(Boolean)
    } finally {
      validating.value = false
    }
  }

  function touch(name: keyof T): void {
    touched[name] = true
    void validate(name)
  }

  function set<K extends keyof T>(name: K, value: T[K]): void {
    ;(values as unknown as T)[name] = value
  }

  function setValues(next: Partial<T>): void {
    for (const [k, v] of Object.entries(next) as [keyof T, T[keyof T]][]) set(k, v)
  }

  function clearState(): void {
    for (const k of Object.keys(errors)) delete errors[k as keyof T]
    for (const k of Object.keys(external)) delete external[k as keyof T]
    for (const k of Object.keys(touched)) delete touched[k as keyof T]
    runs.clear()
    fromForm.clear()
    submitCount.value = 0
  }

  function adopt(next: T): void {
    baseline = clone(next)
    const target = values as unknown as Record<string, unknown>
    for (const k of Object.keys(target)) if (!(k in (baseline as object))) delete target[k]
    Object.assign(target, clone(baseline))
    baseVersion.value++
  }

  function reset(next?: T): void {
    adopt(next ?? toValue(options.initial))
    clearState()
  }

  function setErrors(next: FormErrors<T>): void {
    for (const [k, v] of Object.entries(next) as [keyof T | "form", string | undefined][]) {
      if (v) external[k] = v
      else delete external[k]
    }
  }

  watch(
    () => toValue(options.initial),
    (next) => {
      if (!dirty.value && !deepEqual(next, baseline)) adopt(next)
    },
    { deep: true },
  )

  // An edit re-checks a field already touched, drops an external error on it,
  // and runs the form-level check again once it has run: a cross-field error
  // ("passwords differ") must clear when either field is fixed.
  async function recheck(names: (keyof T)[]): Promise<void> {
    await Promise.all(names.map((name) => validate(name)))
    if (fromForm.size || submitCount.value) await runForm()
  }

  let snapshot = clone(plain())
  watch(
    plain,
    () => {
      const now = clone(plain())
      const changed: (keyof T)[] = []
      for (const name of Object.keys(now) as (keyof T)[]) {
        if (deepEqual(now[name], snapshot[name])) continue
        if (external[name]) delete external[name]
        if (touched[name] || submitCount.value) changed.push(name)
      }
      snapshot = now
      if (changed.length) void recheck(changed)
    },
    { deep: true },
  )

  const merged = computed<FormErrors<T>>(() => ({ ...errors, ...external }))
  const visibleErrors = computed<FormErrors<T>>(() => {
    const all = merged.value
    if (submitCount.value) return all
    const shown: FormErrors<T> = {}
    for (const [k, v] of Object.entries(all) as [keyof T, string][]) {
      if (touched[k] || external[k]) shown[k] = v
    }
    return shown
  })
  const valid = computed(() => !Object.values(merged.value).some(Boolean))

  function field<K extends keyof T>(name: K): FieldBinding<T[K]> {
    const error = visibleErrors.value[name]
    return {
      modelValue: (values as unknown as T)[name],
      "onUpdate:modelValue": (value: T[K]) => set(name, value),
      onBlur: () => touch(name),
      error,
      invalid: !!error,
    }
  }

  function handleSubmit(fn: (values: T) => unknown) {
    return async (event?: Event) => {
      event?.preventDefault()
      if (submitting.value) return
      submitting.value = true
      try {
        submitCount.value++
        for (const name of keys()) touched[name] = true
        // The values that passed are the values sent: an edit made while an
        // async rule was running is checked again before anything goes out.
        let submitted: T
        do {
          submitted = clone(plain())
          if (!(await validate())) return
        } while (!deepEqual(plain(), submitted))
        await fn(submitted)
        if (deepEqual(plain(), submitted)) {
          baseline = submitted
          baseVersion.value++
        }
      } finally {
        submitting.value = false
      }
    }
  }

  return {
    values,
    errors: merged,
    visibleErrors,
    touched,
    dirty,
    valid,
    validating,
    submitting,
    submitCount,
    isDirty,
    field,
    set,
    setValues,
    touch,
    validate,
    setErrors,
    reset,
    handleSubmit,
  }
}
