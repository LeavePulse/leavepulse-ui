<script setup lang="ts">
/*
 * The rows of a menu panel, rendering itself for every submenu so `children`
 * nests to any depth. Internal: not exported.
 *
 * One renderer for both menus. LpContextMenu (right click) and LpDropdownMenu
 * (the "…" button) take the same items, and a row often offers both, so the
 * two must draw the same array the same way. While the dropdown had a renderer
 * of its own, the "…" menu silently dropped the submenus, ticks and shortcuts
 * the right-click menu showed. reka gives each menu its own primitives (each
 * reads its own root's context), so `kind` picks the family and the markup
 * stays shared.
 */
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "reka-ui"
import { computed } from "vue"
import type { ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"
import MenuShortcut from "./MenuShortcut.vue"

defineOptions({ name: "ContextMenuItems" })

const props = withDefaults(
  defineProps<{
    items: ContextMenuItemDef[]
    panel: string
    /** Which reka menu family the rows belong to. */
    kind?: "context" | "dropdown"
  }>(),
  { kind: "context" },
)

const PRIMITIVES = {
  context: {
    Item: ContextMenuItem,
    CheckboxItem: ContextMenuCheckboxItem,
    Separator: ContextMenuSeparator,
    Sub: ContextMenuSub,
    SubTrigger: ContextMenuSubTrigger,
    SubContent: ContextMenuSubContent,
    Portal: ContextMenuPortal,
  },
  dropdown: {
    Item: DropdownMenuItem,
    CheckboxItem: DropdownMenuCheckboxItem,
    Separator: DropdownMenuSeparator,
    Sub: DropdownMenuSub,
    SubTrigger: DropdownMenuSubTrigger,
    SubContent: DropdownMenuSubContent,
    Portal: DropdownMenuPortal,
  },
} as const

const P = computed(() => PRIMITIVES[props.kind])

const ITEM =
  "group/item flex cursor-pointer select-none items-center gap-2 rounded-inner px-2.5 py-1.5 text-sm outline-none transition-[background-color,color] duration-[var(--duration-fast)] data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-brand-soft"
const ICON =
  "transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-data-[highlighted]/item:translate-x-0.5"
</script>

<template>
  <template v-for="(item, i) in items" :key="i">
    <component :is="P.Separator" v-if="item.separatorBefore" class="my-1 h-px bg-line" />

    <component :is="P.Sub" v-if="item.children?.length">
      <component
        :is="P.SubTrigger"
        :class="[ITEM, 'justify-between text-ink data-[highlighted]:text-brand data-[state=open]:bg-brand-soft data-[state=open]:text-brand']"
        :disabled="item.disabled"
      >
        <span class="flex items-center gap-2">
          <LpIcon v-if="item.icon" :name="item.icon" :size="15" :class="ICON" />
          {{ item.label }}
        </span>
        <LpIcon name="lucide:chevron-right" :size="14" class="text-muted" />
      </component>
      <component :is="P.Portal">
        <component :is="P.SubContent" :collision-padding="8" :class="panel" :side-offset="2" :align-offset="-4">
          <ContextMenuItems :items="item.children" :panel="panel" :kind="kind" />
        </component>
      </component>
    </component>

    <!-- Tick-box item: a real checkbox item, so assistive tech hears its state.
         `@select.prevent` keeps the menu open, since these come in lists where
         several are set in one visit. The tick occupies a fixed slot so
         unticked rows stay aligned with ticked ones. -->
    <component
      :is="P.CheckboxItem"
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
      <MenuShortcut v-if="item.shortcut" :combo="item.shortcut" />
    </component>

    <component
      :is="P.Item"
      v-else
      :class="[ITEM, 'justify-between', item.danger ? 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger' : 'text-ink data-[highlighted]:text-brand']"
      :disabled="item.disabled"
      @select="item.onSelect?.()"
    >
      <span class="flex items-center gap-2">
        <LpIcon v-if="item.icon" :name="item.icon" :size="15" :class="ICON" />
        {{ item.label }}
      </span>
      <MenuShortcut v-if="item.shortcut" :combo="item.shortcut" />
    </component>
  </template>
</template>
