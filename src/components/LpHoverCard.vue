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
import { computed, mergeProps, useAttrs, watch } from "vue"
import { mergeClass } from "../composables/useMergedClass"
import { useTouchHold } from "../composables/useTouchHold"
import { useOutsideGuard, usePortalTarget } from "../composables/useView"
import { PANEL_FIT, POPOVER_PANEL } from "./dropdown"

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
  mergeClass(POPOVER_PANEL, PANEL_FIT, "z-(--z-popover) w-72 rounded-card p-4 text-sm text-ink outline-none", props.panelClass),
)

const portalTo = usePortalTarget()
const guardOutside = useOutsideGuard()

// Press-and-hold opens the card on a touch screen, where there is no hover.
const hold = useTouchHold({ enabled: () => props.touch === "hold" && !props.disabled, delay: () => props.holdDelay, onHold: () => (open.value = true) })

watch(
  () => props.disabled,
  (off) => {
    if (!off) return
    hold.cancel()
    open.value = false
  },
)

// Several roots (trigger and portal), so Vue cannot hand attributes on by
// itself and dropped them: a trigger wrapped around this one from outside (an
// LpPopover's, as-child) lost its id, ARIA state and click, and its popover
// never opened. They go to the trigger, which merges them onto the slot's element.
defineOptions({ inheritAttrs: false })
// The caller's own listeners on the trigger run beside the hold's, not instead of them.
const attrs = useAttrs()
const triggerAttrs = computed(() => mergeProps(attrs, hold.handlers))
</script>

<template>
  <slot v-if="disabled" name="trigger" />
  <HoverCardRoot v-else v-model:open="open" :open-delay="openDelay" :close-delay="closeDelay">
    <HoverCardTrigger
      as-child
      v-bind="triggerAttrs"
      :class="touch === 'hold' ? '[-webkit-touch-callout:none]' : undefined"
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
