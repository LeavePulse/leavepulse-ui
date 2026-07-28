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
import { computed, useSlots } from "vue"
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
</script>

<template>
  <DialogRoot :open="open" @update:open="(v) => $emit('update:open', v)">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-(--z-overlay) bg-black/50 backdrop-blur-sm data-[state=open]:animate-[fade-in_var(--duration-medium)_var(--ease-emphasized)] data-[state=closed]:animate-[fade-out_120ms_ease]"
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
        class="pointer-events-auto flex max-h-[min(90vh,calc(100dvh-2rem))] min-h-0 flex-col rounded-card border border-line bg-surface-raised shadow-panel outline-none data-[state=open]:animate-[rise-in_var(--duration-medium)_var(--ease-emphasized)] data-[state=closed]:animate-[rise-out_120ms_cubic-bezier(0.4,0,1,1)]"
        :class="widthClass"
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
        <LpScrollArea
          v-else
          class="min-h-0 flex-1 text-sm text-ink/90"
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
