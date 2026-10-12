<script setup lang="ts">
/*
 * The floating note from useFieldNotice: anchored under the nearest
 * `relative` box, over whatever sits below it (usually the hint), so it never
 * moves the layout. It slides in, slides out, and nudges sideways when the
 * same note is raised again while showing.
 */
import { ref, watch } from "vue"
import { prefersReducedMotion } from "../composables/easing"
import type { FieldNotice } from "../composables/useFieldNotice"
import LpIcon from "./LpIcon.vue"

const props = defineProps<{
  notice: FieldNotice
  id?: string
}>()

const el = ref<HTMLElement | null>(null)

watch(
  () => props.notice.seq.value,
  (_, before) => {
    if (before === undefined || !el.value || prefersReducedMotion()) return
    el.value.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 240, easing: "ease-out" },
    )
  },
)
</script>

<template>
  <Transition
    enter-active-class="transition-[opacity,translate] duration-fast ease-[var(--ease-emphasized)] motion-reduce:transition-none"
    leave-active-class="transition-[opacity,translate] duration-fast ease-out motion-reduce:transition-none"
    enter-from-class="-translate-y-1 opacity-0"
    leave-to-class="-translate-y-1 opacity-0"
  >
    <div
      v-if="notice.message.value"
      :id="id"
      ref="el"
      role="status"
      class="pointer-events-none absolute top-full left-0 z-20 mt-1.5 flex max-w-full items-center gap-1.5 rounded-control border px-2 py-1 text-xs shadow-sm"
      :class="
        notice.tone.value === 'danger'
          ? 'border-danger/40 bg-surface-raised bg-[linear-gradient(var(--color-danger-soft),var(--color-danger-soft))] text-danger'
          : 'border-line bg-surface-raised text-ink'
      "
    >
      <LpIcon
        :name="notice.tone.value === 'danger' ? 'lucide:circle-alert' : 'lucide:info'"
        :size="13"
        class="shrink-0"
        :class="notice.tone.value === 'danger' ? '' : 'text-muted'"
      />
      <span class="truncate">{{ notice.message.value }}</span>
    </div>
  </Transition>
</template>
