<script setup lang="ts">
/*
 * A phone app's bottom navigation: the main pages along the bottom edge, each
 * a real link (or a button that emits `select`), the current one marked by a
 * bar that slides between them, and "More" last for everything else.
 *
 * It looks exactly like LpTabs' bottom variant, sharing its bar and its tab
 * face, but it is navigation between pages, not tabs within one: links that a
 * screen reader announces as links, that open in a new tab when asked to, and
 * that need no router call from the app. LpAppShell shows one on phones with
 * `bottomNav`; an app with a shell of its own uses it directly.
 */
import { Motion } from "motion-v"
import { useId } from "vue"
import { usePillTransition } from "../composables/usePillTransition"
import { useLabels, useLinkComponent } from "../composables/useLpConfig"
import { resolveLink, type ResolvedLink } from "./link"
import LpTabFace from "./LpTabFace.vue"
import type { SidebarItem } from "./sidebar"
import { BOTTOM_BAR, BOTTOM_ITEM, BOTTOM_MARKER } from "./tabs"

const props = withDefaults(
  defineProps<{
    items: SidebarItem[]
    /** Active page id. Ignored when `isActive` is given. */
    modelValue?: string
    isActive?: (item: SidebarItem) => boolean
    /** A last "More" entry that emits `more` (the shell opens its drawer). */
    more?: boolean
    /** Marks "More" current: the page shown is one of those behind it. */
    moreActive?: boolean
    label?: string
    labels?: Partial<{ nav: string; more: string }>
  }>(),
  { more: false, moreActive: false },
)

const emit = defineEmits<{
  (e: "select", item: SidebarItem): void
  (e: "more"): void
}>()

const text = useLabels("bottomNav", { nav: "Main", more: "More" }, () => props.labels)
const linkComponent = useLinkComponent()
const pillTransition = usePillTransition()
const markerId = `lp-bottom-nav-${useId()}`

function active(item: SidebarItem): boolean {
  return props.isActive ? props.isActive(item) : item.id === props.modelValue
}

function rowOf(item: SidebarItem): ResolvedLink {
  const link = item.disabled ? null : resolveLink(linkComponent.value, { to: item.to, href: item.href })
  return link ?? { is: "button", props: { type: "button", disabled: item.disabled || undefined } }
}

const ROW = "relative flex items-center justify-center outline-none transition-[color,opacity] duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring"
</script>

<template>
  <nav :aria-label="label ?? text.nav" :class="BOTTOM_BAR">
    <component
      :is="rowOf(item).is"
      v-for="item in items"
      :key="item.id"
      v-bind="rowOf(item).props"
      :aria-current="active(item) ? 'page' : undefined"
      :class="[ROW, BOTTOM_ITEM, item.disabled ? 'cursor-not-allowed opacity-45' : active(item) ? 'text-brand' : 'text-muted']"
      @click="emit('select', item)"
    >
      <Motion v-if="active(item)" :layout-id="markerId" :transition="pillTransition" :class="[BOTTOM_MARKER, 'bg-brand']" />
      <LpTabFace :item="item" bottom :active="active(item)" />
    </component>
    <button
      v-if="more"
      type="button"
      :class="[ROW, BOTTOM_ITEM, moreActive ? 'text-brand' : 'text-muted']"
      @click="emit('more')"
    >
      <Motion v-if="moreActive" :layout-id="markerId" :transition="pillTransition" :class="[BOTTOM_MARKER, 'bg-brand']" />
      <LpTabFace :item="{ label: text.more, icon: 'lucide:menu' }" bottom :active="moreActive" />
    </button>
  </nav>
</template>
