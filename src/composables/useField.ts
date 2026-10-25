import { computed, inject, onScopeDispose, provide, useId, type ComputedRef, type InjectionKey } from "vue"
import type { FieldNoticeOptions } from "./useFieldNotice"

/*
 * What a form field tells the control inside it: the id its label points at,
 * the id of the hint/error line the control should be described by, and the
 * states the control should reflect. LpFormField provides it; every kit control
 * consumes it, and so can a consumer's own control placed inside a field.
 */
export interface FieldContext {
  id: string
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
  return !(next instanceof Node && (event.currentTarget as Node | null)?.contains(next))
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
