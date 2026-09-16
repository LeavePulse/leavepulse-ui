<script setup lang="ts">
/*
 * A bar that rises from the bottom of the window to ask for one decision, then
 * leaves. Unsaved changes with Save/Discard, a cookie notice, "3 rows selected"
 * with a bulk action, an update waiting to be applied.
 *
 * It is deliberately NOT a dialog and NOT a toast, because it is neither:
 *
 *   A dialog takes the page hostage. The whole point of an unsaved-changes bar
 *   is that you can keep editing while it sits there — trapping focus and
 *   dimming the form behind it would be answering a question the user has not
 *   been asked yet.
 *
 *   A toast leaves on a timer. A decision that vanishes after four seconds is a
 *   decision the user can miss, and "your changes were lost because you looked
 *   away" is the outcome. This stays until something resolves it.
 *
 * So: fixed to the bottom, above the page but below modals, never focus-
 * trapped, and it does not close itself. `role="region"` with an accessible
 * name rather than `alertdialog` — it is a landmark you can Tab into, not a
 * thing demanding an answer before anything else can happen.
 */
import { computed, nextTick, ref, useSlots, watch } from "vue"
import { useBarStack } from "./actionBar"
import { CLOSE_ICON } from "./dropdown"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"

export interface ActionBarAction {
  label: string
  /** Leading icon (any name LpIcon takes). */
  icon?: string
  /** Mirrors LpButton's variants; the default reads as the primary action. */
  variant?: "solid" | "action" | "outline" | "soft" | "ghost" | "muted" | "light" | "danger"
  disabled?: boolean
  /** Shows a spinner in place of the icon and blocks repeat clicks. */
  loading?: boolean
  onClick?: () => void | Promise<void>
}

const props = withDefaults(
  defineProps<{
    /** Shown or not (v-model:open, or a plain :open). */
    open?: boolean
    /** Lead line — "You have unsaved changes". */
    title?: string
    /** Second line, quieter. Long explanations belong here, not in the title. */
    description?: string
    /** Leading icon. Omit for a bar that is purely text + buttons. */
    icon?: string
    /**
     * Buttons on the right, in reading order. The LAST one is the primary and
     * gets the solid treatment unless it says otherwise — the confirming action
     * sits closest to the edge the thumb and the eye finish on.
     */
    actions?: ActionBarAction[]
    /** Adds a "✕" that emits `dismiss`. For notices, not for decisions. */
    dismissible?: boolean
    /**
     * Tone. `danger` for a destructive pending action; the default stays neutral
     * because most of these bars are routine and a page edged in red for every
     * unsaved field trains people to ignore red.
     */
    variant?: "default" | "danger"
    /**
     * How wide the bar runs.
     *
     * "contained" (the default) keeps it to the width of its own content, up to
     * a cap, and centres it: a bar carrying six words and two buttons has no
     * business spanning a 1920px display, and stretching it puts the buttons a
     * screen away from the field you were editing.
     *
     * "full" spans the viewport edge to edge — for a cookie notice, which reads
     * as part of the page frame rather than as a message about one thing on it.
     * Its CONTENTS are still capped and centred, so the buttons stay beside the
     * text instead of being flung to the far corner.
     */
    width?: "contained" | "full"
    /**
     * Cap for the bar (or, when `width="full"`, for the row inside it). Any CSS
     * length. Defaults to a comfortable measure for a line of text and two or
     * three buttons — wider for `full`, whose job is to span the page and whose
     * contents therefore sit on the page's own measure, not a card's.
     */
    maxWidth?: string
    /** Accessible name for the landmark. Falls back to `title`. */
    ariaLabel?: string
  }>(),
  {
    open: true,
    actions: () => [],
    variant: "default",
    width: "contained",
  },
)

const emit = defineEmits<{
  (e: "update:open", value: boolean): void
  (e: "dismiss"): void
}>()

const slots = useSlots()

// The last action is the primary one unless the caller has said otherwise; the
// rest default to `ghost` so a bar with three buttons still has one obvious
// answer instead of three competing ones.
const resolvedActions = computed(() =>
  props.actions.map((a, i) => ({
    ...a,
    variant:
      a.variant ??
      (i === props.actions.length - 1
        ? props.variant === "danger"
          ? ("danger" as const)
          : ("solid" as const)
        : ("ghost" as const)),
  })),
)

const hasBody = computed(() => !!props.title || !!props.description || !!slots.default)

/**
 * 36rem for a contained bar: a line of text and two or three buttons, at about
 * the measure prose stays comfortable at — wider starts reading as a page
 * element, which a contained bar is not. A full-width bar IS page furniture, so
 * its row sits on the shell's own measure (LpAppShell centres content at
 * max-w-6xl) rather than being squeezed into a card's width, which cropped the
 * description of a cookie notice halfway through a word.
 */
const maxWidth = computed(() => props.maxWidth ?? (props.width === "full" ? "72rem" : "36rem"))

