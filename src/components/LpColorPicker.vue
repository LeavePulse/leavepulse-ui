<script setup lang="ts">
/*
 * Colour picker — a trigger showing the current colour, and a popover holding a
 * saturation/value field, a hue rail, an optional alpha rail, a hex field and a
 * row of presets.
 *
 * The model is a CSS COLOUR STRING, not an object: `v-model="#3b82f6"` is what a
 * caller stores, sends to an API and drops straight into a style binding. HSV
 * lives inside the component only, because a colour that round-trips through
 * hex on every drag loses the hue of a black or a white — drag the value down to
 * zero and everything becomes #000000, and dragging back up would come back red
 * instead of the blue you started on. Keeping HSV as the source of truth means
 * the rails stay where you left them.
 *
 * `format` picks the shape emitted back ("hex" | "rgb" | "hsl"); input is parsed
 * from any of the three regardless, so switching the format never orphans a
 * value already saved.
 *
 * Dragging is pointer-capture based, the same as LpMapPicker: the pointer keeps
 * feeding the field it started on even when it leaves the element, so a drag
 * past the edge pins to the edge instead of stopping dead. Both the field and
 * the rails are arrow-key operable, since a picker that only answers the mouse
 * is one nobody can use from the keyboard.
 *
 * Right-clicking either the trigger or the panel copies the colour as hex, rgb
 * or hsl, switches which of the three the picker shows, or pastes one in —
 * taking a value somewhere else is most of what a colour swatch is for, and
 * reading it off the screen by hand is how a hex ends up mistyped. `recent`
 * keeps the colours settled on in browser storage and offers them back above
 * the presets.
 */
import {
  PopoverAnchor,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from "reka-ui"
import { computed, ref, watch } from "vue"
import {
  clampHsv,
  DEFAULT_SWATCHES,
  formatColor,
  type ColorFormat,
  type Hsv,
  isLight,
  opaqueCss,
  parseColor,
  rgbToHsv,
} from "./color"
import { useClipboard } from "../composables/useClipboard"
import { POPOVER_PANEL } from "./dropdown"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"

/**
 * Every user-facing string the picker renders on its own — the menu items, the
 * "Recent" heading, and the accessible names the area, rails and text field
 * carry. Apps with i18n pass their translations in; the English defaults keep
 * the component usable bare. Without this an app in another language would
 * still announce "Saturation and brightness" to a screen reader.
 */
export interface ColorPickerLabels {
  saturation?: string
  hue?: string
  opacity?: string
  value?: string
  recent?: string
  copyHex?: string
  copyRgb?: string
  copyHsl?: string
  paste?: string
  /** Submenu title for the "show the value as…" format switch. */
  formatAs?: string
  format_hex?: string
  format_rgb?: string
  format_hsl?: string
  /** Read out as the area's value, with {s} and {v} as whole percentages. */
  saturationValueText?: string
}

const props = withDefaults(
  defineProps<{
    /** The colour as a CSS string (v-model). Hex, rgb()/rgba() or hsl()/hsla(). */
    modelValue?: string
    /** Shape of the emitted string. Parsing accepts all three either way. */
    format?: ColorFormat
    /** Show the alpha rail and emit a colour carrying its alpha. */
    alpha?: boolean
    /** Preset colours under the rails. Pass [] to drop the row entirely. */
    swatches?: readonly string[]
    /** Hide the hex/CSS text field (leaves the field, rails and presets). */
    hideInput?: boolean
    disabled?: boolean
    invalid?: boolean
    size?: "sm" | "md" | "lg"
    /** Trigger text beside the swatch. Defaults to the colour's own value. */
    label?: string
    /** Accessible name for the trigger when it carries no visible text. */
    ariaLabel?: string
    /** Popover side, as LpPopover. */
    side?: "top" | "right" | "bottom" | "left"
    align?: "start" | "center" | "end"
    /**
     * Right-click menu on the trigger. Copy-as-hex/rgb/hsl and paste are built
     * in — the thing a person actually wants from a colour swatch is to take
     * the value somewhere else, and reading it off the trigger by hand is how
     * a hex ends up mistyped. These come first; `menuItems` is appended below a
     * separator. Pass `menu="none"` to drop the built-ins and keep only yours.
     */
    menu?: "default" | "none"
    /** Extra right-click items, appended after the built-in ones. */
    menuItems?: ContextMenuItemDef[]
    /**
     * Remember the colours picked here and offer them back as a "Recent" row.
     * A person who tints one tag reaches for the same colour on the next one,
     * and the presets cannot know it. Off by default: history is a per-person
     * convenience, and a component that wrote to storage uninvited would be a
     * surprise in a form that is meant to be stateless.
     */
    recent?: boolean
    /**
     * Storage key for that history, so two pickers can share a list or keep
     * separate ones (e.g. "lp.color.tag" vs "lp.color.calendar").
     */
    recentKey?: string
    /** How many recent colours to keep. */
    recentLimit?: number
    /** Translations for the strings the picker renders itself. */
    labels?: ColorPickerLabels
    /**
     * Toast raised after a successful copy, with `{value}` standing in for the
     * colour. `false` copies silently — for a page that already confirms it, or
     * one where a toast per copy would be noise. Translate it via `labels`
     * rather than here if the rest of your strings go through i18n.
     */
    copyToast?: string | false
  }>(),
  {
    modelValue: "#3b82f6",
    format: "hex",
    alpha: false,
    swatches: () => DEFAULT_SWATCHES,
    size: "md",
    side: "bottom",
    align: "start",
    recent: false,
    recentKey: "lp.color.recent",
    recentLimit: 8,
    copyToast: "Copied {value}",
  },
)

const emit = defineEmits<{
  // Fires live while dragging.
  (e: "update:modelValue", value: string): void
  // Fires once on release, mirroring LpSlider — for commit-vs-preview splits
  // where every intermediate colour would mean a write or a network call.
  (e: "change", value: string): void
}>()

/** Fill `{s}` / `{v}` in a label template. */
function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""))
}

