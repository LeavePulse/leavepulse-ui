<script lang="ts">
// The consumer's `class` is merged into the iframe's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * A window of its own inside the page, as LpThemeProvider is a theme of its
 * own: what is rendered in it behaves as if it were the whole screen. It is
 * an iframe the slot is teleported into, so the content stays part of the
 * same app (its state, theme, config and labels are the page's) while:
 *
 * - its width is the viewport: CSS breakpoints (`sm:`, `max-sm:`) and the
 *   kit's own media queries answer for the frame, so a frame narrowed to a
 *   phone gets the phone layout, a tour's bottom sheet included;
 * - the kit's overlays (modals, popovers, menus, the tour, toasts) open
 *   inside it, not over the page;
 * - a click outside the frame is not "outside" for what is open in it: a
 *   notification feed stays open while the page around it is used, and
 *   Escape pressed on the page does not close it.
 *
 * The page's stylesheets and the root element's theme are mirrored into the
 * frame and kept in step (hot reloads and theme switches included). A modal
 * in the frame would lock the page's scroll and pointer (reka locks the
 * global body); the frame lifts such a lock while the page itself has no
 * layer open. Its height follows the content unless `height` fixes it, which
 * a screen-sized demo wants: a frame as tall as its content gives a modal
 * nothing to centre in.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue"
import { useMergedAttrs } from "../composables/useMergedClass"
import { forwardViewEvents, provideView, type LpView } from "../composables/useView"

const props = withDefaults(
  defineProps<{
    /** Fixed height (px or any CSS length). Without it the frame grows with its content. */
    height?: number | string
    /** Read by assistive technology for the frame as a whole. */
    title?: string
  }>(),
  { title: "Preview" },
)

const frame = ref<HTMLIFrameElement | null>(null)
const view = shallowRef<LpView | null>(null)
provideView(computed(() => view.value))

const contentHeight = ref(0)
const fixed = computed(() =>
  props.height === undefined ? undefined : typeof props.height === "number" ? `${props.height}px` : props.height,
)

// Height eases, so a frame switched to a device screen or grown by an
// opening popover does not jump.
const { class: frameClass, attrs: rest } = useMergedAttrs(
  "block w-full border-0 bg-transparent transition-[height] duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none",
)

const cleanups: (() => void)[] = []

function mirrorHead(doc: Document) {
  const copies = new Map<Node, Node>()
  const copy = (node: Node) => {
    if (!(node instanceof HTMLStyleElement || (node instanceof HTMLLinkElement && node.rel === "stylesheet"))) return
    const clone = doc.importNode(node, true)
    copies.set(node, clone)
    doc.head.appendChild(clone)
  }
  for (const node of document.head.childNodes) copy(node)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") {
        for (const node of record.addedNodes) copy(node)
        for (const node of record.removedNodes) {
          copies.get(node)?.parentNode?.removeChild(copies.get(node)!)
          copies.delete(node)
        }
        continue
      }
      // A style rewritten in place (a hot reload) is copied again.
      const style = record.target instanceof HTMLStyleElement ? record.target : record.target.parentNode
      if (style instanceof HTMLStyleElement && copies.has(style)) copies.get(style)!.textContent = style.textContent
    }
  })
  observer.observe(document.head, { childList: true, subtree: true, characterData: true })
  cleanups.push(() => observer.disconnect())
}

// The theme lives on the page's root element (its class, data attributes and
// token variables); the frame's root carries the same, so it themes as one.
function mirrorRoot(doc: Document) {
  const sync = () => {
    const from = document.documentElement
    const to = doc.documentElement
    for (const name of to.getAttributeNames()) if (!from.hasAttribute(name)) to.removeAttribute(name)
    for (const name of from.getAttributeNames()) to.setAttribute(name, from.getAttribute(name) ?? "")
  }
  sync()
  const observer = new MutationObserver(sync)
  observer.observe(document.documentElement, { attributes: true })
  cleanups.push(() => observer.disconnect())
}

// reka's modal locks `document.body` of the page whatever document the layer
// is in. The lock is the page's only when the page has a layer of its own.
function liftForeignLocks(doc: Document) {
  const lift = () => {
    if (!doc.querySelector("[data-dismissable-layer]")) return
    if (document.querySelector("[data-dismissable-layer]")) return
    const style = document.body.style
    if (style.pointerEvents === "none") style.pointerEvents = ""
    if (style.overflow === "hidden") {
      style.overflow = ""
      style.paddingRight = ""
      style.marginRight = ""
    }
  }
  const observer = new MutationObserver(lift)
  observer.observe(document.body, { attributes: true, attributeFilter: ["style"] })
  cleanups.push(() => observer.disconnect())
}

function setup() {
  const win = frame.value?.contentWindow
  const doc = frame.value?.contentDocument
  if (!win || !doc) return
  // Relative URLs in the copied styles (fonts, images) resolve against the page.
  const base = doc.createElement("base")
  base.href = document.baseURI
  doc.head.appendChild(base)
  doc.body.style.margin = "0"
  doc.body.style.background = "transparent"
  mirrorHead(doc)
  mirrorRoot(doc)
  liftForeignLocks(doc)
  cleanups.push(forwardViewEvents(doc, document))
  const content = doc.createElement("div")
  doc.body.appendChild(content)
  // Grown to fit the content and whatever is open over it: a popover hanging
  // below the last line would otherwise be cut off at the frame's edge.
  let pending = 0
  const measure = () => {
    pending = 0
    let bottom = content.offsetHeight
    for (const child of doc.body.children) {
      if (child === content) continue
      for (const layer of child.querySelectorAll("[data-dismissable-layer], [role=dialog], [role=menu], [role=listbox]")) {
        bottom = Math.max(bottom, Math.ceil(layer.getBoundingClientRect().bottom + 8))
      }
    }
    contentHeight.value = bottom
  }
  const schedule = () => {
    if (!pending) pending = win.requestAnimationFrame(measure)
  }
  const Observer = (win as Window & typeof globalThis).ResizeObserver
  const resize = new Observer(schedule)
  resize.observe(content)
  const layers = new (win as Window & typeof globalThis).MutationObserver(schedule)
  layers.observe(doc.body, { childList: true, subtree: true })
  cleanups.push(() => {
    resize.disconnect()
    layers.disconnect()
    if (pending) win.cancelAnimationFrame(pending)
  })
  view.value = { window: win, document: doc, portal: doc.body }
  root.value = content
}

const root = shallowRef<HTMLElement | null>(null)

onMounted(() => {
  const el = frame.value
  if (!el) return
  // about:blank is ready synchronously in Chromium and WebKit, but Firefox
  // swaps the document on load: wait for it there.
  if (el.contentDocument?.readyState === "complete") setup()
  else el.addEventListener("load", setup, { once: true })
})

onBeforeUnmount(() => {
  for (const clean of cleanups) clean()
  cleanups.length = 0
})
</script>

<template>
  <iframe
    ref="frame"
    :title="title"
    :class="frameClass"
    :style="{ height: fixed ?? `${contentHeight}px` }"
    v-bind="rest"
  />
  <Teleport v-if="root" :to="root">
    <slot />
  </Teleport>
</template>
