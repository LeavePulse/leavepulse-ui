<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from "reka-ui"
import { computed, useAttrs } from "vue"
import { mergeClass } from "../composables/useMergedClass"
import { POPOVER_PANEL } from "./dropdown"
import { useOutsideGuard, usePortalTarget } from "../composables/useView"

// The trigger owns its attributes through the slot; fallthrough tags the panel.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    side?: "top" | "right" | "bottom" | "left"
    align?: "start" | "center" | "end"
    sideOffset?: number
    /** Extra classes for the floating panel (width, padding, overflow). */
    panelClass?: string
    /**
     * Accessible name of the panel, which reka exposes as a dialog. Without
     * one the trigger names it. A heading inside the panel names it better:
     * pass `aria-labelledby` with its id.
     */
    ariaLabel?: string
  }>(),
  { side: "bottom", align: "center", sideOffset: 6 },
)

// Controllable open state (v-model:open). Left unbound the popover stays
// uncontrolled and reka manages open/close on trigger interaction.
const open = defineModel<boolean>("open")

// Merged rather than appended, so `panelClass="w-80 p-0"` replaces the default
// width and padding instead of racing them in stylesheet order.
const panel = computed(() =>
  mergeClass(POPOVER_PANEL, "z-(--z-popover) w-64 rounded-card p-3 text-sm text-ink outline-none", props.panelClass),
)

/*
 * reka writes the trigger's id into `aria-labelledby` after the attributes it
 * was given, and that outranks `aria-label`: a name passed here never reached
 * a reader. It renders that value once per open, so the panel can be put right
 * as it opens without being overwritten.
 */
const attrs = useAttrs()
function namePanel(event: Event) {
  // The event comes from the positioning wrapper around the panel.
  const panel = (event.currentTarget as HTMLElement).querySelector('[role="dialog"]')
  if (!panel) return
  const labelledBy = attrs["aria-labelledby"]
  if (typeof labelledBy === "string") panel.setAttribute("aria-labelledby", labelledBy)
  else if (props.ariaLabel) panel.removeAttribute("aria-labelledby")
}

// Overlays open in the window this component renders in (an LpFrame's, inside one).
const portalTo = usePortalTarget()
// What happens in another document (the page around a frame, or a frame in
// the page) is not "outside" for this layer.
const guardOutside = useOutsideGuard()
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal :to="portalTo">
      <PopoverContent
        v-bind="$attrs"
        @open-auto-focus="namePanel"
        @interact-outside="guardOutside"
        @escape-key-down="guardOutside"
        :collision-padding="8"
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        :aria-label="ariaLabel"
        :class="panel"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