// Single lookup for every label, so the template never repeats the fallbacks.
const l = computed(() => ({
  saturation: props.labels?.saturation ?? "Saturation and brightness",
  hue: props.labels?.hue ?? "Hue",
  opacity: props.labels?.opacity ?? "Opacity",
  value: props.labels?.value ?? "Colour value",
  recent: props.labels?.recent ?? "Recent",
  copyHex: props.labels?.copyHex ?? "Copy hex",
  copyRgb: props.labels?.copyRgb ?? "Copy rgb",
  copyHsl: props.labels?.copyHsl ?? "Copy hsl",
  paste: props.labels?.paste ?? "Paste colour",
  formatAs: props.labels?.formatAs ?? "Show as",
  format_hex: props.labels?.format_hex ?? "HEX",
  format_rgb: props.labels?.format_rgb ?? "RGB",
  format_hsl: props.labels?.format_hsl ?? "HSL",
  saturationValueText:
    props.labels?.saturationValueText ?? "saturation {s}%, brightness {v}%",
}))

const { copy } = useClipboard()

const open = ref(false)

// HSV is the source of truth while the popover is in use; see the note above.
const hsv = ref<Hsv>({ h: 217, s: 0.76, v: 0.96, a: 1 })

function adopt(value: string | undefined) {
  const rgb = parseColor(value ?? "")
  if (!rgb) return
  const next = rgbToHsv(rgb)
  // A grey has no hue of its own, and a black no saturation — taking the zeroes
  // the conversion reports would swing the rails every time the value passes
  // through one. Keep what the user last aimed at instead.
  if (next.s === 0) next.h = hsv.value.h
  if (next.v === 0) next.s = hsv.value.s
  hsv.value = next
}

adopt(props.modelValue)

// Only adopt an OUTSIDE change: our own emit comes back through modelValue, and
// re-deriving HSV from it is exactly the round-trip this component avoids.
watch(
  () => props.modelValue,
  (v) => {
    if (v !== current.value) adopt(v)
  },
)

/**
 * The format the picker emits and shows in its text field. Seeded from the
 * `format` prop and switchable from the right-click menu, because which shape
 * you want is a property of the moment — the stored value is hex, the thing you
 * are pasting into a stylesheet wants rgb — not of how the component was
 * configured months ago. A caller that changes the prop still wins: that is an
 * explicit instruction, unlike a menu pick made for one paste.
 */
const activeFormat = ref<ColorFormat>(props.format)
watch(() => props.format, (f) => (activeFormat.value = f))

const current = computed(() =>
  formatColor(props.alpha ? hsv.value : { ...hsv.value, a: 1 }, activeFormat.value),
)

