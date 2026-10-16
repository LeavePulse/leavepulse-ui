<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { computed, type Component } from "vue"
import LpIcon from "./LpIcon.vue"
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

// The trail sets its own gap, which a dense header bar needs to reduce.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex min-w-0 items-center gap-1.5 text-sm",
)
</script>

<template>
  <!-- One line however long the labels: the earlier crumbs keep their size
       and the current one gives way with an ellipsis. Wrapping, a long name
       pushed the trail onto three lines over whatever bar held it. -->
  <nav :aria-label="text.nav" class="min-w-0" v-bind="rest">
    <ol :class="rootClass">
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
          <span class="truncate">{{ item.label }}</span>
        </component>
        <span
          v-else
          class="inline-flex min-w-0 items-center gap-1.5"
          :class="last ? 'text-ink' : 'text-muted'"
          :aria-current="last ? 'page' : undefined"
        >
          <LpIcon v-if="item.icon" :name="item.icon" :size="14" />
          <span class="truncate">{{ item.label }}</span>
        </span>
      </li>
    </ol>
  </nav>
</template>
