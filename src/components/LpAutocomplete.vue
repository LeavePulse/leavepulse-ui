<script setup lang="ts">
/*
 * Free-text autocomplete — a text field that suggests as you type but never
 * forces a choice. Unlike LpSelect (which binds to an option value and requires
 * picking from the list), the typed text IS the model here: suggestions are
 * just fill-in helpers. Use it for tags, hostnames, search-with-history, etc.
 *
 * Built on reka Combobox so we inherit the accessible listbox wiring (roving
 * focus, aria-activedescendant, type-ahead). The list is decoupled from the
 * value: choosing a suggestion only fills the text, and free input always wins.
 *
 * `restrict`/`pattern` reuse the same cursor- and IME-safe filter as LpInput.
 */
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxViewport,
} from "reka-ui"
import { computed, ref, watch } from "vue"
import { useInputFilter } from "../composables/useInputFilter"
import { CLOSE_ICON, OPTION_ITEM, POPOVER_PANEL } from "./dropdown"
import LpIcon from "./LpIcon.vue"

export interface AutocompleteOption {
  value: string
  label?: string
  description?: string
}

const props = withDefaults(
  defineProps<{
    /** The free text. This is the model — bind with v-model. */
    modelValue?: string
    /** Suggestions. Strings or {value,label,description}. */
    options?: (AutocompleteOption | string)[]
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
    size?: "sm" | "md" | "lg"
    icon?: string
    invalid?: boolean
    emptyText?: string
    loading?: boolean
    loadingText?: string
    /**
     * Filter suggestions client-side against the typed text. Off when the
     * parent fetches matches itself (server-side) — then pass the already
     * narrowed `options` and leave this false.
     */
    filter?: boolean
    /** Min chars before the list opens. 0 = open on focus. */
    minChars?: number
    /** Validation RegExp/string for the whole value (see LpInput). */
    pattern?: RegExp | string
    /** Allowed-character RegExp; hard-blocks other input (see LpInput). */
    restrict?: RegExp
  }>(),
  {
    placeholder: "Type…",
    size: "md",
    clearable: false,
    filter: true,
    minChars: 1,
    emptyText: "No suggestions",
    loading: false,
    loadingText: "Searching…",
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  /** Fired when a suggestion is explicitly chosen (not on free typing). */
  (e: "select", value: string): void
}>()

const { isInvalid, onBeforeInput, onPaste } = useInputFilter({
  pattern: () => props.pattern,
  restrict: () => props.restrict,
})

const text = computed<string>({
  get: () => props.modelValue ?? "",
  set: (v) => emit("update:modelValue", v),
})

const isInvalidState = computed(() => props.invalid || isInvalid(props.modelValue))

// Normalise string|option to a stable shape.
const items = computed<AutocompleteOption[]>(() =>
  (props.options ?? []).map((o) =>
    typeof o === "string" ? { value: o } : o,
  ),
)

const filtered = computed(() => {
  const q = text.value.trim().toLowerCase()
  if (!props.filter || !q) return items.value
  return items.value.filter((o) => {
    const hay = `${o.label ?? o.value} ${o.description ?? ""}`.toLowerCase()
    return hay.includes(q)
  })
})

const open = ref(false)
const focused = ref(false)

// Threshold met AND something to show → the list is allowed to open.
const canOpen = computed(
  () =>
    text.value.length >= props.minChars &&
    (props.loading || filtered.value.length > 0),
)

// Drive `open` REACTIVELY from canOpen instead of reading it inside @input — the
// input event fires before the value round-trips into `text`, so reading canOpen
// there is one keystroke stale (type one char → nothing; type a second → the
// list for the first appears). Watching it recomputes after `text` settles.
//
// Open-only: once the user is focused and the list has opened we DON'T auto-close
// it when the text is cleared — it stays up until Esc, blur, or a selection. So
// we only ever flip `open` to true here, never back to false.
watch(canOpen, (can) => {
  if (focused.value && can) open.value = true
})

const hasValue = computed(() => (props.modelValue ?? "").length > 0)

const anchorSize = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
  lg: "h-(--size-control-lg) text-sm",
}

function onFocus() {
  focused.value = true
  if (canOpen.value) open.value = true
}

function choose(opt: AutocompleteOption) {
  emit("update:modelValue", opt.value)
  emit("select", opt.value)
  open.value = false
}

function clear() {
  emit("update:modelValue", "")
  open.value = false
}
</script>

<template>
  <ComboboxRoot
    v-model:open="open"
    :ignore-filter="true"
    :reset-search-term-on-blur="false"
    :reset-search-term-on-select="false"
    :disabled="disabled"
    class="relative"
  >
    <ComboboxAnchor
      class="flex w-full items-center gap-2 rounded-control border bg-surface-soft px-3 text-ink transition-colors duration-[var(--duration-fast)] focus-within:ring-2 focus-within:ring-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55"
      :class="[
        anchorSize[size],
        isInvalidState
          ? 'border-danger focus-within:border-danger focus-within:ring-danger-soft'
          : 'border-line focus-within:border-brand',
      ]"
    >
      <LpIcon v-if="icon" :name="icon" :size="16" class="shrink-0 text-muted" />
      <!--
        Bind value one-way and update from the raw DOM event, NOT via reka's
        ComboboxInput v-model: reka defers the value/search update to nextTick
        when the list is closed (see processInputValue), which makes the first
        keystroke lag by one char. Reading event.target.value here is synchronous
        so `text` (and the reactive `open`) track the field exactly.
      -->
      <ComboboxInput
        :model-value="text"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-invalid="isInvalidState || undefined"
        auto-focus
        class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
        @beforeinput="onBeforeInput"
        @paste="onPaste"
        @input="text = ($event.target as HTMLInputElement).value"
        @focus="onFocus"
        @blur="focused = false"
      />
      <button
        v-if="clearable && hasValue"
        type="button"
        class="group flex shrink-0 items-center text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink"
        aria-label="Clear"
        @pointerdown.prevent="clear"
      >
        <LpIcon
          name="lucide:x"
          :size="16"
          :class="CLOSE_ICON"
        />
      </button>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        :side-offset="6"
        :class="[POPOVER_PANEL, 'z-(--z-popover) max-h-72 w-(--reka-combobox-trigger-width) overflow-hidden']"
        @open-auto-focus.prevent
      >
        <ComboboxViewport class="max-h-72 overflow-y-auto p-1">
          <div v-if="loading" class="px-3 py-4 text-center text-sm italic text-muted">
            {{ loadingText }}
          </div>
          <ComboboxEmpty v-else class="px-3 py-4 text-center text-sm italic text-muted">
            {{ emptyText }}
          </ComboboxEmpty>

          <ComboboxItem
            v-for="(opt, i) in filtered"
            :key="opt.value"
            :value="opt.value"
            :style="{ animationDelay: `${Math.min(i, 12) * 22}ms` }"
            :class="[OPTION_ITEM, 'justify-between']"
            @select.prevent="choose(opt)"
          >
            <span class="flex min-w-0 flex-col">
              <span class="truncate">{{ opt.label ?? opt.value }}</span>
              <span v-if="opt.description" class="truncate text-xs text-muted">
                {{ opt.description }}
              </span>
            </span>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
