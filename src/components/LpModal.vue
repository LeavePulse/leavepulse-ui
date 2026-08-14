<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui"
import type { ComponentPublicInstance } from "vue"
import { computed, onBeforeUnmount, ref, useSlots, watch } from "vue"
import { CLOSE_ICON } from "./dropdown"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"

const props = withDefaults(
  defineProps<{
    open?: boolean
    title?: string
    description?: string
    /**
     * Max content width preset. sm≈24rem … xl≈42rem, 2xl≈56rem, 3xl≈72rem,
     * full≈96vw (near-fullscreen, for dense catalogues).
     */
    size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full"
    /** Explicit width override (any CSS length), wins over `size`. */
    width?: string
    /**
     * Let the body fill the available height as a flex column instead of
     * scrolling itself. Use for dense dashboards that own their inner scroll
     * regions (e.g. multi-pane catalogues) — the panes scroll, not the modal.
     */
    fillBody?: boolean
  }>(),
  { size: "md" },
)

defineEmits<{ (e: "update:open", value: boolean): void }>()

// Spread rather than a plain `:aria-describedby` binding: with a description
// the key must be absent entirely so reka-ui's own generated id survives, and
// only the description-less case overrides it away.
const describedByAttrs = computed(() =>
  props.description ? {} : { "aria-describedby": undefined },
)

const widthClass = computed(() => {
  if (props.width) return ""
  return {
    sm: "w-[min(92vw,24rem)]",
    md: "w-[min(92vw,28rem)]",
    lg: "w-[min(92vw,34rem)]",
    xl: "w-[min(92vw,42rem)]",
    "2xl": "w-[min(94vw,56rem)]",
    "3xl": "w-[min(95vw,72rem)]",
    full: "w-[96vw]",
  }[props.size]
})

// Body padding, shared by the fillBody flex path and the scroll path. Always
// inset horizontally; top only when there's no header, bottom only when there's
// no footer (header/footer own those edges).
const slots = useSlots()
const bodyPad = computed(() =>
  [
    "px-5",
    props.title || slots.title ? "" : "pt-5",
    slots.footer ? "" : "pb-5",
  ]
    .filter(Boolean)
    .join(" "),
)

/*
 * Height is content-derived, so a body that arrives late — a placeholder swapped
 * for the loaded thing — resizes the panel in a single frame, right on top of
 * the open animation. CSS alone can't smooth it: `height: auto` isn't
 * interpolable, and the keyword-interpolation escape hatches
 * (`interpolate-size`, `calc-size()`) are Chromium-only, so they would do
 * nothing in the WebKitGTK launcher. Measuring and pinning a pixel height is
 * what works on every engine.
 *
 * The pin is always the panel's own natural height, so `max-h` still clips and
 * the body keeps `flex-1 min-h-0` — an over-tall panel hands its overflow to the
 * scroll area exactly as before. A panel whose size never moves is pinned once
 * and never transitions.
 */
// reka renders a real element but exposes it as a component instance, so the
// panel is reached through $el.
const panelRef = ref<ComponentPublicInstance | null>(null)
const tweening = ref(false)
const resizing = ref(false)

/** Kept in step with the `duration-fast` utility on the panel. */
const TWEEN_MS = 160

let ro: ResizeObserver | undefined
let mo: MutationObserver | undefined
let raf = 0
let settleTimer: ReturnType<typeof setTimeout> | undefined
/** Where the panel last settled, so a retune has a height to ease FROM. */
let lastHeight = 0
/** True while a tween owns the height, so observers don't cancel it midway. */
let inFlight = false

// The height is driven imperatively rather than through a style binding. By the
// time replacement content is in the DOM the panel has already reflowed to its
// new size, so a bound value would only ever be written once, with no earlier
// height for the transition to start from. Writing the OLD height, forcing a
// reflow, then writing the new one gives the transition both ends.
const retune = (el: HTMLElement) => {
  // One swap wakes both observers — the mutation as content lands, the resize as
  // it reflows — and the second call would clear the pin the first just wrote.
  if (inFlight) return
  // Remembered, not measured: by the time either observer fires the panel has
  // already reflowed, so the element can only report where it is going.
  const from = lastHeight
  el.style.height = ""
  // `max-h` comes from a class, so the panel already reports the clipped figure
  // once the cap bites. Pinning that would leave a short panel sitting over
  // content it can no longer grow to fit, so the natural height is measured with
  // the cap lifted and the clamp is left to CSS afterwards.
  el.style.maxHeight = "none"
  const to = el.offsetHeight
  el.style.maxHeight = ""
  lastHeight = to
  // Nothing moved, so there is nothing to ease — and leaving the height unset
  // keeps the panel free to size itself.
  if (to === 0 || from === 0 || to === from) return
  el.style.height = `${from}px`
  void el.offsetHeight
  el.style.height = `${to}px`

  inFlight = true
  // While the panel is still catching up, the body is shorter than the content
  // it already holds, so the scroll area would flash a bar for an overflow that
  // resolves itself the moment the transition lands.
  resizing.value = true
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    inFlight = false
    resizing.value = false
    // Released once the panel has arrived. A height left pinned in pixels stops
    // being a starting point and becomes a cap: content that grows afterwards
    // is clipped, and `max-h` can no longer size the panel itself.
    el.style.height = ""
    // Re-read rather than trusting `to`: `max-h` may have clamped the panel
    // short of it, and the next tween has to start from where it really sits.
    lastHeight = el.offsetHeight
  }, TWEEN_MS)
}

