<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import FieldWrapper from "./FieldWrapper.vue"
import { usePaletteControl, type PaletteControlOptions } from "../composables/usePaletteCommands"
import { CheckboxIndicator, CheckboxRoot } from "reka-ui"
import { computed, useId } from "vue"
import LpIcon from "./LpIcon.vue"
import LpLoader from "./LpLoader.vue"
import { isAttrOn, mergeDescribedBy, useOwnField } from "../composables/useField"
import { useOptimisticToggle } from "../composables/useOptimisticToggle"
import { useMergedAttrs } from "../composables/useMergedClass"

const props = withDefaults(defineProps<{
    /** Contextual palette metadata; false excludes this control. */
    palette?: PaletteControlOptions
  modelValue?: boolean
  /** Mixed state (e.g. a "select all" with a partial selection). Shows a dash. */
  indeterminate?: boolean
  disabled?: boolean
  /** A message under the control, as on LpInput: it marks it invalid and shows under it (what `form.field()` hands it). */
  error?: string
  label?: string
  /** Secondary line under the label, as on LpSwitch. */
  description?: string
  id?: string
  name?: string
  /**
   * Saves the new state, as LpSwitch's `action`: the box ticks at once and
   * spins while this runs; a failure unticks it and becomes an error toast
   * (or the `error` event, when the app listens). From the mixed state,
   * `v-model:indeterminate` gets it back as well.
   */
  action?: (value: boolean) => unknown
}>(), { palette: undefined })
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void
  (e: "update:indeterminate", value: boolean): void
  (e: "change", value: boolean): void
  /** The `action` finished. */
  (e: "done", value: boolean): void
  /** The `action` failed and the box went back. Listening turns the kit's own toast off. */
  (e: "error", error: unknown): void
}>()

// The box was mixed when this save began: a boolean rollback cannot say so.
let wasMixed = false
const { pending, set } = useOptimisticToggle(() => props.action, emit, () => {
  if (wasMixed) emit("update:indeterminate", true)
})

function onUpdate(v: boolean | "indeterminate") {
  const checked = v === true
  if (pending.value) return
  wasMixed = !!props.indeterminate
  if (wasMixed) emit("update:indeterminate", false)
  void set(checked)
  emit("change", checked)
}


// The label sits a fixed distance from the box; a dense list of options needs that closer.
// With a description the box aligns with the first line rather than the middle of two.
const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  [
    "group/check inline-flex cursor-pointer gap-2 text-sm text-ink",
    props.description ? "items-start" : "items-center",
  ].join(" "), () => ownAttrs())

/*
 * The box is the control, so what describes it (aria-*, name, title) goes to
 * the box, as on LpSwitch: on the <label> a reader never hears it. Focus does
 * not bubble, so its listeners go there too. The other listeners stay on the
 * label, the whole hit area: a press on the text must reach them as well.
 */
const FOCUS_LISTENER = /^on(Focus|Blur)/
const LISTENER = /^on[A-Z]/
const parts = computed(() => {
  const label: Record<string, unknown> = {}
  const control: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest.value)) {
    const onLabel = key === "style" || (LISTENER.test(key) && !FOCUS_LISTENER.test(key))
    if (onLabel) label[key] = value
    else control[key] = value
  }
  return { label, control }
})

const { field, wrapper, ownAttrs } = useOwnField(() => ({ error: props.error, id: props.id,
  required: isAttrOn(rest.value.required),
  disabled: props.disabled,
}))
const descriptionId = `${useId()}-description`
const describedBy = computed(() =>
  mergeDescribedBy(rest.value["aria-describedby"], props.description ? descriptionId : undefined, field.value.describedBy),
)

usePaletteControl({ label: () => props.label, disabled: () => field.value.disabled || pending.value, editorProps: () => ({ action: undefined, 'onUpdate:modelValue': onUpdate, onChange: undefined }) })
</script>

<template>
  <FieldWrapper v-bind="wrapper">
  <label
    :class="rootClass"
    v-bind="parts.label">
    <CheckboxRoot
      v-bind="parts.control"
      :id="field.id"
      :name="name"
      :model-value="indeterminate ? 'indeterminate' : modelValue"
      :disabled="field.disabled"
      :required="field.required"
      :aria-describedby="describedBy"
      :aria-busy="pending || undefined"
      :class="description ? 'mt-px' : ''"
      class="lp-tap relative flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-line-strong bg-surface-soft outline-none transition-[color,background-color,border-color,box-shadow,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] not-data-[state=checked]:not-data-[state=indeterminate]:group-hover/check:border-brand active:scale-90 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-transparent data-[state=checked]:bg-brand data-[state=indeterminate]:border-transparent data-[state=indeterminate]:bg-brand disabled:cursor-not-allowed disabled:opacity-55"
      @update:model-value="onUpdate"
    >
      <CheckboxIndicator
        class="flex items-center justify-center text-ink-inverse data-[state=checked]:animate-[indicator-in_140ms_var(--ease-emphasized)] data-[state=indeterminate]:animate-[indicator-in_140ms_var(--ease-emphasized)]"
      >
        <LpIcon :name="indeterminate ? 'lucide:minus' : 'lucide:check'" :size="13" :class="pending && 'opacity-0'" />
      </CheckboxIndicator>
      <!-- At once, since the check already gave way to it, and hidden from
           screen readers: the box says aria-busy, and a "Loading…" inside it
           would become part of its name. -->
      <LpLoader
        v-if="pending"
        size="inline"
        :delay="0"
        aria-hidden="true"
        class="absolute text-[12px]"
        :class="modelValue ? 'text-ink-inverse' : 'text-muted'"
      />
    </CheckboxRoot>
    <span v-if="description" class="flex min-w-0 flex-col">
      <slot>{{ label }}</slot>
      <span :id="descriptionId" class="text-xs text-muted">{{ description }}</span>
    </span>
    <slot v-else>{{ label }}</slot>
  </label>
  </FieldWrapper>
</template>
