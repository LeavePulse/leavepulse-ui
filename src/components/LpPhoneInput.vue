<script setup lang="ts">
/*
 * Phone number field — a country picker (flag + dial code) fused with a free-text
 * number input. Picking a country sets the "+code" prefix; you can also just type
 * the whole "+…" yourself and the flag follows what you typed (longest dial-code
 * match wins). The model is the full string ("+380501234567"); a `change` event
 * also carries the parsed { country, dialCode, number } for forms that want it.
 *
 * Deliberately NOT a full phone validator (no libphonenumber) — it stays free
 * text so any number is allowed; `restrict` only blocks obviously non-phone keys.
 */
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from "reka-ui"
import { computed, onMounted, ref } from "vue"
import { useInputFilter } from "../composables/useInputFilter"
import { type Country, flagEmoji, loadCountries, matchCountryByValue } from "./countries"
import { OPTION_ITEM, POPOVER_PANEL } from "./dropdown"
import LpIcon from "./LpIcon.vue"

export interface PhoneDetail {
  /** Matched country, or undefined when the prefix matches none. */
  country?: Country
  /** Dial code without "+", e.g. "380". Empty if unknown. */
  dialCode: string
  /** National part (digits after the dial code). */
  number: string
}

const props = withDefaults(
  defineProps<{
    /** Full phone string, e.g. "+380501234567". Bind with v-model. */
    modelValue?: string
    /** Restrict the country list (ISO2 codes). Omit for all countries. */
    only?: string[]
    /** Default country (ISO2) used when the field is empty. */
    defaultCountry?: string
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    size?: "sm" | "md" | "lg"
    emptyText?: string
    searchPlaceholder?: string
  }>(),
  {
    placeholder: "Phone number",
    size: "md",
    emptyText: "No country",
    searchPlaceholder: "Search country…",
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  (e: "change", detail: PhoneDetail): void
}>()

// Phone keys only: digits, "+", spaces and the usual separators. Free typing of
// "+code" stays possible; letters and junk are blocked at the source.
const PHONE_CHARS = /[\d+()\-\s]/
const { onBeforeInput, onPaste } = useInputFilter({ restrict: () => PHONE_CHARS })

// The dial-code table is code-split; it's empty until the lazy chunk resolves.
// Everything degrades gracefully meanwhile: digits still parse, the flag shows a
// neutral globe, and the list opens once data arrives.
const allCountries = ref<Country[]>([])

const countries = computed<Country[]>(() => {
  if (!props.only?.length) return allCountries.value
  const set = new Set(props.only.map((c) => c.toUpperCase()))
  return allCountries.value.filter((c) => set.has(c.iso2))
})

// Country derived from the current value (flag follows typing). Falls back to
// the default country while the field is empty.
const fallback = computed(() => {
  const iso = props.defaultCountry?.toUpperCase()
  return iso ? countries.value.find((c) => c.iso2 === iso) : undefined
})
const activeCountry = computed<Country | undefined>(
  () => matchCountryByValue(props.modelValue ?? "", countries.value) ?? fallback.value,
)

const open = ref(false)
const query = ref("")

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return countries.value
  return countries.value.filter(
    (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q.replace(/\D/g, "")),
  )
})

function parse(value: string): PhoneDetail {
  const country = matchCountryByValue(value, countries.value)
  const digits = value.replace(/[^\d]/g, "")
  if (country) {
    return { country, dialCode: country.dial, number: digits.slice(country.dial.length) }
  }
  return { country: undefined, dialCode: "", number: digits }
}

function setValue(value: string) {
  emit("update:modelValue", value)
  emit("change", parse(value))
}

function onInput(e: Event) {
  setValue((e.target as HTMLInputElement).value)
}

/**
 * Pick a country from the list: swap the dial prefix, keep the national number.
 * If the field had a recognised country, replace just its code; otherwise prefix
 * the new code onto whatever digits are present.
 */
