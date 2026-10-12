<script lang="ts">
export default { inheritAttrs: false }

export type TagsInputLabels = {
  remove: string
  duplicate: string
  max: string
  added: string
  removed: string
}
</script>

<script setup lang="ts">
/*
 * Free-form list of short values: emails, labels, hostnames. Typing a
 * delimiter or Enter turns the text into a tag, a paste is split into many,
 * Backspace in an empty field selects the last tag and removes it on the next
 * press, and the arrow keys walk the tags (reka TagsInput).
 *
 * Adding is the kit's own (see tags.ts) rather than reka's, so a tag that
 * fails `validate`, the limit or the duplicate policy stays in the field for
 * fixing instead of vanishing. The reason floats under the field
 * (LpFieldNotice) rather than taking a line, so a refused paste never moves
 * the form, and a repeat makes the tag it repeats pulse.
 */
import {
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
  TagsInputRoot,
} from "reka-ui"
import { computed, ref, useAttrs, useId } from "vue"
import { fieldMessageId, useField, useFieldControl } from "../composables/useField"
import { prefersReducedMotion } from "../composables/easing"
import { useFieldNotice, type FieldNoticeOptions } from "../composables/useFieldNotice"
import { useShift } from "../composables/useShift"
import { useLabels } from "../composables/useLpConfig"
import { mergeClass } from "../composables/useMergedClass"
import LpFieldNotice from "./LpFieldNotice.vue"
import LpFormField from "./LpFormField.vue"
import LpIcon from "./LpIcon.vue"
import { addTags, splitTags, type TagDuplicates, type TagRejection, type TagValidator } from "./tags"

const props = withDefaults(
  defineProps<{
    modelValue?: string[]
    placeholder?: string
    /** Characters (or a RegExp) that end a tag while typing and split a paste. */
    delimiter?: string | readonly string[] | RegExp
    /** At most this many tags. */
    max?: number
    /**
     * "reject" keeps a repeat typed with a note, "ignore" drops it with a passing
     * note, "allow" keeps it. Either way the tag it repeats pulses.
     */
    duplicates?: TagDuplicates
    /** Return an error message to refuse a tag. */
    validate?: TagValidator
    /** Applied to each tag before it is checked and stored (trim is always applied). */
    normalize?: (tag: string) => string
    /** Turn leftover text into a tag when the field loses focus. */
    addOnBlur?: boolean
    disabled?: boolean
    invalid?: boolean
    required?: boolean
    label?: string
    hint?: string
    error?: string
    labels?: Partial<TagsInputLabels>
  }>(),
  { modelValue: () => [], delimiter: () => [",", "\n", "\t"], duplicates: "reject", addOnBlur: true },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string[]): void
  (e: "reject", rejected: TagRejection[]): void
  (e: "blur", event: FocusEvent): void
}>()

const text = useLabels<TagsInputLabels>(
  "tagsInput",
  {
    remove: "Remove {tag}",
    duplicate: "{tag} is already added",
    max: "Up to {max} items",
    added: "{tag} added",
    removed: "{tag} removed",
  },
  () => props.labels,
)

const attrs = useAttrs()
const hasField = computed(() => !!props.label || !!props.hint || !!props.error)
/*
 * Notes go to the field that frames the control, which fades its own hint out
 * under them: this component's own LpFormField when it has a label or hint,
 * the one around it otherwise, and a notice of its own only when it stands
 * alone.
 */
const notice = useFieldNotice()
const outerField = useField()
type FieldHandle = { notify: (text: string, options?: FieldNoticeOptions) => void; clearNotice: () => void }
const ownField = ref<FieldHandle | null>(null)
function bindField(c: unknown): void {
  ownField.value = hasField.value && c ? (c as FieldHandle) : null
}
const standalone = computed(() => !hasField.value && !outerField?.value.notify)
function say(message: string, options?: FieldNoticeOptions): void {
  if (hasField.value) ownField.value?.notify(message, options)
  else if (outerField?.value.notify) outerField.value.notify(message, options)
  else notice.show(message, options)
}
function unsay(): void {
  if (hasField.value) ownField.value?.clearNotice()
  else if (outerField?.value.clearNotice) outerField.value.clearNotice()
  else notice.clear()
}
/** A refusal the user still has to act on: the text stays typed and the field reads invalid. */
const stuck = ref(false)
const announcement = ref("")
const noticeId = `${useId()}-notice`

