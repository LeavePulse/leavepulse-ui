<script setup lang="ts">
/*
 * Tooltip for controls whose meaning is not written on them — an icon button,
 * a truncated value, a disabled action that owes an explanation.
 *
 * Why not the native `title` attribute: it is drawn by the operating system, so
 * it looks different on every platform and cannot be themed; it waits about a
 * second before appearing; it cannot wrap or hold markup; and screen-reader
 * support for it is inconsistent — it is often ignored outright.
 *
 * Accessibility contract, which is the part that is easy to get wrong:
 *
 *   `label` — the tip IS the control's name (an icon button). The text is put
 *     on the TRIGGER as aria-label, so a screen reader announces "Delete,
 *     button" rather than "button". reka only ever wires aria-describedby,
 *     which describes a control that already has a name — it cannot name a
 *     nameless one, so naming has to happen here.
 *
 *   default — the tip merely ADDS to a control that already has a name. reka's
 *     own aria-describedby carries it, and the name is announced first.
 *
 * Either way the trigger keeps a real accessible name, which is what `title`
 * alone could not guarantee. reka opens the tip on keyboard focus as well as
 * hover and closes it on Escape, satisfying WCAG 1.4.13.
 *
 * Do NOT wrap the `#trigger` of LpDropdownMenu, LpPopover or LpContextMenu:
 * those bind their handlers to the slot's direct child, so a wrapper swallows
 * them and the control stops opening. Put `aria-label` on the trigger instead.
 */
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "reka-ui"
import { onBeforeUnmount, ref, watch } from "vue"
import {
  springSettled,
  springStep,
  type SpringState,
} from "../composables/usePillTransition"
import { PANEL_SURFACE, TOOLTIP_ANIM } from "./dropdown"

const props = withDefaults(
  defineProps<{
    content?: string
    sideOffset?: number
    /** Which edge to prefer; flips automatically when there is no room. */
    side?: "top" | "right" | "bottom" | "left"
    /**
     * The tip names the control rather than describing it — for a trigger with
     * no visible text of its own. Sets the accessible name instead of only
     * adding a description.
     */
    label?: boolean
    /** Milliseconds before the tip appears on hover. */
    delay?: number
    /**
     * Show on any focus, not just keyboard focus. Off by default: a tip that
     * pops up after every mouse click on the trigger is noise.
     */
    showOnPointerFocus?: boolean
    /**
     * Track the pointer instead of anchoring to the trigger's edge.
     *
     * For a trigger that is large or oddly shaped — a chart slice, a canvas, a
     * map region — where the element's bounding box says little about what the
     * pointer is actually over: anchored to the box, the tip can appear far from
     * the thing it describes. Following the cursor keeps it next to the reading.
     */
    followCursor?: boolean
    /**
     * Suppress the tip. For a trigger whose tip only applies to part of it — a
     * chart wrapper where the pointer may be over a mark or over empty canvas —
     * so an empty panel never opens over the gaps.
     *
     * This also FORCES CLOSED a tip that is already showing. reka's own
     * `disabled` does not: it stops managing the tooltip where it stands, so one
     * that was open when the flag flipped stayed on screen for good — outliving
     * the pointer, letting a second chart open its own beside it, and surviving
     * a scroll that should have dismissed it.
     */
    disabled?: boolean
  }>(),
  { delay: 200, side: "top" },
)

/*
 * Follow mode. reka positions the tip against the trigger's BOX and exposes no
 * virtual anchor for tooltips (PopperAnchor isn't part of its public surface),
 * so the tip is placed as usual and then offset to the cursor.
 *
 * Both axes are followed. Following x alone left the tip pinned to the vertical
 * middle of the trigger, which for a tall target — a pie 180px across, a canvas,
 * a map — parks it a long way from the pointer. The offset is measured from the
 * box's centre on each axis, and reka's own side placement still decides which
 * way the tip sits relative to that point.
 *
 * The tip TRAILS the cursor on a spring rather than being pinned to it: chasing
 * the pointer exactly reads as jitter, while a slight lag reads as following.
 * Same reasoning, and the same shared "float" feel, as LpChart's readout.
 */
const target = { x: 0, y: 0 }
const offset = ref({ x: 0, y: 0 })

/*
 * The spring constants come from the kit's shared "float" feel — the same ones
 * LpChart hands to motion-v for its readout. Only the mechanism differs: this
 * panel is portalled and positioned by reka, so there is no absolute target for
 * a declarative animation to own and the spring is integrated by hand.
 */
let sx: SpringState = { value: 0, velocity: 0 }
let sy: SpringState = { value: 0, velocity: 0 }
let frame = 0
let lastFrame = 0

