<script lang="ts">
export default { inheritAttrs: false }

export type AutocompleteLabels = {
  clear: string
  placeholder: string
  empty: string
  loading: string
}
</script>

<script setup lang="ts">
import { usePaletteControl, type PaletteControlOptions } from "../composables/usePaletteCommands"
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
import { computed, nextTick, ref, useAttrs, useId, watch } from "vue"
import { useFieldControl } from "../composables/useField"
import { useInputFilter } from "../composables/useInputFilter"
import { useLabels } from "../composables/useLpConfig"
import { CLOSE_ICON, OPTION_ITEM, optionStagger, POPOVER_PANEL } from "./dropdown"
import LpIcon from "./LpIcon.vue"
import OptionContent from "./OptionContent.vue"
import type { LpOptionBase, OptionSelection } from "./options"
import { useOutsideGuard, usePortalTarget } from "../composables/useView"

export type AutocompleteOption = LpOptionBase<string>

/** What the field's value stands for: a name for an id, with an optional muted hint and picture. */
export type AutocompleteSelection = OptionSelection

const props = withDefaults(
  defineProps<{
    /** Contextual palette metadata; false excludes this control. */
    palette?: PaletteControlOptions
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
    /**
     * What the current value stands for, shown in the field itself while it is
     * not being edited: a picked id reads as a person (avatar in place of the
     * icon, name, muted hint) instead of digits nobody recognises, and nothing
     * appears or jumps below the field. Focusing it puts the name in the box,
     * selected, so typing starts a new search; leaving untouched keeps the pick.
     * When room runs short the hint gives way first; the name stays.
     */
    selected?: AutocompleteSelection | null
    labels?: Partial<AutocompleteLabels>
  }>(),
  { palette: undefined,
    size: "md",
    clearable: false,
    filter: true,
    minChars: 1,
    loading: false,
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  /** Fired when a suggestion is explicitly chosen (not on free typing). */
  (e: "select", value: string): void
}>()

const { isInvalid, onBeforeInput, onInput: filterInput, onCompositionEnd, onPaste } = useInputFilter({
  pattern: () => props.pattern,
  restrict: () => props.restrict,
})

const text = computed<string>({
  get: () => props.modelValue ?? "",
  set: (v) => emit("update:modelValue", v),
})

// class/style lay out the whole control; every other attr (name, autocomplete,
// @blur, @keydown…) belongs to the text <input>.
const attrs = useAttrs()
const inputAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs
  return rest
})

const field = useFieldControl(() => ({
  wrapped: false,
  id: typeof attrs.id === "string" ? attrs.id : undefined,
  invalid: props.invalid || isInvalid(props.modelValue),
  disabled: props.disabled,
}))
const isInvalidState = computed(() => field.value.invalid)
const labels = useLabels<AutocompleteLabels>(
  "autocomplete",
  { clear: "Clear", placeholder: "Type…", empty: "No suggestions", loading: "Searching…" },
  () => props.labels,
)
// An explicit prop still wins; unset, the app's labels translate it.
const placeholderText = computed(() => props.placeholder ?? labels.value.placeholder)

// Normalise string|option to a stable shape.
const items = computed<AutocompleteOption[]>(() =>
  (props.options ?? []).map((o) =>
    typeof o === "string" ? { value: o } : o,
  ),
)

// The field's text IS the value here, so a chosen option would otherwise filter
// the list down to itself: reopening the field showed a single row, and the
// other options only came back after erasing what was already selected. The
// filter therefore applies to what the user TYPES, and stops applying as soon
// as a value is picked (or the field is reopened untouched).
const typing = ref(false)

const filtered = computed(() => {
  const q = text.value.trim().toLowerCase()
  if (!props.filter || !typing.value || !q) return items.value
  return items.value.filter((o) => {
    const hay = `${o.label ?? o.value} ${o.description ?? ""}`.toLowerCase()
    return hay.includes(q)
  })
})

