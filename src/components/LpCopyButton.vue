<script lang="ts">
// Attributes (class, aria-*, data-*) reach the button itself, merged by LpButton.
export default { inheritAttrs: false }

export interface CopyButtonLabels extends Record<string, string> {
  copy: string
  copied: string
  failed: string
}

/**
 * What to copy: the text, or a function that produces it when clicked. A
 * `Blob` is copied as itself (an image as PNG, see useClipboard).
 */
export type CopyValue =
  | string
  | number
  | Blob
  | (() => string | number | Blob | Promise<string | number | Blob>)
</script>

<script setup lang="ts">
/*
 * The one copy button: an icon that turns into a tick for a moment, a tip
 * that says "Copy" and then "Copied", and nothing thrown when the clipboard
 * refuses.
 *
 * Several kit components drew their own (the code block's header, the
 * toaster's message copy, the lightbox's image copy), each with its own icon
 * swap that snapped from one glyph to the other. This one cross-fades the two
 * glyphs in place — the copy icon shrinks and turns away as the tick grows in
 * — so the confirmation reads as the button answering, not as a redraw.
 *
 * `value` may be a function, sync or async, for text that is expensive or
 * secret enough to fetch only when someone actually asks for it (a token
 * revealed by the server on demand). While it resolves the button shows its
 * spinner. Note the browser's clipboard wants the write to stay close to the
 * click; a getter that takes seconds may be refused, which surfaces as the
 * `failed` state and the `error` event rather than as an exception.
 */
import { computed, ref, useAttrs } from "vue"
import { useClipboard } from "../composables/useClipboard"
import { useLabels } from "../composables/useLpConfig"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpTooltip from "./LpTooltip.vue"

const props = withDefaults(
  defineProps<{
    /** The text to copy, or a (possibly async) function that returns it on click. */
    value: CopyValue
    /** LpButton's sizes, so it sits in a toolbar of buttons at the same height. */
    size?: "xs" | "sm" | "md" | "lg"
    /**
     * Glyph size in px, for a toolbar whose other icons are drawn at their
     * own size (the lightbox's 18px row). Defaults to what suits `size`.
     */
    iconSize?: number
    /** LpButton's look. `ghost` by default: a copy button is a helper beside something, not a call to action. */
    variant?: "solid" | "action" | "outline" | "soft" | "ghost" | "muted"
    /**
     * Visible text beside the icon. Without it the button is a square icon
     * button and the tip names it.
     */
    label?: string
    /** A toast on success too, for a copy whose button is about to leave the screen (a menu, a closing dialog). */
    toast?: string | false
    /**
     * Show the tick now, for a copy made some other way: a Ctrl+C shortcut on
     * the row, a "Copy" item in its menu. The button then confirms it too, so
     * there is one place that says the clipboard holds this value.
     */
    copied?: boolean
    disabled?: boolean
    /** Where the tip opens. */
    side?: "top" | "right" | "bottom" | "left"
    labels?: Partial<CopyButtonLabels>
  }>(),
  { size: "sm", variant: "ghost", toast: false, side: "top" },
)

const emit = defineEmits<{
  /**
   * The value reached the clipboard: its text, or for a `Blob` an empty
   * string and the blob itself second, so handlers written for text keep
   * their `(text: string)` shape.
   */
  (e: "copied", text: string, blob?: Blob): void
  /** The getter threw or the clipboard refused. */
  (e: "error", error: unknown): void
}>()

const text = useLabels<CopyButtonLabels>(
  "copyButton",
  { copy: "Copy", copied: "Copied", failed: "Couldn't copy" },
  () => props.labels,
)

const { copy, copied: justCopied } = useClipboard()
const busy = ref(false)
const failed = ref(false)
let failTimer: ReturnType<typeof setTimeout> | undefined

const state = computed<"idle" | "copied" | "failed">(() =>
  failed.value ? "failed" : justCopied.value || props.copied ? "copied" : "idle",
)

async function run() {
  if (busy.value || props.disabled) return
  let value: string | Blob
  try {
    let raw = props.value
    if (typeof raw === "function") {
      busy.value = true
      raw = await raw()
    }
    value = raw instanceof Blob ? raw : String(raw)
  } catch (error) {
    busy.value = false
    fail(error)
    return
  }
  busy.value = false
  if (await copy(value, { toast: props.toast })) {
    failed.value = false
    if (value instanceof Blob) emit("copied", "", value)
    else emit("copied", value)
  } else fail(new Error("Clipboard unavailable"))
}

function fail(error: unknown) {
  failed.value = true
  clearTimeout(failTimer)
  failTimer = setTimeout(() => (failed.value = false), 1800)
  emit("error", error)
}

const tip = computed(() =>
  state.value === "copied" ? text.value.copied : state.value === "failed" ? text.value.failed : text.value.copy,
)
const iconSize = computed(() => props.iconSize ?? { xs: 13, sm: 14, md: 16, lg: 16 }[props.size])
const attrs = useAttrs()
</script>

<template>
  <LpTooltip :content="tip" :label="!label" :side="side">
    <LpButton
      v-bind="attrs"
      :variant="variant"
      :size="size"
      :square="!label"
      :disabled="disabled"
      :loading="busy"
      :data-state="state"
      @click="run"
    >
      <span class="relative inline-grid shrink-0 place-items-center" :style="{ width: `${iconSize}px`, height: `${iconSize}px` }">
        <!-- Both glyphs are always there and trade places, so the change is a
             morph in one spot rather than one icon replacing another. -->
        <LpIcon
          name="lucide:copy"
          :size="iconSize"
          class="lp-glyph-swap col-start-1 row-start-1"
          :data-on="state === 'idle' || undefined"
        />
        <LpIcon
          name="lucide:check"
          :size="iconSize"
          class="lp-glyph-swap col-start-1 row-start-1 text-action"
          :data-on="state === 'copied' || undefined"
        />
        <LpIcon
          name="lucide:x"
          :size="iconSize"
          class="lp-glyph-swap col-start-1 row-start-1 text-danger"
          :data-on="state === 'failed' || undefined"
        />
      </span>
      <span v-if="label">{{ label }}</span>
    </LpButton>
  </LpTooltip>
  <!-- The tip only speaks on hover/focus; the result is announced either way. -->
  <span class="sr-only" role="status" aria-live="polite">{{ state === "idle" ? "" : tip }}</span>
</template>

