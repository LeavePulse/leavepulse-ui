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
 */
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "reka-ui"
import { PANEL_SURFACE, TOOLTIP_ANIM } from "./dropdown"

withDefaults(
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
  }>(),
  { delay: 200, side: "top" },
)
</script>

<template>
  <TooltipProvider :delay-duration="delay">
    <TooltipRoot :ignore-non-keyboard-focus="!showOnPointerFocus">
      <!-- `as-child` merges these onto the caller's own element, so the label
           lands on the real button rather than on a wrapper. -->
      <TooltipTrigger as-child :aria-label="label ? content : undefined">
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side="side"
          :side-offset="sideOffset ?? 6"
          :class="[
            PANEL_SURFACE,
            TOOLTIP_ANIM,
            'z-(--z-tooltip) max-w-[min(20rem,90vw)] px-2.5 py-1.5 text-xs text-ink',
          ]"
        >
          <slot name="content">{{ content }}</slot>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