const open = ref(false)
const focused = ref(false)
const showSelected = computed(() => !!props.selected?.label && !focused.value)
// Focusing a picked value starts a new search from its name, not from the raw
// value: the name is put in the box selected, so typing replaces it, and
// leaving without typing keeps the pick as it was.
const draft = ref<string | null>(null)
const showImage = computed(() => !!props.selected?.image && (!focused.value || draft.value !== null))
// The pick can change under an untouched, focused field (the name resolves, a
// parent swaps the value): the box follows it instead of keeping the old name.
watch(
  () => props.selected?.label,
  (label) => {
    if (draft.value !== null) draft.value = label ?? null
  },
)
// The box shows the name, but the input's own value is the raw id: a screen
// reader is told who it is through a description.
const selectedId = useId()
const describedBy = computed(() =>
  [field.value.describedBy, showSelected.value ? selectedId : undefined].filter(Boolean).join(" ") || undefined,
)

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

// reka opens the list on every keystroke; below `minChars` (or with nothing to
// show) that only produced an empty "No suggestions" panel, so opening is
// refused here. Closing is always allowed.
function onOpenChange(next: boolean) {
  open.value = next && canOpen.value
}

const hasValue = computed(() => (props.modelValue ?? "").length > 0)

const anchorSize = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
  lg: "h-(--size-control-lg) text-sm",
}

function onInput(event: Event) {
  filterInput(event)
  typing.value = true
  draft.value = null
  text.value = (event.target as HTMLInputElement).value
}

// A click focuses on pointerdown and places the caret on the mouseup that
// follows, which undid the selection made on focus. That one mouseup is
// cancelled; keyboard focus has none and needs nothing.
let pointerFocus = false

function onPointerDown() {
  if (!focused.value) pointerFocus = true
}

function onFocus(event: FocusEvent) {
  // Arriving at a field that already holds a value shows every option, not just
  // the one it currently holds.
  typing.value = false
  focused.value = true
  const input = event.target as HTMLInputElement
  if (props.selected?.label) {
    draft.value = props.selected.label
    if (pointerFocus) input.addEventListener("mouseup", (e) => e.preventDefault(), { once: true })
    void nextTick(() => input.select())
  }
  pointerFocus = false
  if (canOpen.value) open.value = true
}

function onBlur() {
  focused.value = false
  draft.value = null
}

function choose(opt: AutocompleteOption) {
  typing.value = false
  draft.value = null
  emit("update:modelValue", opt.value)
  emit("select", opt.value)
  open.value = false
}

function clear() {
  if (field.value.disabled) return
  typing.value = false
  draft.value = null
  emit("update:modelValue", "")
  open.value = false
}

// Overlays open in the window this component renders in (an LpFrame's, inside one).
const portalTo = usePortalTarget()
// What happens in another document (the page around a frame, or a frame in
// the page) is not "outside" for this layer.
const guardOutside = useOutsideGuard()

usePaletteControl({ disabled: () => field.value.disabled, invalid: () => field.value.invalid })
</script>

