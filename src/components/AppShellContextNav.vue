<script setup lang="ts">
/*
 * The row of sub-pages LpAppShell draws under its header where the rail is
 * gone. Internal: real links, as in LpBottomNav, so a sub-page opens in a new
 * tab when asked to and a screen reader announces where it leads.
 */
import { useLinkComponent } from "../composables/useLpConfig"
import { resolveLink, type ResolvedLink } from "./link"
import LpScrollStrip from "./LpScrollStrip.vue"
import type { SidebarItem } from "./sidebar"

const props = defineProps<{
  items: SidebarItem[]
  isActive: (item: SidebarItem) => boolean
  label: string
}>()

const emit = defineEmits<{ (e: "select", item: SidebarItem): void }>()

const linkComponent = useLinkComponent()

function rowOf(item: SidebarItem): ResolvedLink {
  const link = item.disabled ? null : resolveLink(linkComponent.value, { to: item.to, href: item.href })
  return link ?? { is: "button", props: { type: "button", disabled: item.disabled || undefined } }
}
</script>

<template>
  <LpScrollStrip as="nav" :aria-label="props.label" class="shrink-0 border-b border-line bg-surface" content-class="gap-1 px-4 py-1.5">
    <component
      :is="rowOf(item).is"
      v-for="item in items"
      :key="item.id"
      v-bind="rowOf(item).props"
      :aria-current="isActive(item) ? 'page' : undefined"
      :class="[
        'shrink-0 rounded-control px-2.5 py-1 text-sm font-medium outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring',
        item.disabled ? 'cursor-not-allowed opacity-45' : isActive(item) ? 'bg-surface-soft text-ink' : 'text-muted hover:text-ink',
      ]"
      @click="emit('select', item)"
    >
      {{ item.label }}
    </component>
  </LpScrollStrip>
</template>
