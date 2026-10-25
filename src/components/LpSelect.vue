<script lang="ts">
// The consumer's `class` is merged into the root's own rather than appended to
// it, so opt out of the automatic pass-through that would add it a second
// time, unmerged.
export default { inheritAttrs: false }

export type SelectLabels = {
  clear: string
  selected: string
  placeholder: string
  search: string
  searchLabel: string
  empty: string
  loading: string
}
</script>

<script setup lang="ts" generic="V extends SelectValue = string">
/*
 * One select to rule them all — built on reka-ui Combobox.
 * `searchable` opts into the filter input; without it, it's a plain select.
 * `multiple` + `clearable` are orthogonal flags. Generic over the value type V
 * (string by default; pass number-valued options to get a numeric model) so
 * change/update events carry the caller's exact type — no casts at call-sites.
 */
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from "reka-ui"
import { computed, nextTick, reactive, ref, useAttrs, useId, watch } from "vue"
import { useFieldControl } from "../composables/useField"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { OPTION_ITEM, optionStagger, POPOVER_PANEL } from "./dropdown"
import LpIcon from "./LpIcon.vue"
import OptionContent from "./OptionContent.vue"
import LpRollingText from "./LpRollingText.vue"
import type { LpOptionBase, OptionSelection } from "./options"
import { fitChips, toggledValues } from "./select"
import { useOutsideGuard, usePortalTarget } from "../composables/useView"
import { useResizeObserver } from "../composables/useResizeObserver"

export type SelectValue = string | number

export interface SelectOption<V extends SelectValue = SelectValue> extends LpOptionBase<V> {
  label: string
}

/** What a picked value stands for when the options cannot say: same shape as LpAutocomplete's `selected`. */
export type SelectSelection = OptionSelection

type Model = V | V[] | undefined

const props = withDefaults(
  defineProps<{
    modelValue?: Model
    options: SelectOption<V>[]
    placeholder?: string
    searchPlaceholder?: string
    searchable?: boolean
    multiple?: boolean
    clearable?: boolean
    disabled?: boolean
    invalid?: boolean
    emptyText?: string
    // Server-side search: bind with `v-model:searchTerm`. When provided, the
    // parent owns filtering (fetches matching `options` per term), so the
    // built-in client filter is bypassed. `loading` shows a busy hint.
    searchTerm?: string
    loading?: boolean
    loadingText?: string
    /** Trigger height, keyed to --size-control-*. Default "md". */
    size?: "sm" | "md" | "lg"
    /**
     * What the current value stands for, for when `options` cannot say: with
     * server-side search the picked option is usually not among the current
     * results, and a value restored from a saved form arrives before any list
     * does. For `multiple`, an array matching `modelValue` by position.
     * Options the user picks in this session are remembered on their own, so
     * this is only needed for values the field has never listed.
     */
    selected?: SelectSelection | (SelectSelection | null | undefined)[] | null
    labels?: Partial<SelectLabels>
  }>(),
  {
    searchable: false,
    multiple: false,
    clearable: false,
    disabled: false,
    searchTerm: undefined,
    loading: false,
    size: "md",
  },
)

const SIZE_HEIGHT = {
  sm: "h-(--size-control-sm)",
  md: "h-(--size-control-md)",
  lg: "h-(--size-control-lg)",
} as const
const anchorHeight = computed(() => SIZE_HEIGHT[props.size])

const field = useFieldControl(() => ({
  wrapped: false,
  invalid: props.invalid,
  disabled: props.disabled,
}))
const labels = useLabels<SelectLabels>(
  "select",
  {
    clear: "Clear",
    selected: "{count} selected",
    placeholder: "Select…",
    search: "Search…",
    searchLabel: "Search options",
    empty: "Nothing found",
    loading: "Searching…",
  },
  () => props.labels,
)
// An explicit prop still wins; unset, the text comes from the app's labels so
// one config translates every select at once.
const placeholderText = computed(() => props.placeholder ?? labels.value.placeholder)
const searchPlaceholderText = computed(() => props.searchPlaceholder ?? labels.value.search)
const emptyLabel = computed(() => props.emptyText ?? labels.value.empty)
const loadingLabel = computed(() => props.loadingText ?? labels.value.loading)

// The consumer's `class="w-40"` has to beat the root's own layout.
const { class: rootClass, attrs: rootAttrs } = useMergedAttrs("relative")

