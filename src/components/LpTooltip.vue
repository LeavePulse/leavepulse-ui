<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "reka-ui"

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
          class="z-(--z-tooltip) rounded-control border border-line bg-surface-overlay px-2.5 py-1.5 text-xs text-ink shadow-panel backdrop-blur data-[state=delayed-open]:animate-[popover-in_120ms_var(--ease-emphasized)] data-[state=closed]:animate-[popover-out_100ms_ease]"
        >
          <slot name="content">{{ content }}</slot>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
