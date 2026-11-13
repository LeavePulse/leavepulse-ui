<script setup lang="ts">
import { computed, ref } from "vue"
import { LpButton, pageAfterSwipe, rubberClamp, shouldDismiss, useGesture, usePrefersReducedMotion } from "../../src"

const reduced = usePrefersReducedMotion()
const ease = (on: boolean) => (on && !reduced.value ? "transform 320ms cubic-bezier(0.32, 0.72, 0, 1), opacity 320ms ease" : "none")

/* Swipe to dismiss: the card follows the finger along x, a release past half its width or a flick carries it off. */
const card = ref<HTMLElement | null>(null)
const cardX = ref(0)
const gone = ref(0)
const last = ref("Drag the card sideways, or the slides below.")
const cardDrag = useGesture(card, {
  axis: "x",
  onDrag: ({ movement }) => (cardX.value = movement.x),
  onDragEnd: ({ movement, velocity, cancelled }) => {
    const size = card.value?.offsetWidth ?? 300
    const side = Math.sign(movement.x) || 1
    const away = !cancelled && shouldDismiss({ offset: movement.x * side, velocity: velocity.x * side, size })
    last.value = `${away ? "Dismissed" : "Sprang back"} at ${Math.round(movement.x)} px, ${velocity.x.toFixed(2)} px/ms`
    cardX.value = away ? side * size * 1.3 : 0
    if (away) window.setTimeout(() => {
      gone.value++
      cardX.value = 0
    }, reduced.value ? 0 : 320)
  },
})
const cardStyle = computed(() => ({
  transform: `translateX(${cardX.value}px) rotate(${cardX.value / 40}deg)`,
  opacity: String(1 - Math.min(0.6, Math.abs(cardX.value) / 500)),
  transition: ease(!cardDrag.dragging.value),
}))

/* Swipe between items: the track follows the finger, gives at the ends, and a release pages by at most one. */
const slides = ["One", "Two", "Three", "Four"]
const pager = ref<HTMLElement | null>(null)
const index = ref(0)
const offset = ref(0)
const pagerDrag = useGesture(pager, {
  axis: "x",
  onDrag: ({ movement }) => {
    const size = pager.value?.offsetWidth ?? 300
    const at = -index.value * size + movement.x
    offset.value = rubberClamp(at, -(slides.length - 1) * size, 0, size) + index.value * size
  },
  onDragEnd: ({ movement, velocity, cancelled }) => {
    const size = pager.value?.offsetWidth ?? 300
    if (!cancelled) index.value = pageAfterSwipe({ index: index.value, count: slides.length, offset: movement.x, velocity: velocity.x, size })
    offset.value = 0
  },
})
const trackStyle = computed(() => ({
  transform: `translateX(calc(${-index.value * 100}% + ${offset.value}px))`,
  transition: ease(!pagerDrag.dragging.value),
}))
</script>

<template>
  <div class="flex w-full max-w-md flex-col gap-4">
    <div class="relative grid h-36 place-items-center overflow-hidden rounded-card border border-dashed border-line">
      <span class="text-sm text-muted">Dismissed: {{ gone }}</span>
      <div
        ref="card"
        class="absolute inset-4 grid touch-pan-y cursor-grab select-none place-items-center rounded-card border border-line bg-surface-raised text-sm font-medium text-ink shadow-sm active:cursor-grabbing"
        :style="cardStyle"
      >
        Swipe me away
      </div>
    </div>
    <div ref="pager" class="touch-pan-y cursor-grab select-none overflow-hidden rounded-card border border-line active:cursor-grabbing">
      <div class="flex" :style="trackStyle">
        <div v-for="slide in slides" :key="slide" class="grid h-28 w-full shrink-0 place-items-center bg-surface-soft text-lg font-semibold text-ink">{{ slide }}</div>
      </div>
    </div>
    <div class="flex items-center justify-between gap-2 text-sm text-muted">
      <span>{{ last }}</span>
      <LpButton size="sm" variant="ghost" :disabled="index === 0" @click="index = 0">First slide</LpButton>
    </div>
  </div>
</template>
