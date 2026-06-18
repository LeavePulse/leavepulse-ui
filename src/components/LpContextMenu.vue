<script setup lang="ts">
/*
 * Right-click context menu (reka ContextMenu). Same item shape as
 * LpDropdownMenu, plus nested submenus (`children`) and a shortcut hint. The
 * trigger is whatever you put in the default slot — right-clicking it (or
 * long-press on touch) opens the menu at the pointer. Shares the floating-panel
 * surface + option-row look with the rest of the kit via dropdown.ts.
 */
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "reka-ui"
import { POPOVER_PANEL } from "./dropdown"
import LpIcon from "./LpIcon.vue"

export interface ContextMenuItemDef {
  label: string
  icon?: string
  /** Right-aligned hint, e.g. "⌘C". */
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  separatorBefore?: boolean
  onSelect?: () => void
  /** Nested submenu. When present, onSelect is ignored. */
  children?: ContextMenuItemDef[]
}

defineProps<{ items: ContextMenuItemDef[] }>()

const PANEL = `${POPOVER_PANEL} z-(--z-popover) min-w-48 p-1 outline-none`
const ITEM =
  "group/item flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none transition-[background-color,color] duration-[var(--duration-fast)] data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-brand-soft"
const ICON =
  "transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-data-[highlighted]/item:translate-x-0.5"
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent :class="PANEL">
        <template v-for="(item, i) in items" :key="i">
          <ContextMenuSeparator v-if="item.separatorBefore" class="my-1 h-px bg-line" />

          <!-- Submenu branch -->
          <ContextMenuSub v-if="item.children?.length">
            <ContextMenuSubTrigger
              :class="[ITEM, 'justify-between text-ink data-[highlighted]:text-brand data-[state=open]:bg-brand-soft data-[state=open]:text-brand']"
            >
              <span class="flex items-center gap-2">
                <LpIcon v-if="item.icon" :name="item.icon" :size="15" :class="ICON" />
                {{ item.label }}
              </span>
              <LpIcon name="lucide:chevron-right" :size="14" class="text-muted" />
            </ContextMenuSubTrigger>
            <ContextMenuPortal>
              <ContextMenuSubContent :class="PANEL" :side-offset="2" :align-offset="-4">
                <template v-for="(sub, j) in item.children" :key="j">
                  <ContextMenuSeparator v-if="sub.separatorBefore" class="my-1 h-px bg-line" />
                  <ContextMenuItem
                    :class="[ITEM, 'justify-between', sub.danger ? 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger' : 'text-ink data-[highlighted]:text-brand']"
                    :disabled="sub.disabled"
                    @select="sub.onSelect?.()"
                  >
                    <span class="flex items-center gap-2">
                      <LpIcon v-if="sub.icon" :name="sub.icon" :size="15" :class="ICON" />
                      {{ sub.label }}
                    </span>
                    <kbd v-if="sub.shortcut" class="text-xs text-muted">{{ sub.shortcut }}</kbd>
                  </ContextMenuItem>
                </template>
              </ContextMenuSubContent>
            </ContextMenuPortal>
          </ContextMenuSub>

          <!-- Leaf item -->
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
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
