<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from "reka-ui"

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
        class="z-(--z-popover) w-64 rounded-card border border-line bg-surface-overlay p-3 text-sm text-ink shadow-panel backdrop-blur outline-none data-[state=open]:animate-[popover-in_140ms_var(--ease-emphasized)] data-[state=closed]:animate-[popover-out_120ms_ease]"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
