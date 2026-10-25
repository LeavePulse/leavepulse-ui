<script lang="ts">
// Attributes go onto the collapsing box, not onto the Transition around it.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Shows and hides content by folding it open and shut: the box grows from
 * nothing to the content's own height (or width), and back. Anything under it
 * glides instead of jumping.
 *
 *   <LpButton @click="advanced = !advanced">Advanced</LpButton>
 *   <LpCollapse v-model:open="advanced">
 *     <AdvancedOptions />
 *   </LpCollapse>
 *
 * It is the bare motion with no trigger or chrome, for where the thing that
 * opens it is somewhere else: a switch that reveals dependent fields, a
 * "show details" link, a row that expands in a table, a toolbar section that
 * slides out sideways (`axis="width"`). LpDisclosure is the ready-made header
 * plus body; LpShift eases a box whose content CHANGES; this one eases
 * content that comes and goes.
 *
 * Toggling mid-way reverses from where the box is, rather than snapping to an
 * end first. Padding and margins belong on the content inside, not on the
 * collapse itself: the box is measured and clipped, and its own padding would
 * still show when it is folded to zero.
 */
import { ref, watch } from "vue"
import { durationToken, easingToken, prefersReducedMotion } from "../composables/easing"

const props = withDefaults(
  defineProps<{
    /** Which dimension folds: `height` for a section, `width` for a side panel or a toolbar group, `both` for a corner pop-out. */
    axis?: "height" | "width" | "both"
    /** Fade the content along with the fold, so it does not show sliced while the box is small. */
    fade?: boolean
    /**
     * Keep the content in the DOM while closed (hidden), so its state survives:
     * a half-filled form, a scroll position, a playing preview. Off, it is
     * unmounted once folded away, like `v-if`.
     */
    keepMounted?: boolean
    /** With `keepMounted`, do not mount the content until it is first opened: an expensive body costs nothing until asked for. */
    lazy?: boolean
    /** Length of the fold in ms. Defaults to the kit's `--duration-medium`. */
    duration?: number
  }>(),
  { axis: "height", fade: true, keepMounted: false, lazy: false },
)

const emit = defineEmits<{
  /** The fold has finished opening. */
  (e: "opened"): void
  /** The fold has finished closing (and the content is unmounted, unless kept). */
  (e: "closed"): void
}>()

const open = defineModel<boolean>("open", { default: false })

/*
 * Mounted is separate from open: a closing box has to stay in the DOM until
 * its fold has played, and a kept one stays after that. Rendering it with
 * v-show under that v-if means a reopen during the close lands on the SAME
 * element, so the fold reverses from where it is instead of starting a new
 * box from zero beside the old one.
 */
let unmounting = false
const present = ref(open.value || (props.keepMounted && !props.lazy))
watch(open, (value) => {
  if (!value) return
  unmounting = false
  present.value = true
})

const running = new WeakMap<Element, Animation>()

type Size = { height: number; width: number; opacity: number }

function current(el: HTMLElement): Size {
  const rect = el.getBoundingClientRect()
  return { height: rect.height, width: rect.width, opacity: Number(getComputedStyle(el).opacity) }
}

function natural(el: HTMLElement): Size {
  return { height: el.scrollHeight, width: el.scrollWidth, opacity: 1 }
}

const ZERO: Size = { height: 0, width: 0, opacity: 0 }

function frame(size: Size): Keyframe {
  const out: Keyframe = {}
  if (props.axis !== "width") out.height = `${size.height}px`
  if (props.axis !== "height") out.width = `${size.width}px`
  if (props.fade) out.opacity = size.opacity
  return out
}

function fold(el: Element, opening: boolean, done: () => void) {
  const box = el as HTMLElement
  const previous = running.get(box)
  if (prefersReducedMotion() || typeof box.animate !== "function") {
    previous?.cancel()
    done()
    return
  }
  // Mid-fold, start from where the box is now; at rest, from the closed or open end.
  const from = previous ? current(box) : opening ? ZERO : natural(box)
  previous?.cancel()
  const to = opening ? natural(box) : ZERO
  box.style.overflow = "hidden"
  const animation = box.animate([frame(from), frame(to)], {
    duration: props.duration ?? durationToken("duration-medium"),
    easing: easingToken("ease-emphasized"),
    // Closing holds the folded frame until Vue hides the element, so it never flashes back open.
    fill: opening ? "none" : "forwards",
  })
  running.set(box, animation)
  animation.onfinish = () => {
    if (running.get(box) !== animation) return
    running.delete(box)
    box.style.overflow = ""
    done()
    if (!opening) animation.cancel()
  }
  animation.oncancel = () => {
    if (running.get(box) === animation) running.delete(box)
  }
}

function onEnter(el: Element, done: () => void) {
  fold(el, true, done)
}
/*
 * Unmounting after the fold is a second leave for the Transition, of an
 * element already hidden: it passes straight through, and is not reported as
 * a second close.
 */
function onLeave(el: Element, done: () => void) {
  if (unmounting) done()
  else fold(el, false, done)
}
function onAfterLeave() {
  if (unmounting) {
    unmounting = false
    return
  }
  if (!props.keepMounted && !open.value) {
    unmounting = true
    present.value = false
  }
  emit("closed")
}
</script>

<template>
  <Transition :css="false" @enter="onEnter" @leave="onLeave" @after-enter="emit('opened')" @after-leave="onAfterLeave">
    <div v-if="present" v-show="open" v-bind="$attrs">
      <slot />
    </div>
  </Transition>
</template>