const field = useFieldControl(() => ({
  wrapped: hasField.value,
  hasMessage: !!props.error || !!props.hint,
  id: typeof attrs.id === "string" ? attrs.id : undefined,
  invalid: props.invalid || !!props.error || stuck.value,
  required: props.required,
  disabled: props.disabled,
}))

const describedBy = computed(
  () =>
    [
      field.value.describedBy,
      hasField.value && field.value.id ? `${field.value.id}-notice` : undefined,
      standalone.value && notice.message.value ? noticeId : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined,
)

const rootAttrs = computed(() => {
  const { class: _c, style: _s, id: _i, ...rest } = attrs
  return rest
})

function explain(rejected: TagRejection): string {
  if (rejected.reason === "invalid") return rejected.message ?? ""
  if (rejected.reason === "max") return text.value.max.replace("{max}", String(props.max))
  return text.value.duplicate.replace("{tag}", rejected.value)
}

const inputEl = ref<HTMLInputElement | null>(null)

/*
 * The box grows a row at a time as tags wrap, and shrinks back when they go:
 * eased rather than snapped, so the fields below glide instead of jumping.
 */
const { el: boxEl, tweening, resizing } = useShift({ axis: "height" })

/*
 * Keys follow the tag, not its position: keyed by index, removing the first
 * tag re-keyed every later one and they all replayed their entry. A repeated
 * tag (duplicates "allow") is told apart by which occurrence it is.
 */
const keyed = computed(() => {
  const seen = new Map<string, number>()
  return props.modelValue.map((tag) => {
    const n = seen.get(tag) ?? 0
    seen.set(tag, n + 1)
    return { tag, key: `${n}:${tag}` }
  })
})

/** Draw the eye to a tag that was just typed again. */
function pulse(tag: string): void {
  if (prefersReducedMotion()) return
  const chip = boxEl.value?.querySelector<HTMLElement>(`[data-tag-key="${CSS.escape(`0:${tag}`)}"]`)
  chip?.animate(
    [
      { transform: "scale(1)", boxShadow: "0 0 0 0 transparent" },
      { transform: "scale(1.08)", boxShadow: "0 0 0 2px var(--color-ring)" },
      { transform: "scale(1)", boxShadow: "0 0 0 0 transparent" },
    ],
    { duration: 420, easing: "ease-out" },
  )
}

/** Add whatever `raw` splits into; returns the text that should stay typed. */
function add(raw: string): string {
  const parts = splitTags(raw, props.delimiter)
  if (!parts.length) return ""
  const { tags, rejected, ignored } = addTags(props.modelValue, parts, {
    max: props.max,
    duplicates: props.duplicates,
    validate: props.validate,
    normalize: props.normalize,
  })
  if (tags.length !== props.modelValue.length) {
    const added = tags.slice(props.modelValue.length)
    announcement.value = added.map((t) => text.value.added.replace("{tag}", t)).join(", ")
    emit("update:modelValue", tags)
  }
  stuck.value = rejected.length > 0
  const first = rejected[0]
  if (first) {
    say(explain(first), { tone: first.reason === "invalid" ? "danger" : "info", duration: 0 })
    emit("reject", rejected)
  } else if (ignored.length) {
    say(text.value.duplicate.replace("{tag}", ignored[0]!))
  } else {
    unsay()
  }
  for (const r of rejected) if (r.reason === "duplicate") pulse(props.normalize ? props.normalize(r.value) : r.value)
  for (const tag of ignored) pulse(tag)
  return rejected.map((r) => r.value).join(joiner.value)
}

// Rejected parts go back into the field joined by a delimiter, so committing
// them again splits them the same way.
const joiner = computed(() => {
  const d = props.delimiter
  const visible = d instanceof RegExp ? undefined : (typeof d === "string" ? [d] : d).find((x) => x.trim())
  return visible ? `${visible} ` : " "
})

function commit(el: HTMLInputElement): void {
  el.value = add(el.value)
}

function isDelimiter(data: string): boolean {
  const d = props.delimiter
  if (d instanceof RegExp) return new RegExp(d.source, d.flags.replace(/[gy]/g, "")).test(data)
  return (typeof d === "string" ? [d] : d).includes(data)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing || !(event.target instanceof HTMLInputElement)) return
  if (event.key === "Enter" && event.target.value.trim()) {
    event.preventDefault()
    commit(event.target)
  }
}

function onBeforeInput(event: InputEvent): void {
  if (event.isComposing || !(event.target instanceof HTMLInputElement)) return
  if (event.inputType === "insertText" && event.data && isDelimiter(event.data)) {
    event.preventDefault()
    commit(event.target)
  }
}

