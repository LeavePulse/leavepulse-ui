<script setup lang="ts">
import { tv } from "tailwind-variants"

defineProps<{
  title: string
  accent?: string
  draggableHead?: boolean
  removable?: boolean
}>()

defineEmits<{ (e: "remove"): void }>()

const block = tv({
  slots: {
    root: "flex h-full w-full flex-col overflow-hidden rounded-card border bg-surface-raised shadow-panel",
    head: "flex items-center gap-2 border-b border-line bg-gradient-to-b from-white/[0.03] to-transparent px-3 py-2.5 select-none",
    title: "text-[13px] font-semibold",
    body: "flex min-h-0 flex-1 flex-col gap-2.5 p-3.5",
  },
  variants: {
    edit: {
      true: { root: "border-line-strong", head: "cursor-grab active:cursor-grabbing" },
      false: { root: "border-line" },
    },
  },
})
</script>

<template>
  <div :class="block({ edit: draggableHead }).root()">
    <header :class="block({ edit: draggableHead }).head()">
      <span class="size-2 rounded-full" :style="{ background: accent ?? 'var(--color-brand)' }" />
      <span :class="block().title()">{{ title }}</span>
      <button
        v-if="removable"
        class="ml-auto rounded-md px-1 text-[18px] leading-none text-muted hover:bg-danger/15 hover:text-danger"
        title="Remove block"
        @click="$emit('remove')"
      >
        ×
      </button>
      <span v-else-if="draggableHead" class="ml-auto text-sm text-muted">⠿</span>
    </header>
    <div :class="block().body()">
      <slot>
        <div class="h-12 rounded-md bg-surface-soft" />
        <div class="h-3.5 rounded-md bg-surface-soft" />
        <div class="h-3.5 w-3/5 rounded-md bg-surface-soft" />
      </slot>
    </div>
  </div>
</template>
