<script lang="ts">
// The consumer's `class` is merged into the root's own rather than appended to
// it, so opt out of the automatic pass-through that would add it a second
// time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Phone number field — a country picker (flag + dial code) fused with a free-text
 * number input. Picking a country sets the "+code" prefix; you can also just type
 * the whole "+…" yourself and the flag follows what you typed (longest dial-code
 * match wins). The model is the full string ("+380501234567"); a `change` event
 * also carries the parsed { country, dialCode, number } for forms that want it.
 *
 * Numbers are formatted as they are typed ("+380 50 123 4567") with
 * libphonenumber-js, loaded on first use (see phone.ts). Digits past the
 * longest number the country allows are dropped with a passing note, and a
 * number that cannot be right is marked once the field is left, with the reason
 * floating under it. v-model stays the formatted text the field shows; `change`
 * also carries `e164` ("+380501234567"), `possible` and `valid`, which
 * is what a form should store. Until the library arrives the field takes digits
 * as before, unformatted.
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
import { computed, onMounted, ref, shallowRef, useAttrs } from "vue"
import { useField, useFieldControl } from "../composables/useField"
import { useFieldNotice, type FieldNoticeOptions } from "../composables/useFieldNotice"
import { useInputFilter } from "../composables/useInputFilter"
import { useLabels } from "../composables/useLpConfig"
import { type Country, filterCountries, flagEmoji, loadCountries, matchCountryByValue } from "./countries"
import { OPTION_ITEM, POPOVER_PANEL } from "./dropdown"
import LpFieldNotice from "./LpFieldNotice.vue"
import LpIcon from "./LpIcon.vue"
import {
  caretAfterDigits,
  digitsBefore,
  digitsOf,
  formatPhone,
  loadPhoneExamples,
  loadPhoneLib,
  type PhoneLib,
} from "./phone"
import { useMergedAttrs } from "../composables/useMergedClass"

export interface PhoneDetail {
  /** Matched country, or undefined when the prefix matches none. */
  country?: Country
  /** Dial code without "+", e.g. "380". Empty if unknown. */
  dialCode: string
  /** National part (digits after the dial code). */
  number: string
  /** Normalised "+380501234567"; empty when there are no digits. */
  e164: string
  /** The length fits the country. False until the formatter has loaded. */
  possible: boolean
  /** A real number for the country. False until the formatter has loaded. */
  valid: boolean
  /**
   * "MOBILE", "FIXED_LINE"… when known. The `min` metadata the field loads does
   * not carry number types, so this stays undefined unless that changes.
   */
  type?: string
}

