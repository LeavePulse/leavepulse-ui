<script setup lang="ts">
/*
 * The live miniature on an index card: the entry's `thumb` template, compiled
 * like the full example but mounted only once the card scrolls into view
 * (useReveal), and inert, so the index stays one tab stop per card.
 *
 * An entry with `thumbLoop` plays: its frames are written over the scope in
 * turn while the card is on screen and the tab is visible, and stop when it
 * scrolls away, so a page of cards never runs timers for what nobody sees.
 * Under reduced motion the first frame stays.
 */
import { computed, defineComponent, onBeforeUnmount, onErrorCaptured, reactive, ref, watch, type Component } from "vue"
import { LpIcon, prefersReducedMotion, useReveal } from "../../src"
import type { ComponentEntry } from "./registry"

const props = defineProps<{ entry: ComponentEntry; icon?: string }>()

const { el, revealed } = useReveal({ threshold: 0.05, rootMargin: "200px 0px" })
// Made when the card first shows, not for all the cards at once on load.
const state = computed(() =>
  revealed.value
    ? reactive({
        ...(props.entry.thumbState === false ? {} : (props.entry.state?.() ?? {})),
        ...props.entry.thumbLoop?.frames[0],
      })
    : {},
)
const failed = ref(false)

const View = computed<Component | null>(() =>
  props.entry.thumb
    ? { components: props.entry.components, setup: () => state.value, template: props.entry.thumb.trim() }
    : null,
)

const Boundary = defineComponent({
  setup(_, { slots }) {
    onErrorCaptured(() => {
      failed.value = true
      return false
    })
    return () => slots.default?.()
  },
})

const onScreen = ref(false)
const pageVisible = ref(typeof document === "undefined" || document.visibilityState === "visible")
const onVisibility = () => (pageVisible.value = document.visibilityState === "visible")
let observer: IntersectionObserver | null = null
let timer: ReturnType<typeof setInterval> | undefined
let frame = 0

watch(
  el,
  (node) => {
    observer?.disconnect()
    observer = null
    if (!node || !props.entry.thumbLoop || typeof IntersectionObserver === "undefined") return
    observer = new IntersectionObserver(([entry]) => (onScreen.value = !!entry?.isIntersecting), { threshold: 0.3 })
    observer.observe(node)
    document.addEventListener("visibilitychange", onVisibility)
  },
  { flush: "post", immediate: true },
)

watch(
  () => !!props.entry.thumbLoop && revealed.value && onScreen.value && pageVisible.value && !failed.value,
  (play) => {
    clearInterval(timer)
    timer = undefined
    const loop = props.entry.thumbLoop
    if (!play || !loop || loop.frames.length < 2 || prefersReducedMotion()) return
    timer = setInterval(() => {
      frame = (frame + 1) % loop.frames.length
      Object.assign(state.value, loop.frames[frame])
    }, loop.every ?? 1800)
  },
)

onBeforeUnmount(() => {
  clearInterval(timer)
  observer?.disconnect()
  document.removeEventListener("visibilitychange", onVisibility)
})
</script>

<template>
  <div ref="el" inert class="relative flex h-48 items-center justify-center overflow-hidden bg-surface p-4 [justify-content:safe_center]">
    <Boundary v-if="revealed && View && !failed">
      <component :is="View" />
    </Boundary>
    <LpIcon v-else-if="!View || failed" :name="icon ?? 'lucide:box'" :size="28" class="text-muted" />
  </div>
</template>
