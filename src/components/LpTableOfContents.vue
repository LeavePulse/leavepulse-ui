<script setup lang="ts">
/*
 * On-this-page table of contents with scroll-spy. Data-driven: pass the heading
 * tree (id + text, optional nested children) and it renders a rail of anchor
 * links, tracking which section is in view via IntersectionObserver and sliding
 * a brand indicator to it (motion-v shared layoutId — same feel as Tabs/Sidebar).
 *
 * The kit convention for a docs/article TOC so apps stop re-implementing the
 * observer + active-link math. Clicking a link smooth-scrolls to the heading and
 * marks it active immediately (so the pill doesn't lag the scroll).
 */
import { Motion } from "motion-v"
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { scrollParent } from "../composables/scroll"
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
    /** px offset from the top used as the scroll-spy trigger line. */
    offset?: number
    labels?: Partial<{ title: string }>
  }>(),
  { offset: 96 },
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

let observer: IntersectionObserver | null = null

// While a click-driven smooth scroll is in flight, freeze scroll-spy so the bar
// doesn't skip through every heading the page passes on the way to the target.
let spySuppressed = false
let rafId: number | null = null
let safetyTimer: ReturnType<typeof setTimeout> | null = null

function setup() {
  observer?.disconnect()
  const ids = flatIds(props.links)
  if (!ids.length) return

  // Track the topmost heading whose top has crossed the offset line. We keep a
  // set of "currently intersecting" and, on every change, pick the first id in
  // document order that's visible — falling back to the last one scrolled past.
  const visible = new Set<string>()
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target.id)
        else visible.delete(e.target.id)
      }
      if (spySuppressed) return // ignore intermediate sections during a click-scroll
      const firstVisible = ids.find((id) => visible.has(id))
      if (firstVisible) activeId.value = firstVisible
    },
    { rootMargin: `-${props.offset}px 0px -70% 0px`, threshold: 0 },
  )

  for (const id of ids) {
    const el = document.getElementById(id)
    if (el) observer.observe(el)
  }
  // Seed the initial active id (top-most heading) so the bar isn't empty.
  if (!activeId.value) activeId.value = ids[0] ?? ""
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
  observer?.disconnect()
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
          @mouseenter="hoveredId = link.id"
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
