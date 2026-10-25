<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from "reka-ui"
import { computed, useId } from "vue"
import LpIcon from "./LpIcon.vue"
import { useFieldControl } from "../composables/useField"
import { useMergedAttrs } from "../composables/useMergedClass"

const props = defineProps<{
  modelValue?: boolean
  /** Mixed state (e.g. a "select all" with a partial selection). Shows a dash. */
  indeterminate?: boolean
  disabled?: boolean
  label?: string
  /** Secondary line under the label, as on LpSwitch. */
  description?: string
  id?: string
  name?: string
}>()
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void
  (e: "change", value: boolean): void
}>()

function onUpdate(v: boolean | "indeterminate") {
  const checked = v === true
  emit("update:modelValue", checked)
  emit("change", checked)
}

const field = useFieldControl(() => ({ wrapped: false, id: props.id, disabled: props.disabled }))
const descriptionId = `${useId()}-description`
const describedBy = computed(
  () => [props.description ? descriptionId : "", field.value.describedBy ?? ""].filter(Boolean).join(" ") || undefined,
)

// The label sits a fixed distance from the box; a dense list of options needs that closer.
// With a description the box aligns with the first line rather than the middle of two.
const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  [
    "group/check inline-flex cursor-pointer gap-2 text-sm text-ink",
    props.description ? "items-start" : "items-center",
  ].join(" "),
)
</script>

<template>
  <label
    :class="rootClass"
    v-bind="rest">
    <CheckboxRoot
      :id="field.id"
      :name="name"
      :model-value="indeterminate ? 'indeterminate' : modelValue"
      :disabled="field.disabled"
      :aria-describedby="describedBy"
      :class="description ? 'mt-px' : ''"
      class="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-line-strong bg-surface-soft outline-none transition-[color,background-color,border-color,box-shadow,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] not-data-[state=checked]:not-data-[state=indeterminate]:group-hover/check:border-brand active:scale-90 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-transparent data-[state=checked]:bg-brand data-[state=indeterminate]:border-transparent data-[state=indeterminate]:bg-brand disabled:cursor-not-allowed disabled:opacity-55"
      @update:model-value="onUpdate"
    >
      <CheckboxIndicator
        class="flex items-center justify-center text-ink-inverse data-[state=checked]:animate-[indicator-in_140ms_var(--ease-emphasized)] data-[state=indeterminate]:animate-[indicator-in_140ms_var(--ease-emphasized)]"
      >
        <LpIcon :name="indeterminate ? 'lucide:minus' : 'lucide:check'" :size="13" />
      </CheckboxIndicator>
    </CheckboxRoot>
    <span v-if="description" class="flex min-w-0 flex-col">
      <slot>{{ label }}</slot>
      <span :id="descriptionId" class="text-xs text-muted">{{ description }}</span>
    </span>
    <slot v-else>{{ label }}</slot>
  </label>
</template>
