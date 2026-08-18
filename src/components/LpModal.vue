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
import { computed, ref, useSlots, watch } from "vue"
import { useShift } from "../composables/useShift"
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
    /**
     * Where the keyboard lands when the dialog opens. Default `"auto"` picks
     * the first meaningful control in the body — a field to type in, or failing
     * that the primary action — instead of the close button, which is what
     * happens if the DOM order is left to decide.
     *
     * `"none"` leaves reka's own behaviour alone; pass a CSS selector to name
     * the element yourself.
     */
    autoFocus?: "auto" | "none" | string
  }>(),
  { size: "md", autoFocus: "auto" },
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
// The body clips overflow and focus rings are drawn outside their control, so a
// field flush against the top edge lost its ring; pt-1 clears the ring's width.
const bodyPad = computed(() =>
  [
    "px-5",
    props.title || slots.title ? "pt-1" : "pt-5",
    slots.footer ? "" : "pb-5",
  ]
    .filter(Boolean)
    .join(" "),
)

/*
 * Height is content-derived, so a body that arrives late — a placeholder swapped
 * for the loaded thing — would resize the panel in a single frame, right on top
 * of the open animation. The easing is set up further down.
 *
 * The pin is always the panel's own natural height, so `max-h` still clips and
 * the body keeps `flex-1 min-h-0` — an over-tall panel hands its overflow to the
 * scroll area exactly as before. A panel whose size never moves is pinned once
 * and never transitions.
 */
const panelRef = ref<ComponentPublicInstance | null>(null)

/**
 * Controls that are worth landing on when the dialog opens, in order of
 * preference. A field the user is going to type in wins over a button, since
 * typing is the reason most dialogs exist.
 */
const AUTO_FOCUS_ORDER = [
  "input:not([type=hidden]):not([disabled]):not([readonly])",
  "textarea:not([disabled]):not([readonly])",
  "select:not([disabled])",
  "[data-lp-autofocus]",
  "button:not([disabled]):not([data-lp-dialog-close])",
  "[href]",
  "[tabindex]:not([tabindex='-1'])",
]

/**
 * reka focuses the first tabbable node, which in this layout is the close
 * button in the header — the one control nobody opens a dialog to press. Worse,
 * a dialog opened by mouse gets a programmatic focus, and `:focus-visible` does
 * not match programmatic focus, so the ring never drew and the keyboard looked
 * dead even though it worked.
 *
 * Both are fixed here: pick a meaningful target, and mark it so the ring shows.
 */
function onOpenAutoFocus(event: Event) {
  if (props.autoFocus === "none") return
  const panel = panelRef.value?.$el
  if (!(panel instanceof HTMLElement)) return

  const selectors =
    props.autoFocus === "auto" ? AUTO_FOCUS_ORDER : [props.autoFocus]
  for (const selector of selectors) {
    const target = panel.querySelector<HTMLElement>(selector)
    if (!target || target.hasAttribute("disabled")) continue
    event.preventDefault()
    // `focus-visible` is the browser's own heuristic and cannot be forced, so
    // the ring is driven off an attribute the kit owns. Removed as soon as the
    // element loses focus, leaving normal focus-visible behaviour in charge.
    //
    // Skipped for a control whose own shell already draws a ring on
    // focus-within: our fields put the border and ring on the wrapper, so
    // adding one to the bare <input> stacks a second ring inside the first.
    if (!target.closest("[data-lp-ring-owner]")) {
      target.setAttribute("data-lp-focus-ring", "")
      target.addEventListener(
        "blur",
        () => target.removeAttribute("data-lp-focus-ring"),
        { once: true },
      )
    }
    target.focus()
    return
  }
}
// The panel's height eases between content-derived sizes — see
// `useShift`, which owns the measure/pin/tween mechanism and is shared
// with LpShift. Gated on `open`, because the panel is portalled and remounts
// on every open: a remount must measure afresh rather than ease in from the
// size the previous incarnation happened to hold.
const {
  el: sizedEl,
  tweening,
  resizing,
} = useShift({ axis: "height", enabled: () => props.open })

// reka renders a real element but exposes it as a component instance, so the
// sized element is handed over through $el once the panel has mounted.
watch(
  () => (props.open ? panelRef.value : null),
  (panel) => {
    const el = panel?.$el
    sizedEl.value = el instanceof HTMLElement ? el : null
  },
  { flush: "post" },
)
</script>

<template>
  <DialogRoot :open="open" @update:open="(v) => $emit('update:open', v)">
    <DialogPortal>
      <DialogOverlay
        class="lp-scrim fixed inset-0 z-(--z-overlay) data-[state=open]:animate-[fade-in_var(--duration-medium)_var(--ease-emphasized)] data-[state=closed]:animate-[fade-out_120ms_ease]"
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
        @open-auto-focus="onOpenAutoFocus"
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
          <!-- Marked so the auto-focus pass skips it: it is first in the DOM
               and last in usefulness. Still reachable by Tab and Escape. -->
          <DialogClose
            data-lp-dialog-close
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