const emit = defineEmits<{
  // Full v-model state (single value, array for multiple, or empty).
  (e: "update:modelValue", value: Model): void
  // The value the user just chose — always a concrete V, so single-select
  // handlers can take `(v: V)` without widening. With `multiple` it is the
  // value just toggled, on or off: `modelValue.includes(v)` tells which.
  (e: "change", value: V): void
  // Search input text (for `v-model:searchTerm` / server-side search).
  (e: "update:searchTerm", value: string): void
  /** Focus left the whole field (not into its own list or clear button). */
  (e: "blur", event: FocusEvent): void
}>()

// Server-side search is active when the parent binds searchTerm.
const serverSide = computed(() => props.searchTerm !== undefined)
const localQuery = ref("")
const query = computed<string>({
  get: () => (serverSide.value ? (props.searchTerm ?? "") : localQuery.value),
  set: (v) => {
    if (serverSide.value) emit("update:searchTerm", v)
    else localQuery.value = v
  },
})

// The search box keeps whatever was typed last time, so reopening the list
// showed it still filtered — usually down to the single option matching the
// current value, which reads as "the list only has what I already picked".
// Clearing on both edges of the transition means every opening starts whole.
//
// This is not enough on its own: reka seeds the box on *select*, not on open,
// so the next opening filters before this runs. `reset-search-term-on-select`
// below is what stops the seeding; this keeps a stale term from surviving.
const isOpen = ref(false)
function onOpenChange(open: boolean) {
  isOpen.value = open
  query.value = ""
}

// Leaving the field, not moving between its parts: the trigger and the list
// are marked with one id, because the list is portalled away from the trigger
// and a check on the trigger alone either missed the search box or took a
// step into it for leaving.
const partOf = `lp-select-${useId()}`
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Element | null
  const inside = !!next && typeof next.closest === "function" && !!next.closest(`[data-lp-select-part="${partOf}"]`)
  if (!inside) emit("blur", event)
}

/*
 * The trigger's name. reka hard-codes aria-label="Show popup" on it, which hid
 * the field's label and the chosen value; aria-labelledby outranks aria-label,
 * so inside a labelled field the name is the label plus the value. On its own,
 * the consumer's aria-label, else the value or placeholder.
 */
const attrs = useAttrs()
const valueId = `lp-select-${useId()}-value`
const valueText = computed(() => (chips.value.length ? chipNames.value : displayLabel.value || placeholderText.value))
const triggerName = computed(() =>
  field.value.labelId
    ? { "aria-labelledby": `${field.value.labelId} ${valueId}`, "aria-label": undefined }
    : { "aria-label": (attrs["aria-label"] as string | undefined) ?? valueText.value },
)

// reka's Combobox forbids an empty-string item value (it reserves "" for
// "cleared"). An empty-string option is legitimate for us (e.g. "Any edition"),
// so we encode "" to a sentinel for reka and decode it back at the boundary —
// callers never see the sentinel.
const EMPTY_SENTINEL = "\u0000__lp_empty__"
function encode(v: SelectValue): SelectValue
function encode(v: SelectValue | undefined): SelectValue | undefined
function encode(v: SelectValue | undefined): SelectValue | undefined {
  return v === "" ? EMPTY_SENTINEL : v
}
function decode(v: SelectValue): SelectValue {
  return v === EMPTY_SENTINEL ? ("" as SelectValue) : v
}

// Whether "" is a real choice here, or just how the caller spells "nothing
// picked yet". Only the first deserves the sentinel: encoding the second hands
// reka a value with no matching item, and it seeds the search box with that —
// filtering the list down to nothing on a field the user has not touched.
const hasEmptyOption = computed(() =>
  props.options.some((o) => (o.value as SelectValue) === ""),
)

const comboModel = computed<SelectValue | SelectValue[] | undefined>(() => {
  const v = props.modelValue
  if (Array.isArray(v)) return v.map((item) => encode(item) as SelectValue)
  if (v === "" && !hasEmptyOption.value) return undefined
  return encode(v as SelectValue | undefined)
})

const filtered = computed(() => {
  // Server-side mode: the parent already returns the matching options.
  if (serverSide.value) return props.options
  const q = query.value.trim().toLowerCase()
  if (!props.searchable || !q) return props.options
  return props.options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q),
  )
})

