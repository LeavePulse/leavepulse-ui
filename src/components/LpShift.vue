<script setup lang="ts">
/*
 * Wraps content whose size is derived from what's inside it, so that everything
 * around it shifts smoothly instead of jumping.
 *
 * Reach for it wherever a change of content changes a box's measurements: a
 * toolbar that gains or loses a button, a label swapped by a translation, a
 * placeholder replaced by the loaded thing, a validation message appearing
 * under a field. Those all resize in a single frame otherwise, and everything
 * they push jolts with them.
 *
 *   <LpShift axis="width">
 *     <slot name="actions" />
 *   </LpShift>
 *
 * Note it is the NEIGHBOURS that motivate this, not the box: a fixed-height
 * header never resizes, yet its controls jump whenever one of them changes
 * width. Easing that one box is what makes the row glide.
 *
 * Content is measured through a wrapper that is never itself pinned, so the
 * slot keeps whatever layout it brings (flex row, grid, plain text). `axis`
 * picks which dimension is content-derived: pin only the one that actually
 * moves, so the other stays free to respond to the surrounding layout.
 *
 * The mechanism — measure the natural size, pin it in pixels, tween — lives in
 * `useShift`, and LpModal drives its panel with the same composable.
 */
import { computed, onBeforeUnmount, watch } from "vue"
import { prefersReducedMotion } from "../composables/easing"
import { useShift, type ShiftAxis } from "../composables/useShift"

const props = withDefaults(
  defineProps<{
    /**
     * Which dimension eases. `"width"` for a row that gains/loses controls,
     * `"height"` for a stack whose content grows, `"both"` when either can.
     */
    axis?: ShiftAxis
    /** Tween length in ms. Defaults to the kit's `--duration-fast`. */
    duration?: number
    /**
     * Turn the easing off entirely — the wrapper stays, the box resizes
     * instantly. For a box that is being driven by something else (a drag, a
     * canvas), where a tween would fight the thing already animating it.
     */
    disabled?: boolean
    /**
     * Which edge the content holds to while the box catches up, for a flex
     * row. A box pinned to the right (`ml-auto`) grows leftwards, and content
     * laid out from its left edge throws every unchanged control to the right
     * for the first frame and slides it back: the controls that did not change
     * are the ones that jump. `"end"` keeps them where they are and lets the
     * new one come in from the free side.
     */
    anchor?: "start" | "end"
    /**
     * Fade the box's own children in and out as they come and go. Without it
     * the box glides but a control still pops into being as the edge uncovers
     * it, and one that leaves is gone in a frame while its space closes up.
     * Only direct children: what a child does inside itself is its own affair,
     * so a control that changes its label carries the label as its `key` and
     * is replaced, the old one fading as the new one arrives.
     */
    presence?: boolean
  }>(),
  { axis: "height", disabled: false, anchor: "start", presence: false },
)

const { el, tweening, resizing } = useShift({
  axis: () => props.axis,
  duration: () => props.duration,
  enabled: () => !props.disabled,
})

// Only the pinned axis is transitioned: naming the other one would animate a
// dimension the layout is still free to set, so a flex row settling into place
// would ease sideways for no reason.
//
// Spelled out as whole literals rather than built from `axis`. The consuming
// app's Tailwind scans this file as TEXT, so a class assembled at runtime is a
// class it never sees — the utility simply wouldn't be emitted.
const TRANSITION_CLASS: Record<ShiftAxis, string> = {
  height: "transition-[height]",
  width: "transition-[width]",
  both: "transition-[height,width]",
}
const transitionClass = computed(() => TRANSITION_CLASS[props.axis])

/*
 * Presence. A leaving element is already out of the DOM when the observer
 * hears of it, so where it stood is read from the last time it was seen: its
 * offset from the anchored edge, which stays true while the box eases towards
 * that edge. A clone stands there, out of the flow, and fades.
 *
 * What stays but is moved by the change (a title centred in a box that just
 * lost its subtitle) glides from where it was instead of jumping (FLIP).
 */
const PRESENCE_MS = 200
const MOVE_MS = 160
const EASE = "cubic-bezier(0.2, 0, 0, 1)"
const GHOST = "data-lp-shift-ghost"

interface Seen {
  from: number
  top: number
  width: number
  height: number
  x: number
  y: number
}

const seen = new WeakMap<Element, Seen>()
let presenceObserver: MutationObserver | undefined
let rememberTimer: ReturnType<typeof setTimeout> | undefined
let presenceSize: ResizeObserver | undefined

function rememberSoon(box: HTMLElement, wait = PRESENCE_MS + 80) {
  clearTimeout(rememberTimer)
  rememberTimer = setTimeout(() => remember(box), wait)
}

function elementsOf(box: HTMLElement): Element[] {
  return [...box.querySelectorAll("*")].filter((node) => !node.closest(`[${GHOST}]`) && !(node instanceof SVGElement && !(node instanceof SVGSVGElement)))
}

function remember(box: HTMLElement) {
  const outer = box.getBoundingClientRect()
  for (const node of elementsOf(box)) {
    const r = node.getBoundingClientRect()
    seen.set(node, {
      from: props.anchor === "end" ? outer.right - r.right : r.left - outer.left,
      top: r.top - outer.top,
      width: r.width,
      height: r.height,
      x: r.left,
      y: r.top,
    })
  }
}