function chooseCountry(c: Country) {
  const detail = parse(props.modelValue ?? "")
  const national = detail.number
  setValue(`+${c.dial}${national ? " " + national : ""}`)
  open.value = false
  query.value = ""
}

// Load the dial-code table on mount (lazy chunk), then seed the default
// country's "+code" into an empty field so the user starts with the prefix in
// place — but never clobber a value the consumer already provided.
onMounted(async () => {
  allCountries.value = await loadCountries()
  if (!props.modelValue && fallback.value) {
    emit("update:modelValue", `+${fallback.value.dial} `)
  }
})

const sizeClass = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
  lg: "h-(--size-control-lg) text-sm",
}
</script>

<template>
  <div
    class="flex w-full items-stretch rounded-control border bg-surface-soft text-ink transition-colors duration-[var(--duration-fast)] focus-within:ring-2 focus-within:ring-ring"
    :class="[
      sizeClass[size],
      invalid
        ? 'border-danger focus-within:border-danger focus-within:ring-danger-soft'
        : 'border-line focus-within:border-brand',
      disabled ? 'cursor-not-allowed opacity-55' : '',
    ]"
  >
    <ComboboxRoot
      v-model:open="open"
      :ignore-filter="true"
      :disabled="disabled"
      class="flex"
    >
      <ComboboxAnchor as-child>
        <ComboboxTrigger
          type="button"
          :disabled="disabled"
          class="flex shrink-0 items-center gap-1 rounded-l-control border-r border-line px-2.5 outline-none hover:bg-white/[0.04] data-[state=open]:bg-white/[0.04]"
          aria-label="Select country"
        >
          <span class="text-base leading-none">{{ activeCountry ? flagEmoji(activeCountry.iso2) : "🌐" }}</span>
          <LpIcon
            name="lucide:chevron-down"
            :size="14"
            class="text-muted transition-transform data-[state=open]:rotate-180"
          />
        </ComboboxTrigger>
      </ComboboxAnchor>

      <ComboboxPortal>
        <ComboboxContent
          position="popper"
          align="start"
          :side-offset="6"
          :class="[POPOVER_PANEL, 'z-(--z-popover) max-h-72 w-72 overflow-hidden']"
        >
          <div class="border-b border-line p-2">
            <!--
              Update `query` from the raw DOM event, not reka's ComboboxInput
              v-model: reka defers the value to nextTick while the list is
              closed, lagging the first keystroke by one char. (See LpAutocomplete
              for the same fix.)
            -->
            <ComboboxInput
              :model-value="query"
              :placeholder="searchPlaceholder"
              auto-focus
              class="h-(--size-control-sm) w-full rounded-md border border-line bg-surface-soft px-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-brand"
              @input="query = ($event.target as HTMLInputElement).value"
            />
          </div>
          <ComboboxViewport class="max-h-56 overflow-y-auto p-1">
            <ComboboxEmpty class="px-3 py-4 text-center text-sm italic text-muted">
              {{ emptyText }}
            </ComboboxEmpty>
            <ComboboxItem
              v-for="(c, i) in filtered"
              :key="c.iso2"
              :value="c.iso2"
              :style="{ animationDelay: `${Math.min(i, 12) * 22}ms` }"
              :class="[OPTION_ITEM, 'gap-2.5']"
              @select.prevent="chooseCountry(c)"
            >
              <span class="text-base leading-none">{{ flagEmoji(c.iso2) }}</span>
              <span class="min-w-0 flex-1 truncate">{{ c.name }}</span>
              <span class="shrink-0 text-xs text-muted">+{{ c.dial }}</span>
            </ComboboxItem>
          </ComboboxViewport>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>

    <input
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      type="tel"
      inputmode="tel"
      autocomplete="tel"
      class="min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted"
      @beforeinput="onBeforeInput"
      @paste="onPaste"
      @input="onInput"
    />
  </div>
</template>