function onInput(): void {
  if (!stuck.value) return
  stuck.value = false
  unsay()
}

function onPaste(event: ClipboardEvent): void {
  const pasted = event.clipboardData?.getData("text") ?? ""
  if (!(event.target instanceof HTMLInputElement) || !pasted) return
  if (splitTags(pasted, props.delimiter).length < 2) return
  event.preventDefault()
  const el = event.target
  const typed = el.value.slice(0, el.selectionStart ?? el.value.length) + pasted + el.value.slice(el.selectionEnd ?? el.value.length)
  el.value = add(typed)
}

function onBlur(event: FocusEvent): void {
  emit("blur", event)
  if (props.addOnBlur && event.target instanceof HTMLInputElement && event.target.value.trim()) commit(event.target)
}

function onModel(value: (string | Record<string, unknown>)[] | null): void {
  const next = (value ?? []).map(String)
  const removed = props.modelValue.filter((t) => !next.includes(t))
  if (removed.length) announcement.value = removed.map((t) => text.value.removed.replace("{tag}", t)).join(", ")
  stuck.value = false
  unsay()
  emit("update:modelValue", next)
}

defineExpose({ focus: () => inputEl.value?.focus(), add: (value: string) => add(value) })
</script>

<template>
  <component
    :is="hasField ? LpFormField : 'div'"
    :ref="bindField"
    :label="hasField ? label : undefined"
    :hint="hasField ? hint : undefined"
    :error="hasField ? error : undefined"
    :required="hasField ? required : undefined"
    :id="hasField ? field.id : undefined"
    :class="hasField ? attrs.class : 'contents'"
    :style="hasField ? attrs.style : undefined"
  >
    <div class="relative">
      <TagsInputRoot
        v-bind="rootAttrs"
        :model-value="modelValue"
        :disabled="field.disabled"
        :required="field.required"
        :id="field.id"
        :delimiter="/(?!)/"
        data-lp-ring-owner
        :ref="(c) => (boxEl = (c as { $el?: HTMLElement } | null)?.$el ?? null)"
        :class="
          mergeClass(
            'flex min-h-(--size-control-md) w-full flex-wrap items-center gap-1.5 rounded-control border border-line bg-surface-soft px-2 py-1.5 text-sm text-ink transition-colors duration-[var(--duration-fast)] focus-within:border-brand focus-within:ring-2 focus-within:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55',
            field.invalid ? 'border-danger focus-within:border-danger focus-within:ring-danger-soft' : '',
            hasField ? '' : (attrs.class as string),
            tweening
              ? 'transition-[height,border-color,box-shadow] duration-fast ease-[var(--ease-emphasized)] motion-reduce:transition-none'
              : '',
            resizing ? 'overflow-hidden' : '',
          )
        "
        :style="hasField ? undefined : attrs.style"
        @update:model-value="onModel"
      >
        <TagsInputItem
          v-for="{ tag, key } in keyed"
          :key="key"
          :data-tag-key="key"
          :value="tag"
          class="animate-[chip-in_var(--duration-fast)_var(--ease-emphasized)] motion-reduce:animate-none inline-flex max-w-full items-center gap-1 rounded-pill bg-surface-raised py-0.5 pr-1 pl-2.5 text-xs font-medium text-ink outline-none data-[state=active]:ring-2 data-[state=active]:ring-ring"
        >
          <TagsInputItemText class="truncate" />
          <TagsInputItemDelete
            :aria-labelledby="undefined"
            :aria-label="text.remove.replace('{tag}', tag)"
            class="grid size-4 shrink-0 place-items-center rounded-pill text-muted transition-colors hover:bg-ink/10 hover:text-ink"
          >
            <LpIcon name="lucide:x" :size="12" />
          </TagsInputItemDelete>
        </TagsInputItem>
        <TagsInputInput
          :ref="(c) => (inputEl = (c as { $el?: HTMLInputElement } | null)?.$el ?? null)"
          :placeholder="modelValue.length ? undefined : placeholder"
          :aria-invalid="field.invalid || undefined"
          :aria-describedby="describedBy"
          class="min-w-24 flex-1 bg-transparent px-1 outline-none placeholder:text-muted"
          @keydown="onKeydown"
          @beforeinput="onBeforeInput"
          @input="onInput"
          @paste="onPaste"
          @blur="onBlur"
        />
      </TagsInputRoot>
      <LpFieldNotice v-if="standalone" :notice="notice" :id="noticeId" />
    </div>
    <span class="sr-only" aria-live="polite">{{ announcement }}</span>
  </component>
</template>