const settle = (now: number) => {
  const dt = lastFrame ? (now - lastFrame) / 1000 : 1 / 60
  lastFrame = now
  frame = 0

  sx = springStep(sx, target.x, "float", dt)
  sy = springStep(sy, target.y, "float", dt)

  // Close enough to have arrived: snap and stop, so an idle tooltip isn't
  // holding a rAF loop open forever.
  if (springSettled(sx, target.x) && springSettled(sy, target.y)) {
    sx = { value: target.x, velocity: 0 }
    sy = { value: target.y, velocity: 0 }
    offset.value = { x: target.x, y: target.y }
    lastFrame = 0
    return
  }

  offset.value = { x: sx.value, y: sy.value }
  frame = requestAnimationFrame(settle)
}

const onPointerMove = (e: PointerEvent) => {
  if (!props.followCursor) return
  const el = e.currentTarget as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  const halfX = props.side === "left" || props.side === "right" ? rect.width / 2 : 0
  const dirX = props.side === "right" ? -1 : 1
  target.x = e.clientX - (rect.left + rect.width / 2) + halfX * dirX
  /*
   * reka clears the tip past the whole box's EDGE, not past the pointer, so on
   * a tall trigger it ends up half the box above the cursor — measured at 96px
   * on a 180px circle. Adding the half-height back re-references the placement
   * to the pointer itself; `side` then keeps its meaning (the tip still sits
   * above for "top"), now relative to the cursor rather than the box.
   */
  const half = props.side === "top" || props.side === "bottom" ? rect.height / 2 : 0
  const dir = props.side === "bottom" ? -1 : 1
  target.y = e.clientY - (rect.top + rect.height / 2) + half * dir
  if (!frame) frame = requestAnimationFrame(settle)
}

/*
 * Open state is held here rather than left to reka, so that `disabled` can shut
 * a tip that is already showing. Left to reka, disabling only detaches its
 * handlers — whatever was on screen stayed there.
 */
const open = ref(false)
/* What reka last asked for, regardless of whether it was allowed at the time. */
const wanted = ref(false)

const onOpenChange = (next: boolean) => {
  // What reka wants, kept apart from what is currently allowed.
  wanted.value = next
  open.value = next && !props.disabled
  if (!open.value || !props.followCursor) return
  // A fresh open starts at the cursor instead of flying in from wherever the
  // last one came to rest.
  offset.value = { x: target.x, y: target.y }
  sx = { value: target.x, velocity: 0 }
  sy = { value: target.y, velocity: 0 }
  lastFrame = 0
}

/*
 * `disabled` is driven by what the pointer is over, and that is resolved a tick
 * AFTER reka decides to open — so an open request could arrive while the flag
 * was still true from the last gap and be dropped on the floor. The tooltip then
 * refused to appear until the pointer moved again, which read as "hovering does
 * nothing any more".
 *
 * Remembering that a request was made, and honouring it once the obstacle
 * clears, closes that race in the only direction that matters: enabling shows
 * what was asked for, disabling still hides immediately.
 */
watch(
  () => props.disabled,
  (off) => {
    if (off) open.value = false
    else if (wanted.value) open.value = true
  },
)

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
})
</script>

<template>
  <TooltipProvider :delay-duration="delay">
    <!--
      `disable-closing-trigger` in follow mode: reka dismisses a tip when its
      trigger is clicked, which is right for a button (the tip explained the
      thing you just did) and wrong for a chart, where clicking selects a mark
      and the pointer never left it — the reading would vanish mid-interaction.
    -->
    <TooltipRoot
      :open="open"
      :ignore-non-keyboard-focus="!showOnPointerFocus"
      :disable-hoverable-content="followCursor"
      :disable-closing-trigger="followCursor"
      @update:open="onOpenChange"
    >
      <!-- `as-child` merges these onto the caller's own element, so the label
           lands on the real button rather than on a wrapper. -->
      <TooltipTrigger
        as-child
        :aria-label="label ? content : undefined"
        @pointermove="onPointerMove"
      >
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side="side"
          :side-offset="sideOffset ?? 6"
          :collision-padding="8"
          :data-lp-follow="followCursor ? '' : undefined"
          :class="[
            PANEL_SURFACE,
            TOOLTIP_ANIM,
            'z-(--z-tooltip) max-w-[min(20rem,90vw)] px-2.5 py-1.5 text-xs text-ink',
          ]"
          :style="followCursor ? { translate: `${offset.x}px ${offset.y}px` } : undefined"
        >
          <slot name="content">{{ content }}</slot>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<style>
/*
 * Unscoped: the element that has to be made transparent is reka's own
 * positioning wrapper, which this component never renders and a scoped
 * attribute therefore never reaches.
 *
 * In follow mode the tip is placed AT the cursor, so both the panel and that
 * wrapper sit under the pointer. The panel alone being transparent was not
 * enough — the wrapper still took the events, the trigger never received its
 * pointerleave, and the tip stayed open: it lingered after the pointer left,
 * a second chart could open its own on top, and a scroll left them stranded
 * because the trigger had never been told the pointer had gone.
 */
:has(> [data-lp-follow]),
[data-lp-follow] {
  pointer-events: none;
}
</style>