function set(patch: Partial<Hsv>, commit = false) {
  if (props.disabled) return
  hsv.value = clampHsv({ ...hsv.value, ...patch })
  emit("update:modelValue", current.value)
  if (commit) emit("change", current.value)
}

/* ── pointer drag ─────────────────────────────────
   One handler for the field and both rails: each reports the pointer as a 0..1
   fraction of the box it was pressed in, and the caller maps that to its own
   axis. */
function trackPointer(e: PointerEvent, onMove: (x: number, y: number) => void) {
  if (props.disabled) return
  // Only the primary button drags; a right-click belongs to the context menu.
  if (e.button !== 0) return
  // A pointerdown that isn't cancelled still starts a native text selection, so
  // dragging across the field swept a highlight over the whole page behind it.
  e.preventDefault()
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const at = (ev: PointerEvent) => {
    const x = rect.width === 0 ? 0 : (ev.clientX - rect.left) / rect.width
    const y = rect.height === 0 ? 0 : (ev.clientY - rect.top) / rect.height
    onMove(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)))
  }

  el.setPointerCapture(e.pointerId)
  at(e)

  const move = (ev: PointerEvent) => at(ev)
  const up = () => {
    el.removeEventListener("pointermove", move)
    el.removeEventListener("pointerup", up)
    el.removeEventListener("pointercancel", up)
    emit("change", current.value)
  }
  el.addEventListener("pointermove", move)
  el.addEventListener("pointerup", up)
  el.addEventListener("pointercancel", up)
}

const onFieldPointer = (e: PointerEvent) =>
  trackPointer(e, (x, y) => set({ s: x, v: 1 - y }))
const onHuePointer = (e: PointerEvent) => trackPointer(e, (x) => set({ h: x * 360 }))
const onAlphaPointer = (e: PointerEvent) => trackPointer(e, (x) => set({ a: x }))

/* ── keyboard ─────────────────────────────────────
   Arrows step, shift-arrows step ten times as far, Home/End jump to the ends —
   the same grammar as a slider, so the field behaves like the rails do. */
function step(e: KeyboardEvent, axis: "sv" | "h" | "a") {
  const big = e.shiftKey
  const k = e.key
  const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]
  if (!arrows.includes(k)) return
  e.preventDefault()

  const dx = (k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0) * (big ? 10 : 1)
  const dy = (k === "ArrowUp" ? 1 : k === "ArrowDown" ? -1 : 0) * (big ? 10 : 1)

  if (axis === "h") {
    if (k === "Home") return set({ h: 0 }, true)
    if (k === "End") return set({ h: 359 }, true)
    return set({ h: hsv.value.h + (dx || dy) }, true)
  }
  if (axis === "a") {
    if (k === "Home") return set({ a: 0 }, true)
    if (k === "End") return set({ a: 1 }, true)
    return set({ a: hsv.value.a + (dx || dy) / 100 }, true)
  }
  if (k === "Home") return set({ s: 0 }, true)
  if (k === "End") return set({ s: 1 }, true)
  set({ s: hsv.value.s + dx / 100, v: hsv.value.v + dy / 100 }, true)
}

/* ── text field ───────────────────────────────────
   Typed text is parsed on every keystroke but only applied when it resolves to
   a real colour, so a half-written "#3b8" never snaps the picker somewhere the
   user is still on their way past. The field shows what is typed while it has
   focus and the committed value once it doesn't. */
const typed = ref<string | null>(null)
const inputValue = computed(() => typed.value ?? current.value)

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  typed.value = value
  const rgb = parseColor(value)
  if (!rgb) return
  const next = rgbToHsv(rgb)
  if (next.s === 0) next.h = hsv.value.h
  if (next.v === 0) next.s = hsv.value.s
  set(props.alpha ? next : { ...next, a: 1 }, true)
}

function onInputBlur() {
  typed.value = null
}

function pickSwatch(value: string) {
  const rgb = parseColor(value)
  if (!rgb) return
  typed.value = null
  set(rgbToHsv(rgb), true)
}

function isActiveSwatch(value: string) {
  const rgb = parseColor(value)
  return !!rgb && formatColor(rgbToHsv(rgb), "hex") === formatColor({ ...hsv.value, a: 1 }, "hex")
}