// Keyed off `open` rather than the ref: the panel is portalled and remounts on
// every open, and the teardown has to run on close, when the ref is already gone.
watch(
  () => props.open,
  (isOpen) => {
    ro?.disconnect()
    mo?.disconnect()
    ro = undefined
    mo = undefined
    cancelAnimationFrame(raf)
    clearTimeout(settleTimer)
    tweening.value = false
    resizing.value = false

    lastHeight = 0
    inFlight = false

    const el = panelRef.value?.$el
    if (!isOpen || !(el instanceof HTMLElement)) return

    lastHeight = el.offsetHeight
    el.style.height = `${el.offsetHeight}px`
    // The opening panel must not animate its height in from the pre-content box,
    // so the transition only arms once that first pin has painted. The pin is
    // dropped in the same frame: it exists to give the first `retune` something
    // to start from, and holding it would cap the panel at its opening size.
    raf = requestAnimationFrame(() => {
      tweening.value = true
      el.style.height = ""
    })

    // Two triggers, since either can move the height alone: the resize observer
    // catches a child growing in place (an image decoding, a list filling in),
    // the mutation observer catches one subtree swapped for another, where every
    // observed box may keep its size. Children are observed, never the panel —
    // that would feed the pin straight back in.
    const watchChildren = () => {
      if (!ro) return
      ro.disconnect()
      for (const child of Array.from(el.children)) ro.observe(child)
    }
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => retune(el))
      watchChildren()
    }
    if (typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(() => {
        watchChildren()
        retune(el)
      })
      mo.observe(el, { childList: true, subtree: true, characterData: true })
    }
  },
  { flush: "post" },
)

onBeforeUnmount(() => {
  ro?.disconnect()
  mo?.disconnect()
  cancelAnimationFrame(raf)
  clearTimeout(settleTimer)
})
</script>

<template>
  <DialogRoot :open="open" @update:open="(v) => $emit('update:open', v)">
    <DialogPortal>
      <DialogOverlay
        class="lp-scrim fixed inset-0 z-(--z-overlay) backdrop-blur-sm data-[state=open]:animate-[fade-in_var(--duration-medium)_var(--ease-emphasized)] data-[state=closed]:animate-[fade-out_120ms_ease]"
      />
      <!-- Centred by a full-screen flex wrapper rather than by translating the
           panel off its own centre. With `top:50% / -translate-y-1/2` the panel
           is pinned by its MIDDLE, so every height change — content arriving,
           an image loading, a list filling in — moved it up and down by half
           the difference, and while the open animation was still running that
           read as a stutter. Anchoring the wrapper instead means the panel only
           grows downward and the animation has nothing to fight.
           `pointer-events-none` lets clicks through to the overlay behind it.

           The panel keeps its OWN max-height rather than inheriting one from
           this wrapper: `max-h-full` on a centred flex child resolves against a
           box it is free to overflow, so a tall body stopped handing its
           overflow to the scroll area below and simply ran off-screen. -->
      <div class="fixed inset-0 z-(--z-modal) flex items-center justify-center pointer-events-none">
      <!-- Without a description reka-ui warns on every open, and the opt-out it
           checks for is an ABSENT `aria-describedby` — despite the message
           naming the string "undefined" (a leftover from Radix, where
           `aria-describedby={undefined}` is how you drop the attribute).
           Dropping it here is what silences the warning; a caller that does
           pass a description keeps the generated id and the link to
           DialogDescription. -->
      <DialogContent
        ref="panelRef"
        class="pointer-events-auto flex max-h-[min(90vh,calc(100dvh-2rem))] min-h-0 flex-col overflow-hidden rounded-card border border-line bg-surface-raised shadow-panel outline-none data-[state=open]:animate-[rise-in_var(--duration-medium)_var(--ease-emphasized)] data-[state=closed]:animate-[rise-out_120ms_cubic-bezier(0.4,0,1,1)]"
        :class="[widthClass, tweening ? 'transition-[height] duration-fast ease-[var(--ease-emphasized)] motion-reduce:transition-none' : '']"
        :style="width ? { width } : undefined"
        v-bind="describedByAttrs"
      >
        <header v-if="title || $slots.title" class="flex shrink-0 items-start justify-between gap-4 p-5 pb-3">
          <div class="flex flex-col gap-1">
            <DialogTitle class="text-base font-semibold text-ink">
              <slot name="title">{{ title }}</slot>
            </DialogTitle>
            <DialogDescription v-if="description" class="text-sm text-muted">
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose
            class="group flex shrink-0 items-center rounded-md p-1 text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <LpIcon
              name="lucide:x"
              :size="18"
              :class="CLOSE_ICON"
            />
          </DialogClose>
        </header>

        <!-- fillBody: a plain flex column that owns its own inner scroll regions.
             Otherwise the body scrolls itself via LpScrollArea's overlay bar. -->
        <div
          v-if="fillBody"
          class="flex min-h-0 flex-1 flex-col overflow-hidden text-sm text-ink/90"
          :class="bodyPad"
        >
          <slot />
        </div>
        <!-- While the panel is still growing it is briefly shorter than the body
             it already holds, so the scroll area raises a bar for an overflow
             that resolves itself as the transition lands. Hiding just the bar
             for the length of the tween leaves scrolling itself untouched. -->
        <LpScrollArea
          v-else
          class="min-h-0 flex-1 text-sm text-ink/90"
          :class="resizing ? '[&_[data-scrollbarimpl]]:invisible' : ''"
          :content-class="bodyPad"
        >
          <slot />
        </LpScrollArea>

        <footer v-if="$slots.footer" class="flex shrink-0 justify-end gap-2 p-5 pt-4">
          <slot name="footer" />
        </footer>
      </DialogContent>
      </div>
    </DialogPortal>
  </DialogRoot>
</template>
