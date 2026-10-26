<script lang="ts">
// The consumer's `class` is merged into the root's own rather than appended,
// so `class="h-12"` or `class="px-6"` beats the size's defaults.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { usePaletteAction, type PaletteControlOptions } from "../composables/usePaletteCommands"
import { tv, type VariantProps } from "tailwind-variants"
import { computed, getCurrentInstance, onMounted, onUpdated, ref, useAttrs, type Component, type ComponentPublicInstance } from "vue"
import { HINT_SIGNALS, noteHotkeyTarget } from "../composables/useHintSystem"
import { hints } from "../composables/useHints"
import { appleModifierLabel, parseCombo, useAppleKeyboard, useHotkeys } from "../composables/useHotkeys"
import { useLabels, useLinkComponent } from "../composables/useLpConfig"
import { useToast } from "../composables/useToast"
import { useMergedAttrs } from "../composables/useMergedClass"
import LpLoader from "./LpLoader.vue"
import { resolveLink, type LinkTarget } from "./link"

const button = tv({
  base: [
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold",
    "rounded-control transition-[color,background-color,border-color,box-shadow,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)]",
    // tactile press: dips slightly on click, springs back on release.
    "active:scale-[0.97] motion-reduce:active:scale-100",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55",
  ],
  variants: {
    variant: {
      solid: "bg-brand text-ink-inverse hover:bg-brand-hover",
      action:
        "bg-action text-ink-inverse shadow-[0_14px_28px_color-mix(in_srgb,var(--color-action)_24%,transparent)] hover:bg-action-hover",
      outline: "border border-line-strong text-ink hover:border-brand hover:bg-ink/[0.04]",
      // raised surface tile with a border — a visible, neutral filled button
      soft: "border border-line bg-surface-raised/80 text-ink hover:border-line-strong hover:bg-surface-soft",
      ghost: "text-ink hover:bg-ink/[0.06]",
      muted: "text-muted hover:bg-ink/[0.04] hover:text-ink",
      // high-contrast light fill (e.g. a "download" CTA on a dark hero). The
      // text is a fixed dark tone: `ink-inverse` is light in light themes,
      // which made this white on white there.
      light: "border border-black/10 bg-white text-[#0b1210] hover:bg-white/90",
      danger: "bg-danger text-ink-inverse hover:bg-danger-hover",
    },
    size: {
      xs: "h-8 px-2.5 text-xs",
      sm: "h-(--size-control-sm) px-3 text-xs",
      md: "h-(--size-control-md) px-4 text-sm",
      lg: "h-(--size-control-lg) px-5 text-sm",
    },
    block: { true: "w-full" },
    // icon-only square button — equal sides, no horizontal padding
    square: { true: "aspect-square p-0" },
    // soft elevation glow keyed to the variant's colour
    glow: { true: "" },
    // busy: the label fades out in place (no width jump) and a spinner sits on top
    loading: { true: "relative cursor-progress !text-transparent hover:!text-transparent" },
  },
  compoundVariants: [
    { square: true, size: "xs", class: "size-8" },
    { square: true, size: "sm", class: "size-(--size-control-sm)" },
    { square: true, size: "md", class: "size-(--size-control-md)" },
    { square: true, size: "lg", class: "size-(--size-control-lg)" },
    {
      glow: true,
      variant: "solid",
      class:
        "shadow-[0_8px_22px_color-mix(in_srgb,var(--color-brand)_28%,transparent)] hover:shadow-[0_12px_28px_color-mix(in_srgb,var(--color-brand)_36%,transparent)]",
    },
    {
      glow: true,
      variant: "danger",
      class:
        "shadow-[0_8px_22px_color-mix(in_srgb,var(--color-danger)_28%,transparent)] hover:shadow-[0_12px_28px_color-mix(in_srgb,var(--color-danger)_36%,transparent)]",
    },
    {
      glow: true,
      variant: "light",
      class:
        "shadow-[0_8px_18px_color-mix(in_srgb,var(--color-ink)_20%,transparent)] hover:shadow-[0_12px_24px_color-mix(in_srgb,var(--color-ink)_30%,transparent)]",
    },
  ],
  defaultVariants: { variant: "solid", size: "md" },
})