/**
 * Ink for the tick on a selected swatch: dark on a pale colour, light on a deep
 * one. Unparseable falls back to the light tick, which is the safe end — the
 * swatch is showing nothing in that case anyway.
 */
function tickClass(value: string) {
  const rgb = parseColor(value)
  return rgb && isLight(rgbToHsv(rgb)) ? "text-black" : "text-white"
}

const triggerSize = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
  lg: "h-(--size-control-lg) text-sm",
}

// The colour the swatch/preview paints, alpha included so a translucent pick
// reads as translucent against the checkerboard behind it.
const previewCss = computed(() => formatColor(props.alpha ? hsv.value : { ...hsv.value, a: 1 }, "rgb"))
const hueCss = computed(() => `hsl(${Math.round(hsv.value.h)}, 100%, 50%)`)
// The alpha ramp's see-through end: this colour at zero alpha, so the fade stays
// on its own hue instead of sliding through grey on the way out.
const alphaRampStart = computed(() => formatColor({ ...hsv.value, a: 0 }, "rgb"))
/**
 * The square's backdrop is the PURE HUE — full saturation, full value — not the
 * current colour. The whole point of the area is to show every s/v combination
 * of one hue at once, so it may only ever change when the hue rail moves. Using
 * the live colour here made the backdrop follow the marker: dragging toward
 * black darkened the entire square under it, which is the picker redrawing the
 * very thing you are choosing from.
 */
const fieldCss = computed(() => opaqueCss({ ...hsv.value, s: 1, v: 1 }))

/**
 * The saturation/value square as ONE background on ONE element: white across,
 * black up, hue underneath, in a single `background` shorthand.
 *
 * They used to be three things — the hue as the element's background-color and
 * the two ramps as absolutely-positioned children clipped by the parent's
 * radius. A rounded clip is antialiased, so the pixels along each corner's arc
 * got only partial coverage of those children, and what showed through the rest
 * of the way was the RAW HUE sitting behind them. At the bottom of the square,
 * where the composited colour is near-black, a leak of rgb(59,130,246) is a
 * bright fringe tracing both bottom corners — visible at 100%, obvious zoomed.
 *
 * Painting all three as layers of one background means the corner clips a
 * finished image: a partially covered pixel fades toward transparent, which is
 * the panel behind it, instead of toward a colour that should never be on show.
 */
const fieldStyle = computed(() => ({
  background: [
    "linear-gradient(to top, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0))",
    "linear-gradient(to right, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0))",
    fieldCss.value,
  ].join(", "),
}))

/* The alpha checkerboard, inline so it needs no stylesheet entry and no asset:
   a repeating conic gradient is the standard trick for it.

   Whatever paints this must let the colour reach the very edge. A border is
   drawn OVER the element's own background, and every line colour in the kit is
   a translucent white (--color-line is rgba(…,0.1)), so a bordered swatch let
   the checkerboard show through its frame — a see-through outline around
   colours that were perfectly opaque. The swatches carry an inset RING over the
   colour instead.

   The saturation area and the hue rail carry no resting line at all: they are
   saturated edge to edge and need no help separating from the panel, and a
   translucent white hairline over their near-black corner read as a bright arc
   tracing the radius — the "glow" in the corner of the area. Only the focus
   ring draws on them, and only while they have focus. */
const CHECKERBOARD =
  "repeating-conic-gradient(var(--color-line-strong) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px"

/* ── recent colours ───────────────────────────────
   Persisted per `recentKey`, newest first, de-duplicated by hex so the same
   colour picked twice moves to the front instead of filling the row. Every
   storage access is allowed to fail the way useFormDraft's does: a private
   window or a storage policy must not take the picker down with it. */
function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage
  } catch {
    return null
  }
}

function readRecent(): string[] {
  const s = storage()
  if (!s) return []
  try {
    const raw = JSON.parse(s.getItem(props.recentKey) ?? "[]")
    // Whatever is in storage came from outside this run — a stale shape, or
    // another app on the same origin. Take only strings that still parse.
    return Array.isArray(raw)
      ? raw.filter((v): v is string => typeof v === "string" && !!parseColor(v)).slice(0, props.recentLimit)
      : []
  } catch {
    return []
  }
}

const recentColors = ref<string[]>(props.recent ? readRecent() : [])

