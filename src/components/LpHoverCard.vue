<script setup lang="ts">
/*
 * A preview card that opens when the pointer rests on something: a username
 * that shows the profile, a server name that shows its status, a link that
 * shows where it goes. Reading it costs a pause, not a click and a back.
 *
 *   <LpHoverCard>
 *     <template #trigger><a href="/u/ada">@ada</a></template>
 *     <ProfilePreview id="ada" />
 *   </LpHoverCard>
 *
 * Different from the neighbours on purpose:
 * - LpTooltip names or explains a control in a line of text; this holds a
 *   small layout (avatar, stats, actions) and waits longer before opening, so
 *   passing over a list of names does not flash a card at every row.
 * - LpPopover opens on a click and is a place to DO something; a hover card is
 *   a glance, and everything in it must also be reachable without it (the
 *   trigger usually links to the full page).
 *
 * Behaviour, built on reka's HoverCard:
 * - Opens after `openDelay` on hover, and at once on keyboard focus of the
 *   trigger, so it is not a mouse-only feature.
 * - Stays open while the pointer travels to the card and over it, so a link
 *   or a button inside can be used; closes `closeDelay` after it leaves.
 * - Touch has no hover. With `touch="hold"` a press-and-hold opens the card
 *   (and that press does not also follow the link); a tap elsewhere closes it.
 *   `touch="none"` leaves touch alone, for triggers where a hold means
 *   something else (a drag handle, a context menu).
 */
import {
  HoverCardArrow,
  HoverCardContent,
  HoverCardPortal,
  HoverCardRoot,
  HoverCardTrigger,
} from "reka-ui"
import { computed, onBeforeUnmount, watch } from "vue"
import { mergeClass } from "../composables/useMergedClass"
import { useOutsideGuard, usePortalTarget } from "../composables/useView"
import { POPOVER_PANEL } from "./dropdown"

const props = withDefaults(
  defineProps<{
    side?: "top" | "right" | "bottom" | "left"
    align?: "start" | "center" | "end"
    sideOffset?: number
    /**
     * Milliseconds the pointer rests before the card opens. Longer than a
     * tooltip's on purpose: a card is big, and one that opens while the
     * pointer is only passing by covers what the reader was heading for.
     */
    openDelay?: number
    /** Milliseconds after the pointer leaves before it closes: room to cross the gap to the card. */
    closeDelay?: number
    /** A small pointer from the card to its trigger, for a trigger in a dense row where the card could belong to a neighbour. */
    arrow?: boolean
    /** Touch: `hold` opens on press-and-hold; `none` leaves touch to the trigger. */
    touch?: "hold" | "none"
    /** How long a touch must be held to open, in ms. */
    holdDelay?: number
    /** Turn the card off: the trigger stays and behaves as itself. */
    disabled?: boolean
    /** Extra classes for the card (width, padding). Merged, so `w-80 p-0` replaces the defaults. */
    panelClass?: string
  }>(),
  {
    side: "bottom",
    align: "center",
    sideOffset: 8,
    openDelay: 500,
    closeDelay: 200,
    arrow: false,
    touch: "hold",
    holdDelay: 450,
    disabled: false,
  },
)

// Controllable (v-model:open). Always held here, also uncontrolled, because a
// touch hold opens the card from outside reka's own hover handling.
const open = defineModel<boolean>("open", { default: false })

const panel = computed(() =>
  mergeClass(POPOVER_PANEL, "z-(--z-popover) w-72 rounded-card p-4 text-sm text-ink outline-none", props.panelClass),
)

const portalTo = usePortalTarget()
const guardOutside = useOutsideGuard()

/*
 * Press-and-hold. A hold that drifts is a scroll, not a hold, so moving past
 * a few pixels cancels it. Once it has opened the card, the click the finger
 * produces on lifting is swallowed: the reader asked for the preview, not for
 * the link under it.
 */
const SLOP = 8
let holdTimer = 0
let start = { x: 0, y: 0 }
let held = false

function cancelHold() {
  window.clearTimeout(holdTimer)
  holdTimer = 0
}

function onPointerDown(event: PointerEvent) {
  if (event.pointerType !== "touch" || props.touch !== "hold" || props.disabled) return
  held = false
  start = { x: event.clientX, y: event.clientY }
  cancelHold()
  holdTimer = window.setTimeout(() => {
    holdTimer = 0
    held = true
    open.value = true
  }, props.holdDelay)
}

function onPointerMove(event: PointerEvent) {
  if (!holdTimer) return
  if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > SLOP) cancelHold()
}

function onClickCapture(event: MouseEvent) {
  if (!held) return
  held = false
  event.preventDefault()
  event.stopPropagation()
}

// A long press would otherwise also bring up the system's own menu for the link.
function onContextMenu(event: Event) {
  if (holdTimer || held) event.preventDefault()
}

watch(
  () => props.disabled,
  (off) => {
    if (off) open.value = false
  },
)

onBeforeUnmount(cancelHold)
</script>

<template>
  <slot v-if="disabled" name="trigger" />
  <HoverCardRoot v-else v-model:open="open" :open-delay="openDelay" :close-delay="closeDelay">
    <HoverCardTrigger
      as-child
      :class="touch === 'hold' ? '[-webkit-touch-callout:none]' : undefined"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="cancelHold"
      @pointercancel="cancelHold"
      @click.capture="onClickCapture"
      @contextmenu="onContextMenu"
    >
      <slot name="trigger" />
    </HoverCardTrigger>
    <HoverCardPortal :to="portalTo">
      <HoverCardContent
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        :collision-padding="8"
        :class="panel"
        @pointer-down-outside="guardOutside"
        @escape-key-down="guardOutside"
      >
        <slot :close="() => (open = false)" />
        <HoverCardArrow v-if="arrow" :width="14" :height="7" class="fill-surface-raised" />
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
</template>
