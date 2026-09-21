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
import { useShift } from "../composables/useShift"
import { useModalLayer } from "./modalDepth"
import { CLOSE_ICON } from "./dropdown"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"

/*
 * Stacking depth, so a dialog opened FROM a dialog sits above the one that
 * opened it — scrim included.
 *
 * The fixed rungs cannot express this on their own. Every modal took
 * --z-overlay for its scrim and --z-modal for its panel, so a nested pair
 * landed at exactly the heights of the outer pair: the second scrim, at 100,
 * sat UNDER the first panel at 110. It still darkened the page, which is why
 * this reads as "the blur is missing" rather than as a stacking bug — a
 * backdrop-filter only blurs what is painted beneath it, and the panel it was
 * supposed to blur was above.
 *
 * Each level adds a step, keeping the scrim one below its own panel and both
 * above everything the level beneath put on screen. The same problem, and the
 * same fix, as the lightbox's own rungs in tokens.css — only the depth here is
 * not known until a dialog finds itself inside another.
 */
const { claim, release, layer } = useModalLayer()

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
/*
 * A click on the aside lands outside DialogContent, and reka reads anything
 * outside it as a click on the scrim — the dialog closed under the pointer the
 * moment you picked a section. The aside marks itself, and a click that starts
 * inside one keeps the dialog open. Without an aside nothing carries the
 * attribute and every click behaves exactly as before.
 */
const onInteractOutside = (event: Event) => {
  const target = event.target
  if (target instanceof Element && target.closest("[data-lp-modal-aside]")) {
    event.preventDefault()
  }
}

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

// Dialog and aside only form a pair when something fills the slot.
const hasAside = computed(() => Boolean(slots.aside || slots.asideEnd))
// The body clips overflow and focus rings are drawn outside their control, so a
// field flush against the top edge lost its ring; pt-1 clears the ring's width.
/*
 * Claim a level as this dialog opens, give it back as it closes. `immediate`
 * matters: a dialog that starts out open has to have its rung before the first
 * paint, or its scrim lands on the default one for a frame.
 */
watch(() => props.open, (open) => (open ? claim() : release()), { immediate: true })

// A dialog torn down while still open would otherwise stay on the stack, holding
// every dialog under it a step lower than it should be.
onBeforeUnmount(release)

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
        class="lp-scrim fixed inset-0 data-[state=open]:animate-[fade-in_var(--duration-medium)_var(--ease-emphasized)] data-[state=closed]:animate-[fade-out_120ms_ease]"
        :style="{ zIndex: layer.scrim }"
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
      <!-- A companion panel standing OUTSIDE the dialog, in the same centring
           row: a section list, a preview, a picker. Inside, it would take the
           width the body already wants; measured against the viewport it would
           have to be re-measured on every resize.

           The row keeps `items-center` until something fills the slot, so a
           dialog without one centres exactly as it always has. With an aside
           the two align to the top of the row instead, and because the row
           collapses to its content the taller of the pair sets that top edge —
           so the aside may be shorter than the dialog, and the dialog is never
           shorter than the aside. Neither is stretched: `stretch` here would
           pull every dialog to the full height of its own ceiling.

           Height, width, the gap to the dialog and whether it appears at all
           are the caller's, and deliberately so: a utility class written in
           this file is not in the consuming app's Tailwind scan and would never
           be generated. The gap in particular has to go with the aside — kept
           here, it survives an aside hidden at a breakpoint this file knows
           nothing about, and pushes the dialog off centre by its own width. -->
      <div
        class="fixed inset-0 flex items-center justify-center pointer-events-none"
        :style="{ zIndex: layer.panel }"
      >
      <!-- The dialog and its aside stand in a row of their own, and that row is
           what the wrapper centres. Aligning them on the full-screen wrapper
           instead would pin them to the top of the WINDOW, and the dialog would
           be free to end up shorter than the aside beside it.
           `items-start` inside the row: the row collapses to the taller of the
           two, both hang from its top edge, and neither is stretched. -->
      <div
        class="flex items-start"
        :style="hasAside ? { maxHeight: 'min(90vh, calc(100dvh - 2rem))' } : undefined"
      >
      <!-- Bound to `open`, not to the slot alone: DialogContent unmounts itself
           with the dialog, but an aside is an ordinary node in the portal and
           stayed on screen after the dialog closed — a section list floating
           over the page with nothing behind it.

           `pointer-events-auto` because the wrapper lets clicks through to the
           overlay, and the aside is not the overlay. `data-lp-modal-aside` is
           what tells `interact-outside` a click here is not a click on the
           scrim — without it the dialog closes under the pointer. -->
      <aside
        v-if="open && $slots.aside"
        data-lp-modal-aside
        class="pointer-events-auto flex min-h-0 flex-col"
      >
        <slot name="aside" />
      </aside>
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
        :style="{ ...(width ? { width } : {}), ...(hasAside ? { alignSelf: 'stretch' } : {}) }"
        v-bind="describedByAttrs"
        @open-auto-focus="onOpenAutoFocus"
        @interact-outside="onInteractOutside"
        @pointer-down-outside="onInteractOutside"
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

      <aside
        v-if="open && $slots.asideEnd"
        data-lp-modal-aside
        class="pointer-events-auto flex min-h-0 flex-col"
      >
        <slot name="asideEnd" />
      </aside>
      </div>
      </div>
    </DialogPortal>
  </DialogRoot>
</template>
