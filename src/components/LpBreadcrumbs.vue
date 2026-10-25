<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { computed, ref, watch, type Component } from "vue"
import LpIcon from "./LpIcon.vue"
import LpRollingText from "./LpRollingText.vue"
import LpShift from "./LpShift.vue"
import { useLabels, useLinkComponent } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { resolveLink } from "./link"

export interface Crumb {
  label: string
  href?: string
  /** Destination for router links; rendered through the link component. */
  to?: string | Record<string, unknown>
  /** Leading icon, for crumbs that carry a glyph (a home root, a section). */
  icon?: string
}

const props = defineProps<{
  items: Crumb[]
  /**
   * Component for linked crumbs. By default `to` and internal `href` use the
   * link component from provideLpConfig and other hrefs a plain <a>.
   */
  as?: string | Component
  labels?: Partial<{ nav: string }>
}>()
defineEmits<{ (e: "navigate", item: Crumb, index: number): void }>()

const text = useLabels("breadcrumbs", { nav: "Breadcrumb" }, () => props.labels)
const linkComponent = useLinkComponent()

function linkOf(item: Crumb) {
  if (props.as && props.as !== "a") {
    if (item.to != null) return { is: props.as, props: { to: item.to } }
    return item.href != null ? { is: "a", props: { href: item.href } } : null
  }
  return resolveLink(props.as === "a" ? "a" : linkComponent.value, { to: item.to, href: item.href })
}

const crumbs = computed(() =>
  props.items.map((item, i) => ({
    item,
    last: i === props.items.length - 1,
    link: i === props.items.length - 1 ? null : linkOf(item),
  })),
)

/*
 * A crumb on its way out is lifted out of the row where it stands. Left in
 * the flow it would hold the row at its old width until it had faded, and the
 * trail would shrink only afterwards, in a second step; out of the flow the
 * row starts easing to its new width (LpShift) at once and clips the leaver
 * as it fades. Pinned at its own offset because an absolute flex item
 * otherwise jumps to the start of the row.
 *
 * The offsets are read before the update rather than as each crumb leaves: a
 * trail cut short by two crumbs lifts them one after the other, and the
 * second, measured after the first had left the flow, slid into its slot.
 * Lifting synchronously, during the patch, also keeps LpShift's first
 * measurement on the row as it was.
 */
const list = ref<{ $el: HTMLElement } | null>(null)
const spots = new WeakMap<Element, [number, number]>()

// `crumbs` rather than `items`: a trail pushed to in place is the same array.
watch(
  crumbs,
  () => {
    for (const crumb of Array.from(list.value?.$el.children ?? [])) {
      if (crumb instanceof HTMLElement) spots.set(crumb, [crumb.offsetLeft, crumb.offsetTop])
    }
  },
  { flush: "pre" },
)

function liftLeaving(el: Element) {
  const crumb = el as HTMLElement
  const [left, top] = spots.get(crumb) ?? [crumb.offsetLeft, crumb.offsetTop]
  crumb.style.left = `${left}px`
  crumb.style.top = `${top}px`
  crumb.style.position = "absolute"
  crumb.style.pointerEvents = "none"
}

// The trail sets its own gap, which a dense header bar needs to reduce.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex min-w-0 items-center gap-1.5 text-sm",
)
</script>

<template>
  <!-- One line however long the labels: the earlier crumbs keep their size
       and the current one gives way with an ellipsis. Wrapping, a long name
       pushed the trail onto three lines over whatever bar held it.

       A trail that changes depth reads as motion rather than a redraw: crumbs
       fade and slide in or out with their separator, the row eases to its new
       width (LpShift) so whatever sits beside or centres it glides, and a
       crumb whose label changes in place rolls to the new one.

       The nav is a flex row so the LpShift box is sized to the trail rather
       than to the bar, and is held to the bar by shrinking (`min-w-0`), not
       by a `max-width`: LpShift measures with any max-* lifted, so a clamped
       trail never matched its settled size and re-tweened on every render.

       Keyed by depth: the crumb at depth 2 renamed is the same crumb with a
       new name, not a new crumb. Crumbs therefore only ever join or leave at
       the end, and there is no move class: a FLIP offset measured against
       the row's new width fought LpShift holding it at the old one, and the
       trail lurched sideways for a frame before gliding back. -->
  <nav :aria-label="text.nav" class="flex min-w-0" v-bind="rest">
    <LpShift axis="width" class="min-w-0">
      <TransitionGroup
        ref="list"
        tag="ol"
        :class="[rootClass, 'relative']"
        enter-active-class="transition-[opacity,translate] duration-fast ease-[var(--ease-emphasized)] motion-reduce:transition-none"
        enter-from-class="-translate-x-1 opacity-0"
        leave-active-class="transition-[opacity,translate] duration-fast ease-[var(--ease-emphasized)] motion-reduce:transition-none"
        leave-to-class="-translate-x-1 opacity-0"
        @before-leave="liftLeaving"
      >
        <li
          v-for="({ item, last, link }, i) in crumbs"
          :key="i"
          class="inline-flex min-w-0 items-center gap-1.5"
          :class="last ? 'shrink' : 'shrink-0'"
        >
          <LpIcon
            v-if="i > 0"
            name="lucide:chevron-right"
            :size="14"
            class="shrink-0 text-muted"
            aria-hidden="true"
          />
          <component
            :is="link.is"
            v-if="link"
            v-bind="link.props"
            class="inline-flex min-w-0 items-center gap-1.5 rounded-xs text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
            @click="$emit('navigate', item, i)"
          >
            <LpIcon v-if="item.icon" :name="item.icon" :size="14" />
            <LpRollingText :value="item.label" align="start" class="min-w-0" />
          </component>
          <span
            v-else
            class="inline-flex min-w-0 items-center gap-1.5"
            :class="last ? 'text-ink' : 'text-muted'"
            :aria-current="last ? 'page' : undefined"
          >
            <LpIcon v-if="item.icon" :name="item.icon" :size="14" />
            <LpRollingText :value="item.label" align="start" class="min-w-0" />
          </span>
        </li>
      </TransitionGroup>
    </LpShift>
  </nav>
</template>
