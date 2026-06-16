<script setup lang="ts">
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
    title?: string
    description?: string
    /**
     * Max content width preset. sm≈24rem … xl≈42rem, 2xl≈56rem, 3xl≈72rem,
     * full≈96vw (near-fullscreen, for dense catalogues).
     */
    size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full"
    /** Explicit width override (any CSS length), wins over `size`. */
    width?: string
    /**
     * Let the body fill the available height as a flex column instead of
     * scrolling itself. Use for dense dashboards that own their inner scroll
     * regions (e.g. multi-pane catalogues) — the panes scroll, not the modal.
     */
    fillBody?: boolean
  }>(),
  { size: "md" },
)

defineEmits<{ (e: "update:open", value: boolean): void }>()

const widthClass = computed(() => {
  if (props.width) return ""
  return {
    sm: "w-[min(92vw,24rem)]",
    md: "w-[min(92vw,28rem)]",
    lg: "w-[min(92vw,34rem)]",
    xl: "w-[min(92vw,42rem)]",
    "2xl": "w-[min(94vw,56rem)]",
    "3xl": "w-[min(95vw,72rem)]",
    full: "w-[96vw]",
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
        class="fixed left-1/2 top-1/2 z-(--z-modal) flex max-h-[min(90vh,calc(100dvh-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-card border border-line bg-surface-raised shadow-panel outline-none data-[state=open]:animate-[pop-in_160ms_var(--ease-emphasized)] data-[state=closed]:animate-[pop-out_130ms_ease]"
        :class="widthClass"
        :style="width ? { width } : undefined"
      >
        <header v-if="title || $slots.title" class="flex shrink-0 items-start justify-between gap-4 p-5 pb-3">
          <div class="flex flex-col gap-1">
            <DialogTitle class="text-base font-semibold text-ink">
              <slot name="title">{{ title }}</slot>
            </DialogTitle>
            <DialogDescription v-if="description" class="text-sm text-muted">
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose class="rounded-md px-1 text-xl leading-none text-muted hover:text-ink">
            ×
          </DialogClose>
        </header>

        <div
          class="min-h-0 flex-1 px-5 text-sm text-ink/90"
          :class="[
            fillBody ? 'flex flex-col overflow-hidden' : 'overflow-y-auto',
            $slots.title || title ? '' : 'pt-5',
            $slots.footer ? '' : 'pb-5',
          ]"
        >
          <slot />
        </div>

        <footer v-if="$slots.footer" class="flex shrink-0 justify-end gap-2 p-5 pt-4">
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
