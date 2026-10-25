<script setup lang="ts">
import { useAttrs } from "vue"
import type { useFieldControl } from "../composables/useField"
import { mergeClass } from "../composables/useMergedClass"
import { PICKER_CLEAR, PICKER_PRESET, PICKER_PRESETS, PICKER_SIZE, PICKER_TRIGGER, pickerTone } from "./calendar"
import LpIcon from "./LpIcon.vue"
import LpPopover from "./LpPopover.vue"
import LpRollingText from "./LpRollingText.vue"

defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{
  field: ReturnType<typeof useFieldControl>["value"]
  display: string
  placeholder: string
  icon: string
  size?: "sm" | "md" | "lg"
  clearable: boolean
  clearLabel: string
  presetsLabel: string
  presets: { label: string; disabled: boolean; selected: boolean; select: () => void }[]
  presetsClass: string
}>(), { size: "md" })
const open = defineModel<boolean>("open")
defineEmits<{ clear: [] }>()
const attrs = useAttrs()
</script>

<template>
  <div :class="mergeClass('relative w-full', attrs.class as string)" :style="attrs.style as never">
    <LpPopover v-model:open="open" align="start" panel-class="flex w-auto max-w-[calc(100vw-1rem)] flex-col rounded-card p-0 sm:flex-row">
      <template #trigger>
        <button
          v-bind="{ ...attrs, class: undefined, style: undefined }"
          :id="field.id"
          type="button"
          :disabled="field.disabled"
          :aria-invalid="field.invalid || undefined"
          :aria-describedby="field.describedBy"
          :class="[PICKER_TRIGGER, PICKER_SIZE[size], pickerTone(field.invalid)]"
        >
          <LpIcon :name="icon" :size="16" class="shrink-0 text-muted" />
          <LpRollingText :value="display || placeholder" align="start" class="min-w-0 flex-1" :class="!display && 'text-muted'" />
          <span v-if="clearable" class="w-[15px] shrink-0" aria-hidden="true" />
          <LpIcon name="lucide:chevron-down" :size="15" class="shrink-0 text-muted transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
        </button>
      </template>
      <div v-if="presets.length" role="group" :aria-label="presetsLabel" :class="[PICKER_PRESETS, presetsClass]">
        <button v-for="(preset, i) in presets" :key="`${i}:${preset.label}`" type="button" :disabled="preset.disabled" :aria-pressed="preset.selected" :class="PICKER_PRESET" @click="preset.select">
          {{ preset.label }}
        </button>
      </div>
      <slot />
    </LpPopover>
    <button v-if="clearable" type="button" :aria-label="clearLabel" :class="PICKER_CLEAR" @click="$emit('clear')">
      <LpIcon name="lucide:x" :size="15" />
    </button>
  </div>
</template>
