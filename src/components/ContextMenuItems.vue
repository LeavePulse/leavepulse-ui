<script setup lang="ts">
/*
 * The rows of an LpContextMenu panel, rendering itself for every submenu so
 * `children` nests to any depth. Internal: not exported.
 */
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "reka-ui"
import type { ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"

defineOptions({ name: "ContextMenuItems" })

defineProps<{
  items: ContextMenuItemDef[]
  panel: string
}>()

const ITEM =
  "group/item flex cursor-pointer select-none items-center gap-2 rounded-inner px-2.5 py-1.5 text-sm outline-none transition-[background-color,color] duration-[var(--duration-fast)] data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-brand-soft"
const ICON =
  "transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-data-[highlighted]/item:translate-x-0.5"
</script>

<template>
  <template v-for="(item, i) in items" :key="i">
    <ContextMenuSeparator v-if="item.separatorBefore" class="my-1 h-px bg-line" />

    <ContextMenuSub v-if="item.children?.length">
      <ContextMenuSubTrigger
        :class="[ITEM, 'justify-between text-ink data-[highlighted]:text-brand data-[state=open]:bg-brand-soft data-[state=open]:text-brand']"
        :disabled="item.disabled"
      >
        <span class="flex items-center gap-2">
          <LpIcon v-if="item.icon" :name="item.icon" :size="15" :class="ICON" />
          {{ item.label }}
        </span>
        <LpIcon name="lucide:chevron-right" :size="14" class="text-muted" />
      </ContextMenuSubTrigger>
      <ContextMenuPortal>
        <ContextMenuSubContent :collision-padding="8" :class="panel" :side-offset="2" :align-offset="-4">
          <ContextMenuItems :items="item.children" :panel="panel" />
        </ContextMenuSubContent>
      </ContextMenuPortal>
    </ContextMenuSub>

    <!-- Tick-box item: a real checkbox item, so assistive tech hears its state.
         `@select.prevent` keeps the menu open, since these come in lists where
         several are set in one visit. The tick occupies a fixed slot so
         unticked rows stay aligned with ticked ones. -->
    <ContextMenuCheckboxItem
      v-else-if="item.checked !== undefined"
      :model-value="item.checked"
      :class="[ITEM, 'justify-between text-ink data-[highlighted]:text-brand']"
      :disabled="item.disabled"
      @select.prevent="item.onSelect?.()"
    >
      <span class="flex items-center gap-2">
        <LpIcon
          :name="item.checked ? 'lucide:check' : 'lucide:minus'"
          :size="15"
          :class="[ICON, item.checked ? '' : 'opacity-25']"
        />
        {{ item.label }}
      </span>
      <kbd v-if="item.shortcut" class="text-xs text-muted">{{ item.shortcut }}</kbd>
    </ContextMenuCheckboxItem>

    <ContextMenuItem
      v-else
      :class="[ITEM, 'justify-between', item.danger ? 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger' : 'text-ink data-[highlighted]:text-brand']"
      :disabled="item.disabled"
      @select="item.onSelect?.()"
    >
      <span class="flex items-center gap-2">
        <LpIcon v-if="item.icon" :name="item.icon" :size="15" :class="ICON" />
        {{ item.label }}
      </span>
      <kbd v-if="item.shortcut" class="text-xs text-muted">{{ item.shortcut }}</kbd>
    </ContextMenuItem>
  </template>
</template>
