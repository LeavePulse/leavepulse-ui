<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "reka-ui"
import { PANEL_SURFACE, TOOLTIP_ANIM } from "./dropdown"

defineProps<{ content?: string; sideOffset?: number }>()
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side-offset="sideOffset ?? 6"
          :class="[PANEL_SURFACE, TOOLTIP_ANIM, 'z-(--z-tooltip) px-2.5 py-1.5 text-xs text-ink']"
        >
          <slot name="content">{{ content }}</slot>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
