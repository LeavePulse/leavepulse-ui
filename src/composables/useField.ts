import { computed, inject, onScopeDispose, provide, useAttrs, useId, type ComputedRef, type InjectionKey } from "vue"
import type { FieldNoticeOptions } from "./useFieldNotice"
import { isElement } from "./useView"

/*
 * What a form field tells the control inside it: the id its label points at,
 * the id of the hint/error line the control should be described by, and the
 * states the control should reflect. LpFormField provides it; every kit control
 * consumes it, and so can a consumer's own control placed inside a field.
 */
export interface FieldContext {
  id: string
  /** Human-readable name shared by controls and contextual commands. */
  label?: string
  hint?: string
  error?: string
  /** Id of the visible label, for controls a `<label for>` cannot name (groups). */
  labelId?: string
  describedBy?: string
  invalid: boolean
  required: boolean
  disabled: boolean
  /** Float a short note under the control without moving the layout (see useFieldNotice). */
  notify?: (text: string, options?: FieldNoticeOptions) => void
  clearNotice?: () => void
}

export const LP_FIELD: InjectionKey<ComputedRef<FieldContext>> = Symbol.for("lp-field")

export function provideField(context: ComputedRef<FieldContext>): void {
  provide(LP_FIELD, context)
}

/** The nearest LpFormField's context, or null outside one. */
export function useField(): ComputedRef<FieldContext> | null {
  return inject(LP_FIELD, null)
}

export function fieldMessageId(id: string): string {
  return `${id}-message`
}

/**
 * The `aria-describedby` of a control: the consumer's own ids, the field's and
 * whatever the control adds, each once. A template's explicit binding replaces
 * what `v-bind` passed, undefined included, so every control merges here
 * instead of dropping the consumer's description.
 */
export function mergeDescribedBy(...ids: unknown[]): string | undefined {
  const all = ids.flatMap((id) => (typeof id === "string" ? id.split(/\s+/) : [])).filter(Boolean)
  return [...new Set(all)].join(" ") || undefined
}

/** Is a boolean attribute that arrived through `$attrs` on? The same test Vue renders it by. */
export function isAttrOn(value: unknown): boolean {
  return !!value || value === ""
}

export interface FieldControlState {
  /** The control wraps itself in its own LpFormField (it has a label, hint or error prop). */
  wrapped: boolean
  /** That own field renders a hint or error line. */
  hasMessage?: boolean
  /** An id the consumer set on the control, which must win over a generated one. */
  id?: string
  invalid?: boolean
  required?: boolean
  disabled?: boolean
}

/**
 * The field state a control renders with: its own wrapping field when it has
 * one, otherwise the field around it, with the control's own flags or-ed in.
 * `id` is undefined only for a bare control outside any field.
 */
export function useFieldControl(
  own: () => FieldControlState,
): ComputedRef<Omit<FieldContext, "id"> & { id?: string }> {
  const outer = useField()
  const generated = useId()
  return computed(() => {
    const state = own()
    if (state.wrapped) {
      const id = state.id ?? generated
      return {
        id,
        labelId: undefined,
        describedBy: state.hasMessage ? fieldMessageId(id) : undefined,
        invalid: !!state.invalid,
        required: !!state.required,
        disabled: !!state.disabled,
      }
    }
    const field = outer?.value
    return {
      id: state.id ?? field?.id,
      labelId: field?.labelId,
      label: field?.label,
      hint: field?.hint,
      error: field?.error,
      describedBy: field?.describedBy,
      invalid: !!state.invalid || !!field?.invalid,
      required: !!state.required || !!field?.required,
      disabled: !!state.disabled || !!field?.disabled,
    }
  })
}

/**
 * Whether a focusout leaves the whole control, not just moves between its own
 * parts (a trigger and a clear button, the segments of a time field, an input
 * and its stepper). Composite controls emit their `blur` only then: focus
 * events do not bubble, so a consumer's `@blur` on the wrapper never fired, and
 * `useForm().field()` could not mark such a field touched.
 */
