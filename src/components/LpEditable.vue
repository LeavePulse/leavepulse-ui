<script lang="ts">
export default { inheritAttrs: false }

export interface EditableLabels extends Record<string, string> {
  edit: string
  empty: string
  saving: string
  failed: string
}
</script>

<script setup lang="ts">
/*
 * Text that is edited where it stands: a server's name in its header, a
 * channel's topic, a note on a row. Reading it is the common case, so it reads
 * as plain text; a click, Enter or F2 turns that same text into a field.
 *
 *   <LpEditable v-model="server.name" label="Server name" :save="rename" />
 *
 * Enter (Ctrl/⌘+Enter when `multiline`) or leaving the field commits; Escape
 * puts the old text back. A commit that changes nothing just closes.
 *
 * Saving is optimistic: the new text shows at once, dimmed with a spinner,
 * while `save` runs. If `save` throws, the field opens again holding what was
 * typed and the error floats under it (LpFieldNotice), so nothing typed is
 * lost and the person can fix it or press Escape. The model only changes once
 * the save succeeded, so the app never holds a value its server refused.
 *
 * The field is the text's twin: same font, same padding, sized by an
 * invisible copy of what is typed, so switching between reading and editing
 * moves nothing around it. The pencil beside the text keeps its room while
 * editing too (an empty spacer of its width), so the row stays where it was. What does change size (a longer name) eases
 * through LpShift.
 */
import { computed, nextTick, ref, watch } from "vue"
import { useFieldNotice } from "../composables/useFieldNotice"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import LpFieldNotice from "./LpFieldNotice.vue"
import LpIcon from "./LpIcon.vue"
import LpLoader from "./LpLoader.vue"
import LpRollingText from "./LpRollingText.vue"
import LpShift from "./LpShift.vue"

const props = withDefaults(
  defineProps<{
    modelValue?: string
    /** What the text is, for assistive tech ("Server name"). */
    label?: string
    /** Shown when the text is empty; clicking it starts editing. */
    placeholder?: string
    /** A textarea; Enter adds a line and Ctrl/⌘+Enter commits. */
    multiline?: boolean
    /**
     * Persists the new text. May be async and may throw: a throw reopens the
     * field with the typed text and shows the error's message.
     */
    save?: (value: string) => unknown
    /**
     * Checks the text before saving. Return an error message to refuse it
     * (the field stays open with the message under it), anything else to accept.
     */
    validate?: (value: string) => string | true | void | null | undefined
    /** Trim spaces around the text on commit. */
    trim?: boolean
    /** Refuse an empty commit (with the `required` message) instead of saving "". */
    required?: boolean
    maxlength?: number
    disabled?: boolean
    /** Shown as text, never editable — for a viewer without the right to change it. */
    readonly?: boolean
    size?: "sm" | "md" | "lg"
    labels?: Partial<EditableLabels & { required: string }>
  }>(),
  { modelValue: "", trim: true, size: "md" },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  /** Editing opened. */
  (e: "edit"): void
  /** Editing closed without a change. */
  (e: "cancel"): void
  /** The text was saved (after `save` resolved, when there is one). */
  (e: "saved", value: string): void
  (e: "error", error: unknown): void
}>()

const text = useLabels<EditableLabels & { required: string }>(
  "editable",
  { edit: "Edit", empty: "Empty", saving: "Saving…", failed: "Couldn't save", required: "Can't be empty" },
  () => props.labels,
)

const editing = ref(false)
const draft = ref("")
const pending = ref<string | null>(null)
const notice = useFieldNotice(4000)

// What reads on screen: the text being saved, else the model.
const shown = computed(() => pending.value ?? props.modelValue)
const interactive = computed(() => !props.disabled && !props.readonly)

const field = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
const idle = ref<HTMLElement | null>(null)

async function open(selectAll = true) {
  if (!interactive.value || editing.value || pending.value !== null) return
  draft.value = props.modelValue
  editing.value = true
  emit("edit")
  await nextTick()
  field.value?.focus({ preventScroll: true })
  if (selectAll) field.value?.select()
}

async function close(refocus: boolean) {
  editing.value = false
  if (!refocus) return
  await nextTick()
  idle.value?.focus({ preventScroll: true })
}

function cancel() {
  notice.clear()
  emit("cancel")
  void close(true)
}

let committing = false
async function commit(refocus: boolean) {
  if (!editing.value || committing) return
  const value = props.trim ? draft.value.trim() : draft.value
  if (value === props.modelValue) {
    notice.clear()
    emit("cancel")
    return close(refocus)
  }
  const problem = props.required && !value ? text.value.required : props.validate?.(value)
  if (typeof problem === "string" && problem) {
    // The field stays open with the reason under it. Focus is not pulled
    // back: after a blur the person has moved on to something else.
    notice.show(problem, { tone: "danger" })
    return
  }
  notice.clear()
  committing = true
  pending.value = value
  await close(refocus)
  try {
    await props.save?.(value)
    emit("update:modelValue", value)
    emit("saved", value)
  } catch (error) {
    emit("error", error)
    draft.value = value
    editing.value = true
    await nextTick()
    // Back into the field only if focus is not already somewhere else.
    const active = document.activeElement
    if (!active || active === document.body || active === idle.value) field.value?.focus({ preventScroll: true })
    notice.show(error instanceof Error && error.message ? error.message : text.value.failed, { tone: "danger" })
  } finally {
    pending.value = null
    committing = false
  }
}