type ButtonVariants = VariantProps<typeof button>

const props = withDefaults(
  defineProps<{
    palette?: PaletteControlOptions
    variant?: ButtonVariants["variant"]
    size?: ButtonVariants["size"]
    block?: boolean
    square?: boolean
    glow?: boolean
    /**
     * Root element/component. Defaults to a native <button>, or a link when
     * `to`/`href` is set (the link component from provideLpConfig for internal
     * targets). Pass a component or "a" to override.
     */
    as?: string | Component
    /** Router destination: renders the configured link component. */
    to?: LinkTarget
    /** Link URL: renders an anchor (or the link component for internal paths). */
    href?: string
    type?: "button" | "submit" | "reset"
    disabled?: boolean
    /**
     * Busy state: blocks clicks like `disabled` without dimming, fades the label out
     * in place and shows a spinner over it, so the width never jumps. Sets `aria-busy`.
     */
    loading?: boolean
    /**
     * Work the click starts. While it runs the button shows `loading` and
     * ignores further clicks; a failure is reported as an error toast with
     * the error's details, unless the app listens to `error` itself. The
     * state the work was for (a form, a switch) is the app's to roll back.
     */
    action?: () => unknown
    /**
     * A key that presses the button: "Ctrl+S", "Shift+N", "F2". It works
     * wherever the button is on screen and not covered by a dialog, appears
     * in the key reference (F1) and the tooltip, and counts toward
     * `hotkeyTip()` for people who keep clicking instead.
     */
    hotkey?: string
    /** The key reference's section for `hotkey`. */
    hotkeyGroup?: string
    labels?: Partial<{ group: string }>
  }>(),
  { palette: undefined, type: "button" },
)

const emit = defineEmits<{
  /** The `action` finished. */
  (e: "done", value: unknown): void
  /** The `action` failed. Listening turns the kit's own error toast off. */
  (e: "error", error: unknown): void
}>()

const labels = useLabels("button", { group: "Actions" }, () => props.labels)
const toast = useToast()
const attrs = useAttrs()
const instance = getCurrentInstance()

const running = ref(false)
const busy = computed(() => props.loading || running.value)

async function runAction() {
  if (!props.action || busy.value || props.disabled) return
  running.value = true
  try {
    emit("done", await props.action())
  } catch (error) {
    // A listener on `error` means the app reports it its own way.
    if (instance?.vnode.props?.onError) emit("error", error)
    else toast.error(error instanceof Error ? error : String(error))
  } finally {
    running.value = false
  }
}

/*
 * The hotkey presses the real element, so whatever the app hung on the click
 * (a router link, a form submit, an `@click`) runs exactly as a click would.
 */
const root = ref<HTMLElement | ComponentPublicInstance | null>(null)
const rootEl = (): HTMLElement | null => {
  const node = root.value
  if (node instanceof HTMLElement) return node
  return node?.$el instanceof HTMLElement ? node.$el : null
}
let viaKey = false

// What the button says, for the key reference and the tooltip. Read from the
// DOM after render: the slot may be an icon with text beside it, or a label
// that changes ("Save" → "Saved").
const spoken = ref("")
function readSpoken() {
  const el = rootEl()
  spoken.value = String(attrs["aria-label"] ?? (el ? labelText(el).trim() : ""))
}

// The button's words without any loader in it (its own busy overlay, or one an
// app put in the slot): a loader carries a screen-reader "Loading…" that would
// otherwise end up in the key reference as part of the button's name.
function labelText(node: Node): string {
  if (node instanceof Element && node.getAttribute("role") === "status") return ""
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ""
  return Array.from(node.childNodes, labelText).join("")
}
onMounted(readSpoken)
onUpdated(readSpoken)

useHotkeys(() => {
  if (!props.hotkey || props.disabled) return []
  const label = spoken.value || props.hotkey
  return [
    {
      ...parseCombo(props.hotkey),
      help: { group: props.hotkeyGroup ?? labels.value.group, label, combo: props.hotkey },
      handler: () => {
        const el = rootEl()
        if (!el || busy.value) return false
        viaKey = true
        el.click()
        viaKey = false
      },
    },
  ]
})

