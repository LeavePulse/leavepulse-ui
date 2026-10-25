<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * LpMagnetic — leans what it wraps toward a nearby pointer and lets it spring
 * back when the pointer leaves.
 *
 *   <LpMagnetic><LpButton size="lg">Play</LpButton></LpMagnetic>
 *
 * For the one or two primary actions of a screen (the launcher's Play): the
 * button meets the cursor a little way, which makes it feel like the obvious
 * target. On every button it turns a toolbar into jelly, so keep it rare.
 *
 * The field reaches `reach` px past the element's edge. The position is read
 * once per animation frame from a single listener on its window and written to the
 * `translate` property directly, so nothing re-renders. Mouse only; reduced
 * motion leaves the element still. Layout is untouched: the wrapper keeps its
 * place and only its paint moves.
 */
import { onBeforeUnmount, onMounted, ref } from "vue"
import { prefersReducedMotion } from "../composables/easing"
import { useMergedAttrs } from "../composables/useMergedClass"
import { magneticOffset } from "./dock"

const props = withDefaults(
  defineProps<{
    /** How far past the element's edge, in px, the pull is felt. */
    reach?: number
    /** Fraction of the pointer's distance the element travels, 0–1. Small is better. */
    strength?: number
    /** Keep the wrapper, turn the pull off. */
    disabled?: boolean
  }>(),
  { reach: 60, strength: 0.25, disabled: false },
)

const { class: classes, attrs: rest } = useMergedAttrs(() => "inline-block")

const el = ref<HTMLElement | null>(null)
let frame = 0
let lastX = 0
let lastY = 0
let held = false

function paint() {
  frame = 0
  const node = el.value
  if (!node) return
  const rect = node.getBoundingClientRect()
  const dx = lastX - (rect.left + rect.width / 2)
  const dy = lastY - (rect.top + rect.height / 2)
  // The field is measured from the edge, so a wide button pulls from as far
  // away along its length as a square one does.
  const reach = props.reach + Math.max(rect.width, rect.height) / 2
  const { x, y } = props.disabled ? { x: 0, y: 0 } : magneticOffset(dx, dy, reach, props.strength)
  const pulling = x !== 0 || y !== 0
  if (!pulling && !held) return
  held = pulling
  // Following: short and direct. Letting go: the settle curve, whose slight
  // overshoot is the spring back.
  node.style.transition = pulling
    ? "translate 120ms ease-out"
    : "translate var(--duration-slow) var(--ease-settle)"
  node.style.translate = pulling ? `${x.toFixed(1)}px ${y.toFixed(1)}px` : ""
}

function onMove(event: PointerEvent) {
  if (event.pointerType !== "mouse" || prefersReducedMotion()) return
  lastX = event.clientX
  lastY = event.clientY
  if (!frame) frame = requestAnimationFrame(paint)
}

// The pointer leaving the window sends no further moves, so the element would
// stay leaning toward a cursor that is gone.
function onOut(event: PointerEvent) {
  if (event.relatedTarget || !held) return
  lastX = lastY = Number.POSITIVE_INFINITY
  if (!frame) frame = requestAnimationFrame(paint)
}

// The window the element actually lives in: inside LpFrame that is the
// frame's, and the pointer events over it never reach the page's own window.
let host: Window | null = null

onMounted(() => {
  host = el.value?.ownerDocument.defaultView ?? window
  host.addEventListener("pointermove", onMove, { passive: true })
  host.addEventListener("pointerout", onOut, { passive: true })
})
onBeforeUnmount(() => {
  host?.removeEventListener("pointermove", onMove)
  host?.removeEventListener("pointerout", onOut)
  if (frame) cancelAnimationFrame(frame)
})
</script>

<template>
  <div ref="el" :class="classes" v-bind="rest">
    <slot />
  </div>
</template>