// A history is only worth keeping once a colour is SETTLED on: recording every
// intermediate value of a drag would fill the row with the sweep rather than
// the choice. So this is called from the commit paths, never from `set`.
function remember(value: string) {
  if (!props.recent) return
  const key = formatColor({ ...hsv.value, a: 1 }, "hex")
  const without = recentColors.value.filter(
    (c) => formatColor(rgbToHsv(parseColor(c) ?? { r: 0, g: 0, b: 0, a: 1 }), "hex") !== key,
  )
  recentColors.value = [value, ...without].slice(0, props.recentLimit)
  try {
    storage()?.setItem(props.recentKey, JSON.stringify(recentColors.value))
  } catch {
    // Quota, or storage turned off mid-session. The row still works in memory.
  }
}

// Remember on close rather than on every commit: the colour a person leaves the
// popover on is the one they chose, while the ones they passed through on the
// way are not history, they are the search for it.
watch(open, (isOpen, was) => {
  if (was && !isOpen) remember(current.value)
})

/**
 * The swatch rows, in the order they appear. One description each, so the two
 * rows cannot drift apart in the markup the way two copies of it would.
 * Recent is slightly smaller and packs eight to a line: it is an aid, and the
 * presets stay the row the layout is built around.
 */
const swatchRows = computed(() =>
  [
    {
      key: "recent",
      heading: l.value.recent,
      colors: props.recent ? recentColors.value : [],
      cols: "grid-cols-8",
      size: "size-6",
    },
    {
      key: "presets",
      heading: "",
      colors: [...props.swatches],
      cols: "grid-cols-6",
      size: "size-7",
    },
  ].filter((r) => r.colors.length),
)

/**
 * reka focuses the first focusable thing in the panel when it opens, which is
 * the saturation area — and a focus ring is a bright 2px arc traced around a
 * near-black corner, so opening the picker with the mouse lit up an edge nobody
 * asked for. The panel takes the focus instead: keyboard users still Tab
 * straight into the area from there, and the ring appears when it is earned.
 */
function onPanelOpen(e: Event) {
  e.preventDefault()
  ;(e.currentTarget as HTMLElement | null)?.focus?.({ preventScroll: true })
}

/* ── right-click menu ─────────────────────────────
   Copy writes the colour in a named format regardless of which one `format`
   emits: the value you need in a stylesheet is often not the one the app
   stores. Paste reads the clipboard and takes it only if it parses, so a
   right-click on a clipboard holding something else leaves the colour alone. */
function copyAs(fmt: ColorFormat) {
  const text = formatColor(props.alpha ? hsv.value : { ...hsv.value, a: 1 }, fmt)
  // The toast quotes the value: a menu item that closes the moment it is picked
  // leaves nothing on screen to confirm WHICH colour went to the clipboard, and
  // the one thing worth checking is that it was the colour you meant.
  const toast = props.copyToast
  void copy(text, { toast: toast === false ? false : fill(toast, { value: text }) })
}

async function pasteColor() {
  try {
    const text = await navigator.clipboard.readText()
    const rgb = parseColor(text)
    if (!rgb) return
    typed.value = null
    const next = rgbToHsv(rgb)
    set(props.alpha ? next : { ...next, a: 1 }, true)
  } catch {
    // Reading needs a permission the user may not have granted. Same reasoning.
  }
}

/**
 * Switching the format re-emits the SAME colour in the new shape, so a caller
 * bound with v-model ends up holding what the field now shows. Without the
 * emit the picker would display rgb() while the app still stored hex, and the
 * next thing to read that value would disagree with the screen.
 */
function setFormat(f: ColorFormat) {
  if (activeFormat.value === f) return
  activeFormat.value = f
  typed.value = null
  emit("update:modelValue", current.value)
  emit("change", current.value)
}

const menuItems = computed<ContextMenuItemDef[]>(() => {
  const own = props.menuItems ?? []
  if (props.menu === "none") return own

  const builtin: ContextMenuItemDef[] = [
    { label: l.value.copyHex, icon: "lucide:copy", onSelect: () => copyAs("hex") },
    { label: l.value.copyRgb, icon: "lucide:copy", onSelect: () => copyAs("rgb") },
    { label: l.value.copyHsl, icon: "lucide:copy", onSelect: () => copyAs("hsl") },
    { label: l.value.paste, icon: "lucide:clipboard", onSelect: pasteColor },
    {
      // Ticks rather than a plain list: this is a setting with a current value,
      // and the menu should say which one is on without being opened twice.
      label: l.value.formatAs,
      icon: "lucide:code",
      separatorBefore: true,
      children: (["hex", "rgb", "hsl"] as const).map((f) => ({
        label: l.value[`format_${f}` as const],
        checked: activeFormat.value === f,
        onSelect: () => setFormat(f),
      })),
    },
  ]
  // The consumer's own items are clearly theirs, below a rule.
  return own.length
    ? [...builtin, { ...own[0], separatorBefore: true }, ...own.slice(1)]
    : builtin
})