function run(action: ActionBarAction) {
  if (action.disabled || action.loading) return
  void action.onClick?.()
}

function dismiss() {
  emit("dismiss")
  emit("update:open", false)
}

/* ── stacking ─────────────────────────────────────
   Two bars at once is ordinary — a cookie notice over a form that has just been
   edited — and both are translucent, so overlapping them makes each unreadable
   through the other. Each open bar takes a slot and rides above the ones that
   opened before it. */
const root = ref<HTMLElement | null>(null)
const { register, unregister, setHeight, offset, bars } = useBarStack()

const stackOffset = computed(() => {
  // `bars` is read so the offset recomputes when a bar below is added, resized
  // or removed; the value itself comes from the registry.
  void bars.value
  return offset()
})

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      unregister()
      return
    }
    register()
    await nextTick()
    if (root.value) setHeight(root.value.getBoundingClientRect().height)
  },
  { immediate: true },
)
</script>

<template>
  <!-- Teleported so the bar is pinned to the VIEWPORT rather than to whatever
       container it was declared in: a `position: fixed` element inside an
       ancestor that has a transform, filter or backdrop-filter anchors to that
       ancestor instead, and the kit is full of such ancestors (any panel with a
       blur). Declaring it next to the form it belongs to should not decide
       where on screen it lands. -->
  <Teleport to="body">
    <!-- `forwards` on the way out, because the leave animation finishing is not
         the same moment as the element leaving. `rise-out` is a bare `to {}`, so
         once it ends the element snaps back to opacity 1 at its resting
         position, and Vue then takes a frame to unmount it — a bar that had
         faded to nothing flashed back at full strength and vanished. Holding the
         final frame means the last thing painted is the last frame of the fade.
         Reduced motion skips it entirely rather than holding a frame it never
         animated to. -->
    <Transition
      enter-active-class="animate-[rise-in_var(--duration-medium)_var(--ease-emphasized)]"
      leave-active-class="animate-[rise-out_var(--duration-fast)_ease_forwards] motion-reduce:animate-none"
    >
      <div
        v-if="open"
        ref="root"
        role="region"
        :aria-label="ariaLabel ?? title"
        class="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-modal) flex justify-center transition-[translate] duration-[var(--duration-medium)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
        :class="width === 'full' ? '' : 'p-3 sm:p-4'"
        :style="{ translate: `0 -${stackOffset}px` }"
      >
        <div
          class="lp-skin-panel pointer-events-auto flex items-center gap-3 border-solid bg-surface-overlay"
          :class="[
            // A full-width bar is the page's own furniture: square, edge to
            // edge, and only its top border drawn, so it reads as a frame
            // rather than as a card that happens to be very wide.
            width === 'full'
              ? 'w-full justify-center border-x-0 border-b-0 px-4 py-3 sm:px-6'
              : 'w-full rounded-card px-4 py-3',
            variant === 'danger' ? 'border-danger/40' : 'border-line',
          ]"
          :style="width === 'full' ? undefined : { maxWidth }"
        >
          <!-- `full` keeps its contents on the same measure as a contained bar,
               so the buttons stay next to the words instead of being pushed to
               the far edge of a wide display. -->
          <div
            class="flex w-full items-center gap-3"
            :style="{ maxWidth }"
          >
          <LpIcon
            v-if="icon"
            :name="icon"
            :size="18"
            :class="['shrink-0', variant === 'danger' ? 'text-danger' : 'text-brand']"
          />

          <!-- min-w-0 so a long description truncates instead of pushing the
               buttons off the end of the bar. -->
          <div v-if="hasBody" class="min-w-0 flex-1">
            <slot>
              <p v-if="title" class="truncate text-sm font-medium text-ink">{{ title }}</p>
              <p v-if="description" class="truncate text-xs text-muted">{{ description }}</p>
            </slot>
          </div>
          <div v-else class="flex-1" />

          <!-- Buttons never shrink: the bar gives up text before it gives up
               the thing you came here to click. -->
          <div class="flex shrink-0 items-center gap-2">
            <slot name="actions">
              <LpButton
                v-for="(action, i) in resolvedActions"
                :key="i"
                :variant="action.variant"
                size="sm"
                :disabled="action.disabled || action.loading"
                @click="run(action)"
              >
                <LpIcon
                  v-if="action.loading"
                  name="lucide:loader-circle"
                  :size="15"
                  class="animate-spin"
                />
                <LpIcon v-else-if="action.icon" :name="action.icon" :size="15" />
                {{ action.label }}
              </LpButton>
            </slot>

            <button
              v-if="dismissible"
              type="button"
              aria-label="Dismiss"
              class="group -mr-1 flex size-8 shrink-0 items-center justify-center rounded-control text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
              @click="dismiss"
            >
              <LpIcon name="lucide:x" :size="16" :class="CLOSE_ICON" />
            </button>
          </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
