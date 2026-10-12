import { getCurrentScope, onScopeDispose, ref, type Ref } from "vue"

/*
 * A short note about what just happened to a field ("already added", "up to 5
 * items") that floats under it instead of taking a line in the layout. A
 * validation message belongs in the field's message line and may push the
 * form down; a passing remark about one keystroke should not, or every refused
 * paste would jolt the fields below.
 *
 * Render it with LpFieldNotice inside a `relative` box around the control.
 * LpFormField does that for its control and hands `notify` down the field
 * context, so a control inside a field (or the app) can raise one without
 * owning any markup.
 */
export type FieldNoticeTone = "info" | "danger"

export interface FieldNoticeOptions {
  tone?: FieldNoticeTone
  /** How long it stays, in ms. 0 keeps it until `clear()`. */
  duration?: number
}

export interface FieldNotice {
  message: Ref<string>
  tone: Ref<FieldNoticeTone>
  /** Bumped on every `show`, so a repeat of the same note can nudge rather than sit still. */
  seq: Ref<number>
  show: (text: string, options?: FieldNoticeOptions) => void
  clear: () => void
}

export const FIELD_NOTICE_MS = 2600

export function useFieldNotice(defaultDuration = FIELD_NOTICE_MS): FieldNotice {
  const message = ref("")
  const tone = ref<FieldNoticeTone>("info")
  const seq = ref(0)
  let timer: ReturnType<typeof setTimeout> | undefined

  function clear() {
    if (timer) clearTimeout(timer)
    timer = undefined
    message.value = ""
  }

  function show(text: string, options: FieldNoticeOptions = {}) {
    if (timer) clearTimeout(timer)
    timer = undefined
    message.value = text
    tone.value = options.tone ?? "info"
    seq.value++
    const duration = options.duration ?? defaultDuration
    if (duration > 0 && text) timer = setTimeout(clear, duration)
  }

  if (getCurrentScope()) onScopeDispose(clear)

  return { message, tone, seq, show, clear }
}