const offset = () => (props.anchor === "end" ? -6 : 6)

function ghost(box: HTMLElement, node: Element) {
  const at = seen.get(node)
  if (!at || !(node instanceof HTMLElement) || node.hasAttribute(GHOST) || at.width === 0) return
  const copy = node.cloneNode(true) as HTMLElement
  copy.setAttribute(GHOST, "")
  copy.setAttribute("aria-hidden", "true")
  copy.inert = true
  Object.assign(copy.style, {
    position: "absolute",
    top: `${at.top}px`,
    [props.anchor === "end" ? "right" : "left"]: `${at.from}px`,
    width: `${at.width}px`,
    height: `${at.height}px`,
    margin: "0",
    pointerEvents: "none",
  })
  box.appendChild(copy)
  copy
    .animate(
      [
        { opacity: 1, transform: "none", filter: "blur(0)" },
        { opacity: 0, transform: `translateX(${offset()}px) scale(0.96)`, filter: "blur(2px)" },
      ],
      { duration: PRESENCE_MS, easing: EASE },
    )
    .finished.catch(() => undefined)
    .finally(() => copy.remove())
}

function arrive(node: Element) {
  if (!(node instanceof HTMLElement) || node.hasAttribute(GHOST)) return
  node.animate(
    [
      { opacity: 0, transform: `translateX(${offset()}px) scale(0.96)`, filter: "blur(2px)" },
      { opacity: 1, transform: "none", filter: "blur(0)" },
    ],
    { duration: PRESENCE_MS, delay: 40, easing: EASE, fill: "backwards" },
  )
}

function glide(node: Element) {
  const was = seen.get(node)
  if (!was || !(node instanceof HTMLElement)) return
  const now = node.getBoundingClientRect()
  const dx = was.x - now.left
  const dy = was.y - now.top
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
  node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: MOVE_MS, easing: EASE })
}

watch(
  [el, () => props.presence && !props.disabled],
  ([box, on]) => {
    presenceObserver?.disconnect()
    presenceObserver = undefined
    presenceSize?.disconnect()
    presenceSize = undefined
    if (!box || !on) return
    remember(box)
    presenceObserver = new MutationObserver((records) => {
      const real = records.filter(
        (r) =>
          ![...r.addedNodes, ...r.removedNodes].every((n) => n instanceof Element && n.hasAttribute(GHOST)),
      )
      if (real.length && !prefersReducedMotion()) {
        const added = new Set<Node>()
        for (const record of real) {
          record.removedNodes.forEach((node) => node instanceof Element && ghost(box, node))
          record.addedNodes.forEach((node) => {
            added.add(node)
            if (node instanceof Element) arrive(node)
          })
        }
        // Measured in the next frame, which still comes before the paint: by
        // then the box has taken the classes the change gave it (held to its
        // edge), and the place an element lands is the one it will keep.
        const parents = real.map((r) => r.target).filter((t): t is Element => t instanceof Element && !t.hasAttribute(GHOST))
        requestAnimationFrame(() => {
          for (const parent of parents) for (const child of parent.children) if (!added.has(child)) glide(child)
        })
      }
      rememberSoon(box)
    })
    presenceObserver.observe(box, { childList: true, subtree: true })
    presenceSize = new ResizeObserver(() => rememberSoon(box, 60))
    presenceSize.observe(box)
    void document.fonts?.ready.then(() => rememberSoon(box, 0))
  },
  { flush: "post" },
)

// A child that changed inside itself (a label rolling to a longer word) moves
// its neighbours without any child coming or going: when the box starts to
// resize, every child glides from where it was last seen.
watch(resizing, (now) => {
  const box = el.value
  if (!now || !box || !presenceObserver || prefersReducedMotion()) return
  requestAnimationFrame(() => {
    for (const child of box.children) if (!child.hasAttribute(GHOST)) glide(child)
  })
})

onBeforeUnmount(() => {
  presenceObserver?.disconnect()
  presenceSize?.disconnect()
  clearTimeout(rememberTimer)
})

defineExpose({ resizing })
</script>

<template>
  <!-- `overflow-hidden` only while a tween owns the size: the box is briefly
       smaller than the content it already holds, and without the clip that
       content spills past the easing edge. Dropped once settled, so nothing
       that legitimately overflows — a dropdown, a focus ring — is clipped at
       rest. -->
  <div
    ref="el"
    :class="[
      tweening && !disabled
        ? `${transitionClass} duration-fast ease-[var(--ease-emphasized)] motion-reduce:transition-none`
        : '',
      resizing ? 'overflow-hidden' : '',
      // While the box holds a width its content has outgrown, a flex row would
      // squeeze its children to fit (a button's keys folding into a column)
      // instead of letting the easing edge clip them.
      resizing && axis !== 'height' ? '[&>*]:shrink-0' : '',
      resizing && anchor === 'end' ? 'justify-end' : '',
      presence ? 'relative' : '',
    ]"
  >
    <slot :resizing="resizing" />
  </div>
</template>
