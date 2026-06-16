<script setup lang="ts">
/*
 * Side panel built on reka Dialog. Slides in from left/right with overlay.
 * Used for filter panels, nav drawers, etc.
 */
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui"
import { computed } from "vue"

const props = withDefaults(
  defineProps<{
    open?: boolean
    side?: "left" | "right"
    title?: string
    description?: string
    /** Width preset. sm≈22rem, md≈28rem, lg≈36rem, xl≈48rem. */
    size?: "sm" | "md" | "lg" | "xl"
    /** Explicit width override (any CSS length), wins over `size`. */
    width?: string
  }>(),
  { side: "right", size: "sm" },
)

defineEmits<{ (e: "update:open", value: boolean): void }>()

const sideClass = computed(() =>
  props.side === "left"
    ? "left-0 data-[state=open]:animate-[drawer-in-left_220ms_var(--ease-emphasized)] data-[state=closed]:animate-[drawer-out-left_180ms_ease]"
    : "right-0 data-[state=open]:animate-[drawer-in-right_220ms_var(--ease-emphasized)] data-[state=closed]:animate-[drawer-out-right_180ms_ease]",
)

const widthClass = computed(() => {
  if (props.width) return ""
  return {
    sm: "w-[min(90vw,22rem)]",
    md: "w-[min(92vw,28rem)]",
    lg: "w-[min(94vw,36rem)]",
    xl: "w-[min(95vw,48rem)]",
  }[props.size]
})
</script>

<template>
  <DialogRoot :open="open" @update:open="(v) => $emit('update:open', v)">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-(--z-overlay) bg-black/50 backdrop-blur-sm data-[state=open]:animate-[fade-in_150ms_ease] data-[state=closed]:animate-[fade-out_130ms_ease]"
      />
      <DialogContent
        class="fixed inset-y-0 z-(--z-modal) flex flex-col border-line bg-surface-raised p-5 shadow-panel outline-none"
        :class="[side === 'left' ? 'border-r' : 'border-l', sideClass, widthClass]"
        :style="width ? { width } : undefined"
      >
        <header v-if="title || $slots.title" class="mb-4 flex items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            <DialogTitle class="text-base font-semibold text-ink">
              <slot name="title">{{ title }}</slot>
            </DialogTitle>
            <DialogDescription v-if="description" class="text-sm text-muted">
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose class="rounded-md px-1 text-xl leading-none text-muted hover:text-ink">×</DialogClose>
        </header>
        <div class="min-h-0 flex-1 overflow-auto"><slot /></div>
        <footer v-if="$slots.footer" class="mt-4 flex justify-end gap-2"><slot name="footer" /></footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