/*
 * What a value stands for. `options` alone could not say once they changed:
 * with server-side search the pick drops out of the results on the next query,
 * and the trigger fell back to the placeholder (or printed a raw id with
 * `multiple`). So, in order: what the parent says through `selected`, the
 * option currently listed, and the option the user picked earlier in this
 * session, remembered here for exactly that case.
 */
type Shown = { label: string; hint?: string; image?: string; icon?: string }

const remembered = reactive(new Map<SelectValue, Shown>())

function fromOption(o: SelectOption<V>): Shown {
  return { label: o.label, hint: o.description, image: o.image, icon: o.icon }
}

function remember(values: readonly SelectValue[]) {
  for (const v of values) {
    const o = props.options.find((x) => x.value === v)
    if (o) remembered.set(v, fromOption(o))
  }
}

const modelList = computed<V[]>(() => {
  const v = props.modelValue
  if (Array.isArray(v)) return v
  return v === undefined || (v === "" && !hasEmptyOption.value) ? [] : [v]
})

watch([modelList, () => props.options], ([values]) => remember(values), { immediate: true })

function shown(v: V, index: number): Shown | undefined {
  const sel = props.selected
  const given = Array.isArray(sel) ? sel[index] : index === 0 ? sel : undefined
  if (given?.label) return given
  const o = props.options.find((x) => x.value === v)
  return o ? fromOption(o) : remembered.get(v)
}

const current = computed(() => {
  if (props.multiple) return undefined
  const v = modelList.value[0]
  return v === undefined ? undefined : shown(v, 0)
})

// Chips for the picks that have a name; the rest are only counted.
const chips = computed(() =>
  props.multiple
    ? modelList.value.flatMap((value, i) => {
        const s = shown(value, i)
        return s ? [{ value, ...s }] : []
      })
    : [],
)

const displayLabel = computed(() => {
  if (props.multiple) {
    const count = modelList.value.length
    return count ? labels.value.selected.replace("{count}", String(count)) : ""
  }
  return current.value?.label ?? ""
})

// What makes the shown pick "another one": its name, hint and picture together.
const rollKey = computed(() => {
  const c = current.value
  return c ? [c.label, c.hint ?? "", c.image ?? c.icon ?? ""].join("\u0000") : `\u0000${placeholderText.value}`
})

/*
 * Chips collapse to "+N" when the row runs out of room. Every chip is drawn a
 * second time in an invisible probe row at its natural width; the visible row
 * keeps as many as fit beside the "+N" chip. The probe's "+N" is sized for the
 * whole count, the widest it can get, so the fit never overshoots.
 */
const chipRow = ref<HTMLElement | null>(null)
const probeRow = ref<HTMLElement | null>(null)
const fit = ref(Number.POSITIVE_INFINITY)

function measure() {
  const row = chipRow.value
  const probe = probeRow.value
  if (!row || !probe) return
  const kids = Array.from(probe.children) as HTMLElement[]
  const more = kids.pop()
  const gap = Number.parseFloat(getComputedStyle(probe).columnGap) || 0
  fit.value = fitChips(
    kids.map((k) => k.offsetWidth),
    row.clientWidth,
    gap,
    more?.offsetWidth ?? 0,
  )
}

useResizeObserver(chipRow, () => measure())
watch(chips, () => void nextTick(measure), { flush: "post", deep: true })

const shownChips = computed(() => chips.value.slice(0, fit.value))
const hiddenCount = computed(() => modelList.value.length - shownChips.value.length)
// The chips are drawn for the eye; a screen reader gets the names as a sentence.
const chipNames = computed(() => {
  const names = chips.value.map((c) => c.label)
  const unnamed = modelList.value.length - names.length
  if (unnamed) names.push(labels.value.selected.replace("{count}", String(unnamed)))
  return names.join(", ")
})

const hasValue = computed(() => modelList.value.length > 0)

function onUpdate(value: unknown) {
  const decoded = Array.isArray(value)
    ? value.map((item) => decode(item as SelectValue))
    : decode(value as SelectValue)
  remember(Array.isArray(decoded) ? decoded : [decoded])
  const previous = modelList.value
  emit("update:modelValue", decoded as Model)
  if (!Array.isArray(decoded)) {
    emit("change", decoded as V)
    return
  }
  for (const v of toggledValues<SelectValue>(previous, decoded)) emit("change", v as V)
}

