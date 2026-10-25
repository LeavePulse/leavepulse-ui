<script setup lang="ts">
/*
 * A menu opened from a button (usually a row's "…"). Its items are the same
 * shape as LpContextMenu's and are drawn by the same renderer, so one array
 * serves both the right click and the button: submenus (`children`), tick-box
 * items (`checked`) and shortcut hints appear in either.
 */
import { hints } from "../composables/useHints"
import { HINT_SIGNALS } from "../composables/useHintSystem"
import { DropdownMenuContent, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from "reka-ui"
import ContextMenuItems from "./ContextMenuItems.vue"
import type { ContextMenuItemDef } from "./LpContextMenu.vue"
import { POPOVER_PANEL } from "./dropdown"
import MenuTitle from "./MenuTitle.vue"

/** A dropdown item: the context-menu item shape, kept under its old name. */
export type MenuItem = ContextMenuItemDef

const props = defineProps<{
  items: MenuItem[]
  /** A heading naming what the menu acts on; see LpContextMenu's `title`. */
  title?: string
  subtitle?: string
  titleIcon?: string
  titleImage?: string
  /**
   * The same items are also on a right click (a row's "…" next to its context
   * menu). Opening it then counts toward the hint system's right-click tip.
   */
  rightClickToo?: boolean
}>()

const PANEL = `${POPOVER_PANEL} z-(--z-popover) min-w-44 p-1 outline-none`

function opened(open: boolean) {
  if (open && props.rightClickToo) hints.use(HINT_SIGNALS.menuButton)
}
</script>

<template>
  <DropdownMenuRoot @update:open="opened">
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :collision-padding="8"
        :side-offset="6"
        align="end"
        :class="PANEL"
        :aria-label="title"
      >
        <MenuTitle v-if="title" :title="title" :subtitle="subtitle" :icon="titleIcon" :image="titleImage" />
        <ContextMenuItems :items="items" :panel="PANEL" kind="dropdown" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