<template>
  <ComboboxRoot
    :open="open"
    :ignore-filter="true"
    :reset-search-term-on-blur="false"
    :reset-search-term-on-select="false"
    :disabled="field.disabled"
    :class="['relative', attrs.class]"
    :style="attrs.style as never"
    @update:open="onOpenChange"
  >
    <ComboboxAnchor
      data-lp-ring-owner
      class="flex w-full items-center gap-2 rounded-control border bg-surface-soft px-3 text-ink transition-colors duration-[var(--duration-fast)] focus-within:ring-2 focus-within:ring-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55"
      :class="[
        anchorSize[size],
        isInvalidState
          ? 'border-danger focus-within:border-danger focus-within:ring-danger-soft'
          : 'border-line focus-within:border-brand',
      ]"
    >
      <!-- Picture and icon share one fixed box and cross-fade, so the text
           beside them never moves when one gives way to the other. A field
           that can show a pick sizes the box for the picture from the start. -->
      <span
        v-if="icon || selected?.image"
        class="relative grid shrink-0 place-items-center"
        :class="selected === undefined ? 'size-4' : 'size-5'"
      >
        <LpIcon
          v-if="icon"
          :name="icon"
          :size="16"
          class="col-start-1 row-start-1 text-muted transition-[opacity,scale] duration-[var(--duration-fast)] motion-reduce:transition-none"
          :class="showImage ? 'scale-75 opacity-0' : 'opacity-100'"
        />
        <img
          v-if="selected?.image"
          :src="selected.image"
          alt=""
          class="col-start-1 row-start-1 size-5 rounded-full object-cover transition-[opacity,scale] duration-[var(--duration-fast)] motion-reduce:transition-none"
          :class="showImage ? 'opacity-100' : 'scale-75 opacity-0'"
        />
      </span>
      <!--
        Bind value one-way and update from the raw DOM event, NOT via reka's
        ComboboxInput v-model: reka defers the value/search update to nextTick
        when the list is closed (see processInputValue), which makes the first
        keystroke lag by one char. Reading event.target.value here is synchronous
        so `text` (and the reactive `open`) track the field exactly.
      -->
      <div class="relative flex min-w-0 flex-1 self-stretch">
        <ComboboxInput
          v-bind="inputAttrs"
          :id="field.id"
          :model-value="draft ?? text"
          :placeholder="placeholderText"
          :disabled="field.disabled"
          :required="field.required || undefined"
          :aria-invalid="isInvalidState || undefined"
          :aria-describedby="describedBy"
          class="lp-autofill min-w-0 flex-1 self-stretch bg-transparent outline-none placeholder:text-muted"
          :class="showSelected && 'text-transparent placeholder:text-transparent'"
          @beforeinput="onBeforeInput"
          @paste="onPaste"
          @compositionend="onCompositionEnd"
          @input="onInput"
          @pointerdown="onPointerDown"
          @focus="onFocus"
          @blur="onBlur"
        />
        <!-- Focus and blur do not animate the name: it sits exactly where the
             input's own text sits, so that swap cannot be seen. The hint, which
             exists in one state alone, eases in and out beside it, and the
             whole line fades when a pick appears or is cleared. -->
        <Transition
          enter-active-class="transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none"
          leave-active-class="transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <span
            v-if="selected?.label"
            class="pointer-events-none absolute inset-0 flex min-w-0 items-center gap-1.5"
            aria-hidden="true"
          >
            <span :id="selectedId" class="sr-only">{{ selected.hint ? `${selected.label}, ${selected.hint}` : selected.label }}</span>
            <span class="max-w-full shrink-0 truncate" :class="showSelected ? '' : 'invisible'">{{ selected.label }}</span>
            <span
              v-if="selected.hint"
              class="min-w-0 truncate text-sm text-muted transition-[opacity,translate] duration-[var(--duration-fast)] motion-reduce:transition-none"
              :class="showSelected ? 'opacity-100' : '-translate-x-1 opacity-0'"
            >{{ selected.hint }}</span>
          </span>
        </Transition>
      </div>
      <button
        v-if="clearable && hasValue && !field.disabled"
        type="button"
        class="group flex shrink-0 items-center text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink"
        :aria-label="labels.clear"
        @pointerdown.prevent
        @click="clear"
      >
        <LpIcon
          name="lucide:x"
          :size="16"
          :class="CLOSE_ICON"
        />
      </button>
    </ComboboxAnchor>

    <ComboboxPortal :to="portalTo">
      <ComboboxContent
        @interact-outside="guardOutside"
        @escape-key-down="guardOutside"
        :collision-padding="8"
        position="popper"
        :side-offset="6"
        :class="[POPOVER_PANEL, 'z-(--z-popover) max-h-72 w-(--reka-combobox-trigger-width) overflow-hidden']"
        @open-auto-focus.prevent
      >
        <ComboboxViewport class="max-h-72 overflow-y-auto p-1">
          <div v-if="loading" class="px-3 py-4 text-center text-sm italic text-muted">
            {{ loadingText ?? labels.loading }}
          </div>
          <ComboboxEmpty v-else class="px-3 py-4 text-center text-sm italic text-muted">
            {{ emptyText ?? labels.empty }}
          </ComboboxEmpty>

          <ComboboxItem
            v-for="(opt, i) in filtered"
            :key="opt.value"
            :value="opt.value"
            :disabled="opt.disabled"
            :style="optionStagger(i)"
            :class="[OPTION_ITEM, 'justify-between data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50']"
            @select.prevent="choose(opt)"
          >
            <OptionContent :option="opt" />
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