function clear() {
  if (field.value.disabled) return
  emit("update:modelValue", (props.multiple ? [] : undefined) as Model)
}

// Overlays open in the window this component renders in (an LpFrame's, inside one).
const portalTo = usePortalTarget()
// What happens in another document (the page around a frame, or a frame in
// the page) is not "outside" for this layer.
const guardOutside = useOutsideGuard()
</script>

<template>
  <!-- reset-search-term-on-{select,blur}: reka writes the chosen value into the
       search box, and with no displayValue that is the raw value — an id, not a
       label. Here the trigger shows the selection and the box only filters, so
       the seeding left the list pinned to one option until it was cleared by
       hand. Both flags default true and reach the same writer, so both must go:
       we own the term (`query`) and reka must not write to it. -->
  <ComboboxRoot
    :model-value="comboModel"
    :multiple="multiple"
    :disabled="field.disabled"
    :required="field.required"
    :ignore-filter="true"
    :reset-search-term-on-select="false"
    :reset-search-term-on-blur="false"
    :class="rootClass"
    v-bind="rootAttrs"
    @update:model-value="onUpdate"
    @update:open="onOpenChange"
  >
    <ComboboxAnchor
      :data-lp-select-part="partOf"
      @focusout="onFocusOut"
      :class="[
        anchorHeight,
        'group flex w-full items-center gap-2 rounded-control border bg-surface-soft px-3 text-sm text-ink transition-colors duration-[var(--duration-fast)] focus-within:ring-2',
        field.disabled && 'cursor-not-allowed opacity-55',
        field.invalid
          ? 'border-danger focus-within:border-danger focus-within:ring-danger-soft'
          : 'border-line focus-within:border-brand focus-within:ring-ring',
      ]"
    >
      <!-- min-w-0 so the `truncate` below can actually take effect: a flex item
           will not go narrower than its content without it, so a long
           placeholder stretched the whole field past the viewport instead of
           being cut short. -->
      <span :id="valueId" hidden>{{ valueText }}</span>
      <ComboboxTrigger
        :id="field.id"
        v-bind="triggerName"
        :aria-invalid="field.invalid || undefined"
        :aria-describedby="field.describedBy"
        class="flex min-w-0 flex-1 items-center gap-2 outline-none"
      >
        <!-- Several picks read as chips (picture + name) that collapse into
             "+N" when the row runs out of room. Only when no pick has a name
             does the field fall back to "N selected". -->
        <span
          v-if="chips.length"
          ref="chipRow"
          class="relative flex min-w-0 flex-1 items-center gap-1 overflow-hidden"
        >
          <span class="sr-only">{{ chipNames }}</span>
          <TransitionGroup
            enter-active-class="animate-[chip-in_var(--duration-fast)_var(--ease-emphasized)] motion-reduce:animate-none"
            leave-active-class="animate-[chip-out_var(--duration-fast)_ease] motion-reduce:animate-none"
          >
            <span
              v-for="(chip, i) in shownChips"
              :key="String(chip.value)"
              aria-hidden="true"
              class="inline-flex max-w-40 min-w-0 items-center gap-1 rounded-pill bg-surface-raised py-0.5 pr-2 text-xs font-medium text-ink"
              :class="[chip.image || chip.icon ? 'pl-0.5' : 'pl-2', i === shownChips.length - 1 ? '' : 'shrink-0']"
            >
              <img v-if="chip.image" :src="chip.image" alt="" class="size-4 shrink-0 rounded-full object-cover" />
              <LpIcon v-else-if="chip.icon" :name="chip.icon" :size="12" class="ml-1 shrink-0 text-muted" />
              <span class="truncate">{{ chip.label }}</span>
            </span>
            <span
              v-if="hiddenCount"
              key="lp-select-more"
              aria-hidden="true"
              class="inline-flex shrink-0 items-center rounded-pill bg-surface-raised px-2 py-0.5 text-xs font-medium text-muted"
            >
              <LpRollingText :value="`+${hiddenCount}`" />
            </span>
          </TransitionGroup>
          <!-- Probe: every chip at its natural width, for the fit above. -->
          <span
            ref="probeRow"
            aria-hidden="true"
            class="pointer-events-none invisible absolute top-0 left-0 flex w-max gap-1"
          >
            <span
              v-for="chip in chips"
              :key="String(chip.value)"
              class="inline-flex max-w-40 items-center gap-1 rounded-pill py-0.5 pr-2 text-xs font-medium"
              :class="chip.image || chip.icon ? 'pl-0.5' : 'pl-2'"
            >
              <span v-if="chip.image" class="size-4 shrink-0" />
              <span v-else-if="chip.icon" class="ml-1 size-3 shrink-0" />
              <span class="truncate">{{ chip.label }}</span>
            </span>
            <span class="inline-flex px-2 py-0.5 text-xs font-medium">+{{ modelList.length }}</span>
          </span>
        </span>
        <template v-else>
          <!-- The pick turns over as one piece: its picture, name and hint
               leave together and the next ones arrive together. Animated
               apart (a fading picture, a rolling name, a cross-faded hint)
               they ran at three speeds, and for a moment the old hint stood
               beside the new one and shoved the row. -->
          <LpRollingText :value="rollKey" align="start" class="min-w-0 flex-1">
            <span class="flex min-w-0 items-center gap-2">
              <img
                v-if="current?.image"
                :src="current.image"
                alt=""
                class="block size-5 shrink-0 rounded-full object-cover"
              />
              <LpIcon v-else-if="current?.icon" :name="current.icon" :size="16" class="block shrink-0 text-muted" />
              <span class="min-w-0 truncate" :class="displayLabel ? '' : 'text-muted'">{{ displayLabel || placeholderText }}</span>
              <span v-if="current?.hint" class="min-w-0 truncate text-muted">{{ current.hint }}</span>
            </span>
          </LpRollingText>
        </template>
      </ComboboxTrigger>
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
          class="transition-transform duration-200 ease-[var(--ease-emphasized)] group-hover:rotate-90 group-active:scale-90 motion-reduce:group-hover:rotate-0"
        />
      </button>
      <!-- A second way in for the pointer only: the main trigger already owns
           focus and the accessible name, so this one stays out of the tab order
           and the accessibility tree. -->
      <ComboboxTrigger
        tabindex="-1"
        aria-hidden="true"
        class="group/trig flex shrink-0 items-center text-muted transition-[rotate,color] duration-200 ease-[var(--ease-emphasized)] group-hover:text-ink data-[state=open]:rotate-180"
      >
        <!-- hover nudge lives on the icon itself so it doesn't fight the
             trigger's open-state rotate (both would write `transform`). Only
             nudge while CLOSED — once open the trigger is rotated 180°, so the
             downward hover shift would invert and jitter against the rotation. -->
        <LpIcon
          name="lucide:chevron-down"
          :size="16"
          class="transition-transform duration-200 ease-[var(--ease-emphasized)] group-data-[state=closed]/trig:group-hover:translate-y-1"
        />
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxPortal :to="portalTo">
      <ComboboxContent
        :data-lp-select-part="partOf"
        @focusout="onFocusOut"
        @interact-outside="guardOutside"
        @escape-key-down="guardOutside"
        position="popper"
        :side-offset="6"
        :class="[POPOVER_PANEL, 'z-(--z-popover) max-h-72 w-(--reka-combobox-trigger-width) overflow-hidden']"
      >
        <div v-if="searchable || serverSide" class="border-b border-line p-2">
          <ComboboxInput
            v-model="query"
            :placeholder="searchPlaceholderText"
            :aria-label="labels.searchLabel"
            class="h-(--size-control-sm) w-full rounded-md border border-line bg-surface-soft px-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-brand"
          />
        </div>

        <ComboboxViewport class="max-h-56 overflow-y-auto p-1">
          <div v-if="loading" class="px-3 py-4 text-center text-sm italic text-muted">
            {{ loadingLabel }}
          </div>
          <ComboboxEmpty v-else class="px-3 py-4 text-center text-sm italic text-muted">
            {{ emptyLabel }}
          </ComboboxEmpty>

          <ComboboxItem
            v-for="(opt, i) in filtered"
            :key="String(opt.value)"
            :value="encode(opt.value)"
            :disabled="opt.disabled"
            :style="optionStagger(i)"
            :class="[OPTION_ITEM, 'justify-between data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50']"
          >
            <OptionContent :option="opt" />
            <ComboboxItemIndicator class="flex shrink-0 items-center text-brand">
              <LpIcon name="lucide:check" :size="16" />
            </ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
