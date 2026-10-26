<script setup lang="ts">
/*
 * On-this-page table of contents with scroll-spy. Data-driven: pass the heading
 * tree (id + text, optional nested children) and it renders a rail of anchor
 * links, tracking which section is in view from heading positions and sliding
 * a brand indicator to it (motion-v shared layoutId — same feel as Tabs/Sidebar).
 *
 * The kit convention for a docs/article TOC so apps stop re-implementing the
 * scroll-spy + active-link math. Clicking a link smooth-scrolls to the heading and
 * marks it active immediately (so the pill doesn't lag the scroll).
 */
import { Motion } from "motion-v"
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { atScrollEnd, scrollParent } from "../composables/scroll"
import { usePillTransition } from "../composables/usePillTransition"

export interface TocLink {
  id: string
  text: string
  depth?: number
  children?: TocLink[]
}

const props = withDefaults(
  defineProps<{
    links: TocLink[]
    /** Heading shown above the list (defaults to the `title` label). */
    title?: string
    /**
     * The least distance, px from the top, of the scroll-spy trigger line. The
     * line sits at a quarter of the view when that is lower: a heading a
     * couple of lines down already starts what is being read, and a fixed line
     * near the top kept the previous section lit under it.
     */
    offset?: number
    labels?: Partial<{ title: string }>
    /**
     * The bar glides under the hovered link and springs back on leave (the
     * default), as in LpTabs. False pins it to the section in view: calmer for
     * a rail beside the text, which the pointer crosses on its way to scroll.
     */
    hoverFollow?: boolean
  }>(),
  { offset: 96, hoverFollow: true },
)

const text = useLabels("toc", { title: "On this page" }, () => props.labels)
const heading = computed(() => props.title ?? text.value.title)

// Every level of the tree as one ordered list; depth drives the indent, so
// links nested deeper than two levels render instead of vanishing.
interface TocRow {
  link: TocLink
  depth: number
}
function flatten(links: TocLink[], depth = 0): TocRow[] {
  return links.flatMap((link) => [{ link, depth }, ...flatten(link.children ?? [], depth + 1)])
}
const rows = computed(() => flatten(props.links))

const activeId = ref<string>("")
// The id the pointer is hovering (null when not hovering). The indicator bar
// follows the hovered link, falling back to the scroll-spy active one — same
// feel as LpTabs/LpSidebar.
const hoveredId = ref<string | null>(null)
const pillId = `lp-toc-${useId()}`
const pillTransition = usePillTransition()

// Which link the bar sits under: hovered wins, else the active (in-view) one.
const litId = computed(() => hoveredId.value ?? activeId.value)

// Flatten to the ordered list of ids we observe (parents + children).
function flatIds(links: TocLink[]): string[] {
  return links.flatMap((l) => [l.id, ...(l.children ? flatIds(l.children) : [])])
}

let stopSpy: (() => void) | null = null

// While a click-driven smooth scroll is in flight, freeze scroll-spy so the bar
// doesn't skip through every heading the page passes on the way to the target.
let spySuppressed = false
let rafId: number | null = null
let safetyTimer: ReturnType<typeof setTimeout> | null = null

/*
 * The current section is read from positions on every scroll, not from which
 * headings cross a thin band: a band misses the moment no heading is in it,
 * and scrolling back to the top then left the second section lit. The active
 * heading is the last one whose top has passed the offset line; above the
 * first, the first; at the very end of the scroll, the last, which a short
 * final section could otherwise never reach. Works for the window and for a
 * scroll area the headings live in.
 */
