<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from "reka-ui"
import { POPOVER_PANEL } from "./dropdown"

withDefaults(
  defineProps<{
    side?: "top" | "right" | "bottom" | "left"
    align?: "start" | "center" | "end"
    sideOffset?: number
    /** Extra classes for the floating panel (width, padding, overflow). */
    panelClass?: string
  }>(),
  { side: "bottom", align: "center", sideOffset: 6 },
)

// Controllable open state (v-model:open). Left unbound the popover stays
// uncontrolled and reka manages open/close on trigger interaction.
const open = defineModel<boolean>("open")
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        :class="[POPOVER_PANEL, 'z-(--z-popover) w-64 rounded-card p-3 text-sm text-ink outline-none', panelClass]"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
