<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { computed, useId, useSlots } from "vue"
import { SwitchRoot, SwitchThumb } from "reka-ui"
import { useFieldControl } from "../composables/useField"
import { useOptimisticToggle } from "../composables/useOptimisticToggle"
import LpLoader from "./LpLoader.vue"
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
    /**
     * Saves the new state. The switch flips at once and shows a spinner in its
     * thumb while this runs; if it fails, the switch flips back and the error
     * becomes a toast (or the `error` event, when the app listens). A setting
     * stored on a server needs no busy flag or rollback of its own.
     */
    action?: (value: boolean) => unknown
  }>(),
  { labelPosition: "end" },
)
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void
  /** The `action` finished. */
  (e: "done", value: boolean): void
  /** The `action` failed and the switch went back. Listening turns the kit's own toast off. */
  (e: "error", error: unknown): void
}>()

const { pending, set } = useOptimisticToggle(() => props.action, emit)

const slots = useSlots()
const labelled = computed(() => Boolean(props.label || props.description || slots.default))

const TRACK =
  "group/switch inline-flex h-5 w-9 shrink-0 items-center rounded-pill border border-line bg-surface-soft px-0.5 outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-transparent data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-55"
const THUMB =
  "h-3.5 w-3.5 rounded-full bg-ink shadow transition-[translate,width,background-color] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-active/switch:w-5 group-data-[state=checked]/switch:translate-x-4 group-data-[state=checked]/switch:bg-ink-inverse group-data-[state=checked]/switch:group-active/switch:translate-x-2.5 motion-reduce:group-active/switch:w-3.5"

// Bare, the switch is the root, so a consumer asking for a bigger track must not
// have to depend on stylesheet order to get it. With text, the row is the root
// and the consumer's class lays out the row, as on LpCheckbox.
const { class: rootClass, attrs: rest } = useMergedAttrs(() => {
  if (!labelled.value) return TRACK
  return props.labelPosition === "start"
    ? "flex w-full cursor-pointer items-center justify-between gap-3 text-sm text-ink"
    : "inline-flex cursor-pointer items-center gap-2 text-sm text-ink"
})

// Whatever is not class (name, aria-*, @focus…) belongs to the switch itself,
// labelled or not: on the label row it would land on the <label>.
const field = useFieldControl(() => ({
  wrapped: false,
  id: typeof rest.value.id === "string" ? rest.value.id : undefined,
  disabled: props.disabled,
}))
const descriptionId = `${useId()}-description`
const describedBy = computed(
  () => [props.description && labelled.value ? descriptionId : "", field.value.describedBy ?? ""].filter(Boolean).join(" ") || undefined,
)

function onUpdate(value: boolean) {
  void set(value)
}
</script>

<template>
  <component :is="labelled ? 'label' : 'span'" :class="labelled ? [rootClass, field.disabled && 'cursor-not-allowed'] : 'contents'">
    <span v-if="labelled && labelPosition === 'start'" class="flex min-w-0 flex-col">
      <slot>{{ label }}</slot>
      <span v-if="description" :id="descriptionId" class="text-xs text-muted">{{ description }}</span>
    </span>
    <SwitchRoot
      v-bind="rest"
      :id="field.id"
      :model-value="modelValue"
      :disabled="field.disabled"
      :required="field.required"
      :aria-describedby="describedBy"
      :aria-busy="pending || undefined"
      :class="labelled ? TRACK : rootClass"
      @update:model-value="onUpdate"
    >
      <SwitchThumb :class="[THUMB, 'grid place-items-center']">
        <!-- Hidden from screen readers: the switch itself says aria-busy, and
             a "Loading…" inside it would become part of its name. -->
        <LpLoader
          :active="pending"
          size="inline"
          aria-hidden="true"
          class="text-[10px] text-ink-inverse group-data-[state=checked]/switch:text-ink"
        />
      </SwitchThumb>
    </SwitchRoot>
    <span v-if="labelled && labelPosition === 'end'" class="flex min-w-0 flex-col">
      <slot>{{ label }}</slot>
      <span v-if="description" :id="descriptionId" class="text-xs text-muted">{{ description }}</span>
    </span>
  </component>
</template>