function onIdleKey(event: KeyboardEvent) {
  if (event.key === "Enter" || event.key === "F2" || event.key === " ") {
    event.preventDefault()
    void open()
  }
}

function onFieldKey(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault()
    event.stopPropagation()
    cancel()
  } else if (event.key === "Enter" && !event.isComposing && (!props.multiline || event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    void commit(true)
  }
}

// An outside change while editing (another tab renamed it) is not overwritten
// by an old draft unnoticed: the draft follows when the person had not typed.
let opened = ""
watch(editing, (on) => (opened = on ? props.modelValue : ""))
watch(
  () => props.modelValue,
  (next) => {
    if (editing.value && draft.value === opened) draft.value = next
    opened = next
  },
)

const PAD = { sm: "px-1.5 py-0.5 text-xs", md: "px-2 py-1 text-sm", lg: "px-2.5 py-1.5 text-base" } as const
const spinnerSize = computed(() => (props.size === "sm" ? 11 : 13))
const singleLineRoll = computed(() => !props.multiline && shown.value.length <= 60 && !!shown.value)

const { class: rootClass, attrs: rest } = useMergedAttrs(() => "relative inline-block max-w-full align-baseline")
</script>

<template>
  <span :class="rootClass">
    <LpShift axis="both" class="max-w-full">
      <!-- Reading: the text itself, a button to assistive tech. -->
      <span
        v-if="!editing"
        ref="idle"
        v-bind="rest"
        :role="interactive ? 'button' : undefined"
        :tabindex="interactive ? 0 : undefined"
        :aria-disabled="disabled || undefined"
        :aria-label="interactive ? `${text.edit} ${label ?? ''}: ${shown || placeholder || text.empty}`.replace(' :', ':') : undefined"
        :aria-busy="pending !== null || undefined"
        :title="pending !== null ? text.saving : undefined"
        class="group/edit relative inline-flex max-w-full items-baseline gap-1.5 rounded-control border border-transparent outline-none transition-[background-color,border-color,opacity] duration-(--duration-fast)"
        :class="[
          PAD[size],
          interactive ? 'cursor-text hover:border-line hover:bg-ink/[0.04] focus-visible:ring-2 focus-visible:ring-ring' : '',
          disabled ? 'cursor-not-allowed opacity-55' : '',
          pending !== null ? 'opacity-70' : '',
          multiline ? 'whitespace-pre-wrap break-words' : 'whitespace-nowrap',
        ]"
        @click="open()"
        @keydown="onIdleKey"
      >
        <span v-if="!shown" class="text-muted italic">{{ placeholder ?? text.empty }}</span>
        <LpRollingText v-else-if="singleLineRoll" :value="shown" align="start" class="min-w-0" />
        <span v-else class="min-w-0" :class="multiline ? '' : 'truncate'">{{ shown }}</span>
        <!-- At once, since it takes the pencil's place; silent, since the
             text's aria-busy already says it. -->
        <LpLoader
          v-if="pending !== null"
          size="inline"
          :delay="0"
          aria-hidden="true"
          class="shrink-0 self-center text-muted"
          :style="{ fontSize: `${spinnerSize}px` }"
        />
        <LpIcon
          v-else-if="interactive"
          name="lucide:pencil"
          :size="spinnerSize"
          class="shrink-0 self-center text-muted opacity-0 transition-opacity duration-(--duration-fast) group-hover/edit:opacity-100 group-focus-visible/edit:opacity-100 [@media(hover:none)]:opacity-60"
        />
      </span>

      <!-- Editing: the field over an invisible twin of its text, which gives
           the box its size in every browser (no field-sizing needed). The
           field asks for one column (`size`/`cols`), or its default width of
           ~20 characters would be the box's minimum. -->
      <span v-else class="inline-flex max-w-full items-baseline gap-1.5">
      <span
        class="relative inline-grid max-w-full min-w-0 rounded-control border bg-surface-soft focus-within:ring-2 focus-within:ring-ring"
        :class="notice.tone.value === 'danger' && notice.message.value ? 'border-danger' : 'border-brand'"
      >
        <span
          aria-hidden="true"
          class="invisible col-start-1 row-start-1 min-w-[4ch]"
          :class="[PAD[size], multiline ? 'whitespace-pre-wrap break-words' : 'whitespace-pre']"
        >{{ (draft || placeholder || " ") + (multiline ? "\n" : "\u200a") }}</span>
        <component
          :is="multiline ? 'textarea' : 'input'"
          ref="field"
          :value="draft"
          :size="multiline ? undefined : 1"
          :cols="multiline ? 1 : undefined"
          :aria-label="label"
          :aria-invalid="(notice.tone.value === 'danger' && !!notice.message.value) || undefined"
          :placeholder="placeholder"
          :maxlength="maxlength"
          :rows="multiline ? 1 : undefined"
          class="col-start-1 row-start-1 w-full min-w-0 resize-none overflow-hidden bg-transparent text-ink outline-none placeholder:text-muted"
          :class="PAD[size]"
          @input="draft = ($event.target as HTMLInputElement).value"
          @keydown="onFieldKey"
          @blur="commit(false)"
        />
      </span>
      <span v-if="interactive" aria-hidden="true" class="shrink-0" :style="{ width: `${spinnerSize}px` }" />
      </span>
    </LpShift>
    <!-- The note may be wider than a short text: it gets its own room under
         the text rather than being clipped to the text's width. -->
    <span class="pointer-events-none absolute top-full left-0 h-0 w-[min(22rem,80vw)]">
      <LpFieldNotice :notice="notice" />
    </span>
  </span>
</template>