defineExpose({ open })
</script>

<template>
  <PopoverRoot v-model:open="open">
    <!-- reka supports chaining `as-child` triggers onto one element, but only
         when each link forwards the props down — and LpContextMenu is a wrapper
         with a slot, so the chain breaks at it: the popover ended up measuring
         the menu wrapper rather than the button and put the panel 600px off
         screen. PopoverAnchor is reka's own answer to this. It names what the
         panel positions against, so the button is free to be the context
         menu's trigger and the popover's trigger both. LpContextMenu renders
         just its slot when `items` is empty, so `menu="none"` with no items of
         your own leaves the native browser menu in place. -->
    <PopoverAnchor class="block w-full">
      <LpContextMenu :items="menuItems">
      <PopoverTrigger as-child>
        <button
          type="button"
          :disabled="disabled"
          :aria-label="ariaLabel"
          class="group inline-flex w-full items-center gap-2 rounded-control border bg-surface-soft px-2 text-left text-ink outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-brand disabled:cursor-not-allowed disabled:opacity-55"
          :class="[
            triggerSize[size],
            invalid ? 'border-danger focus-visible:ring-danger-soft' : 'border-line focus-visible:border-brand',
          ]"
        >
          <!-- The swatch sits on the checkerboard so a transparent colour looks
               transparent rather than like the panel behind it. One radius on
               the outer box with `overflow-hidden`, the colour filling it edge
               to edge, and the hairline as an inset ring ON TOP — a real border
               would be painted over the checkerboard and, being translucent
               white, would show it through as a see-through outline. -->
          <span
            class="relative size-5 shrink-0 overflow-hidden rounded-md"
            :style="{ background: CHECKERBOARD }"
          >
            <span class="block size-full" :style="{ backgroundColor: previewCss }" />
            <span class="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-line" />
          </span>
          <span class="min-w-0 flex-1 truncate font-mono text-xs text-muted-strong">
            {{ label ?? current }}
          </span>
          <LpIcon
            name="lucide:chevron-down"
            :size="15"
            class="shrink-0 text-muted transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-data-[state=open]:rotate-180"
          />
        </button>
      </PopoverTrigger>
      </LpContextMenu>
    </PopoverAnchor>

    <PopoverPortal>
      <PopoverContent
        :side="side"
        :align="align"
        :side-offset="6"
        :class="[POPOVER_PANEL, 'z-(--z-popover) w-64 select-none rounded-card p-3 outline-none']"
        @open-auto-focus="onPanelOpen"
      >
        <!-- The same menu inside the panel: copy/paste is wanted most while
             you are actually choosing, and right-clicking the area you are
             working in should not fall through to the browser's menu. -->
        <LpContextMenu :items="menuItems">
          <div class="flex flex-col gap-3">
            <!-- Saturation (x) × value (y), over the flat hue — all three as
                 one background; see fieldStyle for why it is not layered. -->
            <div
              role="slider"
              :tabindex="disabled ? -1 : 0"
              :aria-label="l.saturation"
              :aria-valuetext="fill(l.saturationValueText, { s: Math.round(hsv.s * 100), v: Math.round(hsv.v * 100) })"
              class="relative h-36 w-full cursor-crosshair touch-none overflow-hidden rounded-control outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              :style="fieldStyle"
              @pointerdown="onFieldPointer"
              @keydown="step($event, 'sv')"
            >
              <span
                class="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-pill border-2 border-white shadow ring-1 ring-black/30"
                :style="{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  backgroundColor: previewCss,
                }"
              />
            </div>

            <!-- Hue rail. -->
            <div
              role="slider"
              :aria-label="l.hue"
              :aria-valuemin="0"
              :aria-valuemax="360"
              :aria-valuenow="Math.round(hsv.h)"
              :tabindex="disabled ? -1 : 0"
              class="relative h-3 w-full cursor-pointer touch-none rounded-pill outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              style="background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
              @pointerdown="onHuePointer"
              @keydown="step($event, 'h')"
            >
              <span
                class="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-pill border-2 border-white shadow ring-1 ring-black/30"
                :style="{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueCss }"
              />
            </div>

            <!-- Alpha rail — opaque-to-transparent of the current hue, on the
                 checkerboard so the far end reads as see-through. -->
            <div
              v-if="alpha"
              role="slider"
              :aria-label="l.opacity"
              :aria-valuemin="0"
              :aria-valuemax="100"
              :aria-valuenow="Math.round(hsv.a * 100)"
              :tabindex="disabled ? -1 : 0"
              class="relative h-3 w-full cursor-pointer touch-none rounded-pill outline-none ring-1 ring-inset ring-line focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              :style="{ background: CHECKERBOARD }"
              @pointerdown="onAlphaPointer"
              @keydown="step($event, 'a')"
            >
              <!-- Fades from the colour at zero alpha to the colour at full, NOT
                   from `transparent`: that keyword is transparent black, which
                   dirtied the see-through end with grey instead of letting the
                   checkerboard show through cleanly. -->
              <div
                class="absolute inset-0 overflow-hidden rounded-pill"
                :style="{ backgroundImage: `linear-gradient(to right, ${alphaRampStart}, ${opaqueCss(hsv)})` }"
              />
              <span
                class="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-pill border-2 border-white shadow ring-1 ring-black/30"
                :style="{ left: `${hsv.a * 100}%`, backgroundColor: previewCss }"
              />
            </div>

            <!-- Text field: type or paste a colour, or copy the one on screen. -->
            <div
              v-if="!hideInput"
              data-lp-ring-owner
              class="flex h-(--size-control-sm) items-center gap-2 overflow-hidden rounded-control border border-line bg-surface-soft px-2 transition-colors duration-[var(--duration-fast)] focus-within:border-brand focus-within:ring-2 focus-within:ring-ring"
            >
              <span
                class="size-4 shrink-0 rounded-[5px] border border-line"
                :style="{ backgroundColor: previewCss }"
              />
              <input
                :value="inputValue"
                :disabled="disabled"
                spellcheck="false"
                autocapitalize="off"
                autocomplete="off"
                :aria-label="l.value"
                class="min-w-0 flex-1 select-text bg-transparent font-mono text-xs text-ink outline-none placeholder:text-muted"
                @input="onInput"
                @blur="onInputBlur"
              />
            </div>

            <!-- Recent sits ABOVE the presets because it is the row that
                 changes: what you reached for last time is a better guess than
                 a fixed palette, so the eye should land on it first. Both rows
                 are the same markup — one swatch button, described by `rows`. -->
            <div v-for="row in swatchRows" :key="row.key" class="flex flex-col gap-1.5">
              <span
                v-if="row.heading"
                class="text-[11px] font-medium uppercase tracking-wide text-muted"
              >
                {{ row.heading }}
              </span>
              <div class="grid gap-1.5" :class="row.cols">
                <button
                  v-for="c in row.colors"
                  :key="c"
                  type="button"
                  :disabled="disabled"
                  :aria-label="c"
                  :aria-pressed="isActiveSwatch(c)"
                  class="relative flex items-center justify-center overflow-hidden rounded-md outline-none transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed motion-reduce:hover:scale-100 motion-reduce:active:scale-95"
                  :class="row.size"
                  :style="{ background: CHECKERBOARD }"
                  @click="pickSwatch(c)"
                >
                  <!-- On the checkerboard in both rows: a preset is opaque and
                       simply covers it, while a remembered colour may not be.
                       The colour fills the whole button — no border to leave a
                       1px moat of checkerboard around it — and the frame is an
                       inset ring painted OVER the colour instead, so it reads
                       as one fixed hairline rather than a translucent gap. -->
                  <span class="absolute inset-0" :style="{ backgroundColor: c }" />
                  <span class="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-line" />
                  <LpIcon
                    v-if="isActiveSwatch(c)"
                    name="lucide:check"
                    :size="13"
                    class="relative"
                    :class="tickClass(c)"
                  />
                </button>
              </div>
            </div>

            <slot :color="current" :hsv="hsv" />
          </div>
        </LpContextMenu>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