const apple = useAppleKeyboard()
const shownCombo = computed(() =>
  props.hotkey
    ?.split("+")
    .map((key) => appleModifierLabel(key.trim(), apple.value))
    .join(apple.value ? "" : "+"),
)
// Said by the tooltip unless the app wrote its own title.
const hotkeyTitle = computed(() => {
  if (!props.hotkey || attrs.title !== undefined) return undefined
  return spoken.value ? `${spoken.value} (${shownCombo.value})` : shownCombo.value
})

function onClick(event: MouseEvent) {
  if (props.hotkey) {
    if (viaKey) hints.use(HINT_SIGNALS.hotkey)
    else if (event.detail > 0) {
      hints.use(HINT_SIGNALS.hotkeyTarget)
      const el = rootEl()
      if (el) noteHotkeyTarget(el, props.hotkey)
    }
  }
  void runAction()
}

const linkComponent = useLinkComponent()

const resolved = computed<{ is: string | Component; props: Record<string, unknown> }>(() => {
  if (props.as && props.as !== "a") {
    const target = props.to != null ? { to: props.to } : props.href != null ? { href: props.href } : {}
    return { is: props.as, props: props.as === "button" ? {} : target }
  }
  if (props.as === "a") return { is: "a", props: { href: props.href } }
  return resolveLink(linkComponent.value, { to: props.to, href: props.href }) ?? { is: "button", props: {} }
})

const isNativeButton = computed(() => resolved.value.is === "button")

/*
 * A disabled link has no `disabled` attribute to lean on: it must leave the tab
 * order and swallow the click. The capture phase runs before a router link's
 * own handler, which skips navigation once the event is default-prevented.
 */
function blockDisabled(event: MouseEvent) {
  if (!busy.value && (!props.disabled || isNativeButton.value)) return
  event.preventDefault()
  event.stopImmediatePropagation()
}

const SPINNER_TONE: Record<string, string> = {
  solid: "text-ink-inverse",
  action: "text-ink-inverse",
  danger: "text-ink-inverse",
  light: "text-[#0b1210]",
  muted: "text-muted",
}
const spinnerTone = computed(() => SPINNER_TONE[props.variant ?? "solid"] ?? "text-ink")

const linkProps = computed(() => {
  if (isNativeButton.value) return {}
  if (!props.disabled) return resolved.value.props
  return resolved.value.is === "a" ? {} : resolved.value.props
})

const { class: classes, attrs: rest } = useMergedAttrs(() =>
  button({
    variant: props.variant,
    size: props.size,
    block: props.block,
    square: props.square,
    glow: props.glow,
    loading: busy.value,
  }),
)

usePaletteAction({ label: () => typeof attrs["aria-label"] === "string" ? attrs["aria-label"] : undefined, element: () => rootEl(), disabled: () => props.disabled || busy.value })
</script>

<template>
  <component
    :is="resolved.is"
    ref="root"
    v-bind="{ ...rest, ...linkProps }"
    :title="hotkeyTitle ?? rest.title"
    :aria-keyshortcuts="hotkey || undefined"
    :type="isNativeButton ? type : undefined"
    :disabled="isNativeButton ? disabled : undefined"
    :aria-disabled="!isNativeButton && disabled ? 'true' : undefined"
    :tabindex="!isNativeButton && disabled ? -1 : undefined"
    :aria-busy="busy ? 'true' : undefined"
    :class="classes"
    @click.capture="blockDisabled"
    @click="onClick"
  >
    <slot />
    <span
      v-if="busy"
      class="pointer-events-none absolute inset-0 flex items-center justify-center animate-[fade-in_var(--duration-fast)_var(--ease-emphasized)] motion-reduce:animate-none"
      :class="spinnerTone"
      aria-hidden="true"
    >
      <!-- Shown at once: the faded label already acknowledged the click, so a
           delay would only leave the button blank. -->
      <LpLoader size="inline" tone="current" :delay="0" class="text-[1.15em]" />
    </span>
  </component>
</template>
