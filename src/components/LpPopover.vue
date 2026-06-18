<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from "reka-ui"
import { POPOVER_PANEL } from "./dropdown"

defineProps<{ side?: "top" | "right" | "bottom" | "left"; align?: "start" | "center" | "end" }>()
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :side="side ?? 'bottom'"
        :align="align ?? 'center'"
        :side-offset="6"
        :class="[POPOVER_PANEL, 'z-(--z-popover) w-64 rounded-card p-3 text-sm text-ink outline-none']"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