const props = withDefaults(
  defineProps<{
    /** Full phone string, e.g. "+380501234567". Bind with v-model. */
    modelValue?: string
    /** Restrict the country list (ISO2 codes). Omit for all countries. */
    only?: string[]
    /** Default country (ISO2) used when the field is empty. */
    defaultCountry?: string
    /** Unset shows an example number for the active country. */
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    size?: "sm" | "md" | "lg"
    emptyText?: string
    searchPlaceholder?: string
  }>(),
  {
    placeholder: undefined,
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
const { onBeforeInput, onInput: filterInput, onCompositionEnd, onPaste } = useInputFilter({
  restrict: () => PHONE_CHARS,
})

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

const filtered = computed(() => filterCountries(countries.value, query.value))

const phoneLib = shallowRef<PhoneLib>()

function parse(value: string): PhoneDetail {
  const formatted = formatPhone(value, phoneLib.value)
  const country =
    (formatted.country && countries.value.find((c) => c.iso2 === formatted.country)) ??
    matchCountryByValue(value, countries.value)
  const digits = digitsOf(formatted.e164)
  const base = { e164: formatted.e164, possible: formatted.possible, valid: formatted.valid, type: formatted.type }
  if (country) return { ...base, country, dialCode: country.dial, number: digits.slice(country.dial.length) }
  return { ...base, country: undefined, dialCode: "", number: digits }
}

function setValue(value: string) {
  emit("update:modelValue", value)
  emit("change", parse(value))
}

/*
 * Notes float under the field: the LpFormField around it shows them when there
 * is one, otherwise the field shows its own.
 */
const notice = useFieldNotice()
const outerField = useField()
const ownNotice = computed(() => !outerField?.value.notify)
function say(message: string, options?: FieldNoticeOptions) {
  if (outerField?.value.notify) outerField.value.notify(message, options)
  else notice.show(message, options)
}
function unsay() {
  if (outerField?.value.clearNotice) outerField.value.clearNotice()
  else notice.clear()
}

/** Shown invalid after the field was left with a number that cannot be right. */
const flagged = ref(false)
const countryName = (iso?: string) =>
  (iso && countries.value.find((c) => c.iso2 === iso)?.name) || ""

/*
 * Reformat after every edit and put the caret back after the same number of
 * digits it followed, so spaces the formatter adds or moves never push it
 * around.
 */
function onInput(e: Event) {
  filterInput(e)
  const el = e.target as HTMLInputElement
  const before = digitsBefore(el.value, el.selectionStart ?? el.value.length)
  const result = formatPhone(el.value, phoneLib.value)
  if (el.value !== result.display) {
    el.value = result.display
    const caret = caretAfterDigits(result.display, Math.min(before, digitsOf(result.display).length))
    el.setSelectionRange(caret, caret)
  }
  if (flagged.value) {
    flagged.value = false
    unsay()
  }
  if (result.dropped) {
    const name = countryName(result.country)
    say(
      (name ? text.value.tooLongFor : text.value.tooLong)
        .replace("{country}", name)
        .replace("{max}", String(digitsOf(result.e164).length - (result.callingCode?.length ?? 0))),
    )
  }
  setValue(result.display)
}

/*
 * Backspace or Delete next to a space the formatter put there would only remove
 * the space, and formatting would put it straight back: the key would seem
 * dead. The digit beside it goes instead.
 */
function onKeyEdit(e: InputEvent) {
  const el = e.target as HTMLInputElement
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  const backward = e.inputType === "deleteContentBackward"
  const forward = e.inputType === "deleteContentForward"
  if ((!backward && !forward) || start !== end) return
  const value = el.value
  const at = backward ? start - 1 : start
  if (at < 0 || at >= value.length || /\d/.test(value[at]!)) return
  let i = at
  while (i >= 0 && i < value.length && !/\d/.test(value[i]!)) i += backward ? -1 : 1
  if (i < 0 || i >= value.length) return
  e.preventDefault()
  el.value = value.slice(0, i) + value.slice(i + 1)
  const caret = backward ? i : start
  el.setSelectionRange(caret, caret)
  el.dispatchEvent(new Event("input", { bubbles: true }))
}

function onBeforeEdit(e: InputEvent) {
  onKeyEdit(e)
  if (!e.defaultPrevented) onBeforeInput(e)
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

onMounted(async () => {
  const [list, phone] = await Promise.all([loadCountries(), loadPhoneLib().catch(() => undefined)])
  allCountries.value = list
  phoneLib.value = phone
  // A value set before the formatter arrived is shown formatted from now on.
  if (phone && props.modelValue) {
    const display = formatPhone(props.modelValue, phone).display
    if (display !== props.modelValue) setValue(display)
  }
  if (props.placeholder === undefined) examplesFor.value = await loadPhoneExamples().catch(() => undefined)
})

/* An example number for the active country, when the consumer gave no text. */
const examplesFor = shallowRef<Awaited<ReturnType<typeof loadPhoneExamples>>>()
const shownPlaceholder = computed(() => {
  if (props.placeholder !== undefined) return props.placeholder
  const phone = phoneLib.value
  const iso = activeCountry.value?.iso2
  if (phone && examplesFor.value && iso) {
    try {
      return phone.getExampleNumber(iso as never, examplesFor.value)?.formatInternational() ?? text.value.placeholder
    } catch {
      return text.value.placeholder
    }
  }
  return text.value.placeholder
})

// The default country's "+code" is put in place when the user enters an empty
// field, and taken back out if they leave without typing a number. Seeding it
// on mount instead made every untouched optional field submit "+380 ", pass
// `required`, and read as edited.
const seeded = computed(() => (fallback.value ? `+${fallback.value.dial} ` : ""))
function onFocus() {
  if (!props.modelValue && seeded.value) setValue(seeded.value)
}
function onBlur() {
  if (seeded.value && props.modelValue?.trim() === seeded.value.trim()) {
    setValue("")
    return
  }
  const result = phoneLib.value && props.modelValue ? formatPhone(props.modelValue, phoneLib.value) : undefined
  if (!result || result.valid || digitsOf(result.e164).length <= (activeCountry.value?.dial.length ?? 0)) return
  flagged.value = true
  const name = countryName(result.country) || activeCountry.value?.name || ""
  const reason =
    result.problem === "too-short"
      ? (name ? text.value.tooShortFor : text.value.tooShort)
      : result.problem === "invalid-country"
        ? text.value.unknownCountry
        : text.value.invalidNumber
  say(reason.replace("{country}", name), { tone: "danger", duration: 0 })
}

const sizeClass = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
  lg: "h-(--size-control-lg) text-sm",
}

// The control is full-width with its own frame — the two things a consumer
// placing it in a narrow column has to change, so `class="w-48"` must win.
// style lays out the frame; every other attr (name, autocomplete, @blur…)
// belongs to the number <input>.
const attrs = useAttrs()
const field = useFieldControl(() => ({
  wrapped: false,
  id: typeof attrs.id === "string" ? attrs.id : undefined,
  invalid: props.invalid || flagged.value,
  disabled: props.disabled,
}))
const text = useLabels("phoneInput", {
  selectCountry: "Select country",
  placeholder: "Phone number",
  tooLong: "A phone number has at most {max} digits",
  tooLongFor: "Numbers in {country} have at most {max} digits after the code",
  tooShort: "This number is too short",
  tooShortFor: "Too short for {country}",
  invalidNumber: "Not a valid phone number",
  unknownCountry: "Unknown country code",
})
const noticeId = `${field.value.id ?? "lp-phone"}-notice`
const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  [
    "relative flex w-full items-stretch rounded-control border bg-surface-soft text-ink transition-colors duration-[var(--duration-fast)] focus-within:ring-2 focus-within:ring-ring",
    sizeClass[props.size],
    field.value.invalid
      ? "border-danger focus-within:border-danger focus-within:ring-danger-soft"
      : "border-line focus-within:border-brand",
    field.value.disabled ? "cursor-not-allowed opacity-55" : "",
  ].join(" "),
)
const inputAttrs = computed(() => {
  const { style: _s, ...others } = rest.value
  return others
})
</script>

<template>
  <div
    data-lp-ring-owner
    :class="rootClass"
    :style="attrs.style as never"
  >
    <!-- reset-search-term-on-{select,blur}: as in LpSelect, the trigger shows
         the selection and the box only filters, so reka seeding the chosen value
         into it would pin the list to one country. Harmless today because the
         select handler clears `query` by hand, declared so it stays that way. -->
    <ComboboxRoot
      v-model:open="open"
      :ignore-filter="true"
      :reset-search-term-on-select="false"
      :reset-search-term-on-blur="false"
      :disabled="field.disabled"
      class="flex"
    >
      <ComboboxAnchor as-child>
        <ComboboxTrigger
          type="button"
          :disabled="field.disabled"
          class="flex shrink-0 items-center gap-1 rounded-l-control border-r border-line px-2.5 outline-none hover:bg-ink/5 data-[state=open]:bg-ink/5"
          :aria-label="text.selectCountry"
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
          :collision-padding="8"
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
              class="h-(--size-control-sm) w-full rounded-inner border border-line bg-surface-soft px-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-brand"
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
      type="tel"
      inputmode="tel"
      autocomplete="tel"
      v-bind="inputAttrs"
      :id="field.id"
      :value="modelValue"
      :placeholder="shownPlaceholder"
      :disabled="field.disabled"
      :required="field.required || undefined"
      :aria-invalid="field.invalid || undefined"
      :aria-describedby="[field.describedBy, notice.message.value ? noticeId : ''].filter(Boolean).join(' ') || undefined"
      class="lp-autofill min-w-0 flex-1 self-stretch bg-transparent px-3 outline-none placeholder:text-muted"
      @beforeinput="onBeforeEdit"
      @paste="onPaste"
      @compositionend="onCompositionEnd"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
    />
    <LpFieldNotice v-if="ownNotice" :notice="notice" :id="noticeId" />
  </div>
</template>