export function focusLeft(event: FocusEvent): boolean {
  const next = event.relatedTarget
  return !(isElement(next) && (event.currentTarget as Node | null)?.contains(next))
}

/** Trigger and portalled content share a boundary for the control's public blur. */
export function useFieldBlur(blur: (event: FocusEvent) => void) {
  const partId = `lp-field-${useId()}`
  let cancelPending: (() => void) | undefined
  const inside = (target: EventTarget | null) =>
    !!(target as Element | null)?.closest?.(`[data-lp-field-part="${partId}"]`)

  function onFocusOut(event: FocusEvent) {
    cancelPending?.()
    if (inside(event.relatedTarget)) return
    if (event.relatedTarget) return blur(event)
    // A removed calendar cell can lose focus before its trigger gets it back.
    const doc = (event.target as Node).ownerDocument!
    const view = doc.defaultView!
    const frame = view.requestAnimationFrame(() => {
      cancelPending = undefined
      if (!inside(doc.activeElement)) blur(event)
    })
    cancelPending = () => view.cancelAnimationFrame(frame)
  }

  onScopeDispose(() => cancelPending?.())
  return { partId, onFocusOut }
}

/** What a control hands the FieldWrapper around it: its id, its texts, and the classes it takes from the app. */
export function fieldWrapperBinds(
  wrapped: boolean,
  field: { id?: string },
  props: { label?: string; hint?: string; error?: string; required?: boolean },
  attrs: Record<string, unknown>,
) {
  const { label, hint, error, required } = props
  return { wrapped, id: field.id, label, hint, error, required, class: attrs.class, style: attrs.style }
}

/**
 * Whether a control with these props draws its own LpFormField. A label or a
 * hint is its own; an error alone is, except inside an outer LpFormField, which
 * owns the label (its `for` points at the control) and the message line: a
 * second field in it showed the message twice and took the label's control id.
 * There the error only marks the control invalid.
 */
export function wrapsItself(
  own: { label?: string; hint?: string; error?: string },
  outer: ComputedRef<FieldContext> | null,
): boolean {
  if (own.label || own.hint) return true
  return !!own.error && !outer?.value
}

/**
 * A control that takes `label`, `hint` and `error` the way LpInput does: given
 * any of them it wraps itself in LpFormField (FieldWrapper, bound to
 * `wrapper`), an error marks it invalid, and the consumer's class and style lay
 * out that field instead of the control (`ownAttrs` says whether the control's
 * root still takes them). Without them it is the bare control, as before. So
 * `v-bind="form.field('x')"`, which hands every control `error`, shows the
 * message on any of them.
 * Inside an outer LpFormField an error alone does not wrap (wrapsItself).
 */
export function useOwnField(
  state: () => { label?: string; hint?: string; error?: string; required?: boolean; invalid?: boolean; disabled?: boolean; id?: string },
) {
  const attrs = useAttrs()
  const outer = useField()
  const wrapped = computed(() => wrapsItself(state(), outer))
  const field = useFieldControl(() => {
    const own = state()
    return {
      wrapped: wrapped.value,
      hasMessage: !!own.error || !!own.hint,
      id: own.id ?? (typeof attrs.id === "string" ? attrs.id : undefined),
      invalid: !!own.invalid || !!own.error,
      required: own.required,
      disabled: own.disabled,
    }
  })
  const wrapper = computed(() => fieldWrapperBinds(wrapped.value, field.value, state(), attrs))
  /* The attributes for the control itself: all of them, less the class and style the wrapper takes. */
  const controlAttrs = computed(() => {
    if (!wrapped.value) return attrs
    const { class: _class, style: _style, ...rest } = attrs
    return rest
  })
  return { wrapped, field, wrapper, controlAttrs, ownAttrs: () => !wrapped.value }
}

/** The state of a control that takes its id from the app and draws no wrapper of its own. */
export function useAttrsField(state: () => { invalid?: boolean; disabled?: boolean }) {
  const attrs = useAttrs()
  const field = useFieldControl(() => ({
    wrapped: false,
    id: typeof attrs.id === "string" ? attrs.id : undefined,
    ...state(),
  }))
  return { attrs, field }
}