function setup() {
  stopSpy?.()
  stopSpy = null
  const ids = flatIds(props.links)
  if (!ids.length) return
  const first = document.getElementById(ids[0]!)
  const scroller = first ? scrollParent(first) : null
  let frame = 0

  const measure = () => {
    frame = 0
    if (spySuppressed) return
    const top = scroller ? scroller.getBoundingClientRect().top : 0
    const headings = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el)
    if (!headings.length) return
    let current = headings[0]!.id
    const view = scroller ? scroller.clientHeight : window.innerHeight
    const line = Math.max(props.offset, view / 4)
    for (const el of headings) if (el.getBoundingClientRect().top - top <= line + 1) current = el.id
    const scrolled = scroller ? scroller.scrollTop : window.scrollY
    const end = atScrollEnd(headings[0])
    if (scrolled > 0 && end) current = headings[headings.length - 1]!.id
    activeId.value = current
  }
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(measure)
  }
  const target: HTMLElement | Window = scroller ?? window
  target.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", onScroll)
  measure()
  stopSpy = () => {
    target.removeEventListener("scroll", onScroll)
    window.removeEventListener("resize", onScroll)
    if (frame) cancelAnimationFrame(frame)
  }
}

// Suppress scroll-spy until the smooth scroll settles. The unfreeze isn't on a
// fixed delay — we watch scrollY frame-by-frame (rAF) and stop the moment the
// position holds for a full frame. A long safety timeout is only a fallback so
// spy can never stay frozen forever if the scroll never starts or is cut short.
function unfreeze() {
  spySuppressed = false
  if (rafId != null) cancelAnimationFrame(rafId)
  if (safetyTimer != null) clearTimeout(safetyTimer)
  rafId = null
  safetyTimer = null
}

function suppressSpyUntilScrollEnds(target: HTMLElement) {
  spySuppressed = true
  if (rafId != null) cancelAnimationFrame(rafId)
  if (safetyTimer != null) clearTimeout(safetyTimer)
  const scroller = scrollParent(target)
  const position = () => (scroller ? scroller.scrollTop : window.scrollY)
  let last = position()
  const tick = () => {
    const y = position()
    if (y === last) {
      unfreeze() // position held for a frame → scrolling has come to rest
      return
    }
    last = y
    rafId = requestAnimationFrame(tick)
  }
  // Start on the next frame so the first sample isn't the pre-scroll y.
  rafId = requestAnimationFrame(tick)
  // Fallback: never stay frozen longer than any scroll could plausibly take.
  safetyTimer = setTimeout(unfreeze, 1000)
}

function onClick(id: string, ev: MouseEvent) {
  const el = document.getElementById(id)
  if (!el) return
  ev.preventDefault()
  activeId.value = id // mark immediately so the bar jumps to the clicked item
  suppressSpyUntilScrollEnds(el)
  el.scrollIntoView({ behavior: "smooth", block: "start" })
  // Keep the router's own state: replacing it with null broke scroll
  // restoration and back/forward bookkeeping in vue-router apps.
  history.replaceState(history.state, "", `#${id}`)
}

onMounted(setup)
watch(() => props.links, setup, { deep: true })
onBeforeUnmount(() => {
  stopSpy?.()
  unfreeze()
})
</script>

<template>
  <nav :aria-label="heading" class="text-sm">
    <p class="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
      {{ heading }}
    </p>
    <ul class="relative flex flex-col gap-0.5 border-l border-line" @mouseleave="hoveredId = null">
      <li v-for="{ link, depth } in rows" :key="link.id" class="flex flex-col">
        <a
          :href="`#${link.id}`"
          class="relative -ml-px block py-1 leading-snug transition-colors duration-[var(--duration-fast)]"
          :class="[
            depth > 0 ? 'text-[13px]' : '',
            litId === link.id ? 'text-brand' : 'text-muted hover:text-ink',
          ]"
          :style="{ paddingLeft: `${0.875 + depth * 0.875}rem` }"
          :aria-current="activeId === link.id ? 'location' : undefined"
          @click="onClick(link.id, $event)"
          @mouseenter="hoverFollow && (hoveredId = link.id)"
        >
          <Motion
            v-if="litId === link.id"
            :layout-id="pillId"
            :transition="pillTransition"
            class="absolute -left-px top-0 h-full w-0.5 rounded-full bg-brand"
          />
          {{ link.text }}
        </a>
      </li>
    </ul>
  </nav>
</template>
