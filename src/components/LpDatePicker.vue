<script setup lang="ts">
/*
 * Date field + calendar popover. The model is an ISO date string ("YYYY-MM-DD",
 * v-model), same as LpCalendar (which it embeds). The trigger shows a formatted
 * date; picking a day fills the field and closes the popover. Clearable, with
 * min/max + isDisabled forwarded to the calendar. Themed like the other inputs.
 */
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui"
import { computed, ref } from "vue"
import { POPOVER_PANEL } from "./dropdown"
import LpCalendar from "./LpCalendar.vue"
import LpIcon from "./LpIcon.vue"

const props = withDefaults(
  defineProps<{
    /** Selected date "YYYY-MM-DD" (v-model). */
    modelValue?: string
    placeholder?: string
    min?: string
    max?: string
    isDisabled?: (iso: string) => boolean
    clearable?: boolean
    disabled?: boolean
    invalid?: boolean
    size?: "sm" | "md" | "lg"
    /** Intl format for the displayed date. */
    format?: Intl.DateTimeFormatOptions
  }>(),
  {
    placeholder: "Pick a date",
    size: "md",
    format: () => ({ year: "numeric", month: "short", day: "numeric" }),
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string | undefined): void
}>()

const open = ref(false)

const display = computed(() => {
  if (!props.modelValue) return ""
  // Parse as local midnight so the formatted day can't drift across a timezone.
  const [y, m, d] = props.modelValue.split("-").map(Number)
  if (!y || !m || !d) return props.modelValue
  return new Intl.DateTimeFormat(undefined, props.format).format(new Date(y, m - 1, d))
})

const shellSize = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
  lg: "h-(--size-control-lg) text-sm",
}

function onPick(v: string | undefined) {
  emit("update:modelValue", v)
  open.value = false
}

function clear() {
  emit("update:modelValue", undefined)
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        :disabled="disabled"
        class="group flex w-full items-center gap-2 rounded-control border bg-surface-soft px-3 text-left text-ink outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-brand disabled:cursor-not-allowed disabled:opacity-55"
        :class="[
          shellSize[size],
          invalid ? 'border-danger focus-visible:ring-danger-soft' : 'border-line focus-visible:border-brand',
        ]"
      >
        <LpIcon name="lucide:calendar" :size="16" class="shrink-0 text-muted" />
        <span class="min-w-0 flex-1 truncate" :class="display ? '' : 'text-muted'">
          {{ display || placeholder }}
        </span>
        <span
          v-if="clearable && modelValue && !disabled"
          role="button"
          tabindex="-1"
          aria-label="Clear"
          class="shrink-0 text-muted transition-colors hover:text-ink"
          @click.stop="clear"
          @keydown.enter.stop="clear"
        >
          <LpIcon name="lucide:x" :size="15" />
        </span>
        <LpIcon
          name="lucide:chevron-down"
          :size="15"
          class="shrink-0 text-muted transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-data-[state=open]:rotate-180"
        />
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :side-offset="6"
        align="start"
        :class="[POPOVER_PANEL, 'z-(--z-popover) rounded-card p-0 outline-none']"
      >
        <LpCalendar
          :model-value="modelValue"
          :min="min"
          :max="max"
          :is-disabled="isDisabled"
          class="border-0 bg-transparent"
          @update:model-value="onPick"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
