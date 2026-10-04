<script setup lang="ts">
/*
 * Date field + calendar popover. The model is an ISO date string ("YYYY-MM-DD",
 * v-model), same as LpCalendar (which it embeds). The trigger shows a formatted
 * date; picking a day fills the field and closes the popover. Clearable, with
 * min/max + isDisabled forwarded to the calendar. Themed like the other inputs.
 *
 * With `time`, the model carries a minute too ("YYYY-MM-DDTHH:mm") and the
 * popover grows a time row under the calendar. Anything that needs a moment
 * rather than a day — an expiry, a scheduled start — would otherwise fall back
 * to a native `datetime-local`, which the browser paints in its own locale and
 * chrome, breaking the form it sits in. Picking a day keeps the time already
 * chosen (default `defaultTime`), so the popover closes on the first click for
 * the common case.
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
    /** Also pick a minute; the model becomes "YYYY-MM-DDTHH:mm". */
    time?: boolean
    /** Time a freshly picked day starts at, "HH:mm". */
    defaultTime?: string
    /** Label of the button that closes the popover in `time` mode. */
    doneLabel?: string
  }>(),
  {
    placeholder: "Pick a date",
    size: "md",
    format: () => ({ year: "numeric", month: "short", day: "numeric" }),
    defaultTime: "00:00",
    doneLabel: "Done",
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string | undefined): void
}>()

const open = ref(false)

/** Day half of the model; the calendar never sees the time. */
const day = computed(() => (props.modelValue || "").slice(0, 10))

/** Minute half, "HH:mm" — empty when the model carries a date only. */
const minute = computed(() => {
  const at = (props.modelValue || "").slice(11, 16)
  return /^\d{2}:\d{2}$/.test(at) ? at : ""
})

const display = computed(() => {
  if (!props.modelValue) return ""
  // Parse as local midnight so the formatted day can't drift across a timezone.
  const [y, m, d] = day.value.split("-").map(Number)
  if (!y || !m || !d) return props.modelValue
  const shown = new Intl.DateTimeFormat(undefined, props.format).format(new Date(y, m - 1, d))
  return props.time && minute.value ? `${shown}, ${minute.value}` : shown
})

const shellSize = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
  lg: "h-(--size-control-lg) text-sm",
}

function onPick(v: string | undefined) {
  if (!props.time) {
    emit("update:modelValue", v)
    open.value = false
    return
  }
  // The popover stays open: the time row below is part of the same choice, and
  // closing on the day would hide it right as it becomes reachable.
  emit("update:modelValue", v ? `${v}T${minute.value || props.defaultTime}` : undefined)
}

function onTime(at: string) {
  // A time without a day would be a model no consumer can use; until a day is
  // picked the row is disabled, so this only guards a stray event.
  if (!day.value) return
  emit("update:modelValue", `${day.value}T${at || props.defaultTime}`)
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
          :model-value="day"
          :min="min"
          :max="max"
          :is-disabled="isDisabled"
          class="border-0 bg-transparent"
          @update:model-value="onPick"
        />
        <div v-if="time" class="flex items-center gap-2 border-t border-line px-3 py-2">
          <LpIcon name="lucide:clock" :size="15" class="shrink-0 text-muted" />
          <input
            type="time"
            :value="minute"
            :disabled="!day"
            class="h-(--size-control-sm) flex-1 rounded-control border border-line bg-surface-soft px-2 text-sm text-ink outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55"
            @input="onTime(($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            class="shrink-0 rounded-control px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
            @click="open = false"
          >
            {{ doneLabel }}
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
