<script setup lang="ts">
/*
 * LpCommandPalette's footer: the keys that work in it, the highlighted row's
 * actions and pin, and Backspace while inside a mode.
 */
import LpIcon from "./LpIcon.vue"
import type { PaletteLabels } from "./commandPaletteTypes"

defineProps<{
  text: Required<PaletteLabels>
  /** The highlighted row has actions (Tab). */
  actions: boolean
  /** Light the Tab key up for someone who has not found it yet. */
  litActions: boolean
  /** The highlighted row can be pinned. */
  canPin: boolean
  pinned: boolean
  /** Inside a mode, where Backspace on an empty box leaves it. */
  inMode: boolean
}>()

const emit = defineEmits<{
  (e: "actions"): void
  (e: "pin"): void
}>()
</script>

<template>
  <!-- Keyboard-only, so a touch screen without a keyboard gets the row back
       for results. -->
  <div
    class="flex shrink-0 items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-muted [@media(hover:none)_and_(pointer:coarse)]:hidden"
  >
    <span class="flex items-center gap-1">
      <kbd class="rounded-small border border-line px-1 text-[10px]">↑</kbd>
      <kbd class="rounded-small border border-line px-1 text-[10px]">↓</kbd>
      {{ text.navigate }}
    </span>
    <span class="flex items-center gap-1">
      <kbd class="rounded-small border border-line px-1 text-[10px]">↵</kbd>
      {{ text.select }}
    </span>
    <button
      v-if="actions"
      type="button"
      class="flex items-center gap-1 rounded-small outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
      :class="litActions && 'font-medium text-brand'"
      :aria-label="text.actions"
      @click="emit('actions')"
    >
      <kbd
        class="rounded-small border px-1 text-[10px] transition-colors"
        :class="litActions ? 'border-brand' : 'border-line'"
      >{{ text.tab }}</kbd>
      {{ text.actions }}
    </button>
    <button
      v-if="canPin"
      type="button"
      class="flex items-center gap-1 rounded-small outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
      :aria-label="pinned ? text.unpin : text.pin"
      :aria-pressed="pinned"
      @click="emit('pin')"
    >
      <kbd class="rounded-small border border-line px-1 text-[10px]">Alt+P</kbd>
      <LpIcon name="lucide:star" :size="11" :class="pinned && 'fill-current text-brand'" />
      {{ pinned ? text.unpin : text.pin }}
    </button>
    <!-- Only inside a mode: at the root Backspace just edits the query,
         and advertising it there would be a lie. -->
    <span v-if="inMode" class="flex items-center gap-1">
      <kbd class="rounded-small border border-line px-1 text-[10px]">⌫</kbd>
      {{ text.back }}
    </span>
    <span class="ml-auto flex items-center gap-1">
      <kbd class="rounded-small border border-line px-1 text-[10px]">{{ text.esc }}</kbd>
      {{ text.close }}
    </span>
  </div>
</template>
