<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { computed, useSlots } from "vue"
import { SwitchRoot, SwitchThumb } from "reka-ui"
import { useMergedAttrs } from "../composables/useMergedClass"

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    disabled?: boolean
    label?: string
    /** Secondary line under the label. */
    description?: string
    /**
     * Where the text sits. `end` (default) reads like LpCheckbox: switch, then
     * text. `start` is the settings-row shape: text on the left, the switch
     * pushed to the right edge of the row.
     */
    labelPosition?: "start" | "end"
  }>(),
  { labelPosition: "end" },
)
const emit = defineEmits<{ (e: "update:modelValue", value: boolean): void }>()

const slots = useSlots()
const labelled = computed(() => Boolean(props.label || props.description || slots.default))

const TRACK =
  "group inline-flex h-5 w-9 shrink-0 items-center rounded-pill border border-line bg-surface-soft px-0.5 outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-transparent data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-55"
const THUMB =
  "h-3.5 w-3.5 rounded-full bg-ink shadow transition-[translate,width,background-color] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-active:w-5 group-data-[state=checked]:translate-x-4 group-data-[state=checked]:bg-ink-inverse group-data-[state=checked]:group-active:-translate-x-1 motion-reduce:group-active:w-3.5"

// Bare, the switch is the root, so a consumer asking for a bigger track must not
// have to depend on stylesheet order to get it. With text, the row is the root
// and the consumer's class lays out the row, as on LpCheckbox.
const { class: rootClass, attrs: rest } = useMergedAttrs(() => {
  if (!labelled.value) return TRACK
  return props.labelPosition === "start"
    ? "flex w-full cursor-pointer items-center justify-between gap-3 text-sm text-ink"
    : "inline-flex cursor-pointer items-center gap-2 text-sm text-ink"
})

function onUpdate(value: boolean) {
  emit("update:modelValue", value)
}
</script>

<template>
  <label v-if="labelled" :class="[rootClass, disabled && 'cursor-not-allowed']" v-bind="rest">
    <span v-if="labelPosition === 'start'" class="flex min-w-0 flex-col">
      <slot>{{ label }}</slot>
      <span v-if="description" class="text-xs text-muted">{{ description }}</span>
    </span>
    <SwitchRoot :model-value="modelValue" :disabled="disabled" :class="TRACK" @update:model-value="onUpdate">
      <SwitchThumb :class="THUMB" />
    </SwitchRoot>
    <span v-if="labelPosition === 'end'" class="flex min-w-0 flex-col">
      <slot>{{ label }}</slot>
      <span v-if="description" class="text-xs text-muted">{{ description }}</span>
    </span>
  </label>
  <SwitchRoot
    v-else
    :model-value="modelValue"
    :disabled="disabled"
    :class="rootClass"
    v-bind="rest"
    @update:model-value="onUpdate"
  >
    <SwitchThumb :class="THUMB" />
  </SwitchRoot>
</template>
