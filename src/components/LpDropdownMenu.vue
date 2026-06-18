<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui"
import { POPOVER_PANEL } from "./dropdown"
import LpIcon from "./LpIcon.vue"

export interface MenuItem {
  label: string
  icon?: string
  danger?: boolean
  separatorBefore?: boolean
  onSelect?: () => void
}

defineProps<{ items: MenuItem[] }>()
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :side-offset="6"
        align="end"
        :class="[POPOVER_PANEL, 'z-(--z-popover) min-w-44 p-1 outline-none']"
      >
        <template v-for="(item, i) in items" :key="i">
          <DropdownMenuSeparator v-if="item.separatorBefore" class="my-1 h-px bg-line" />
          <DropdownMenuItem
            class="group/item flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none transition-[background-color,color] duration-[var(--duration-fast)] data-[highlighted]:bg-brand-soft"
            :class="item.danger ? 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger' : 'text-ink data-[highlighted]:text-brand'"
            @select="item.onSelect?.()"
          >
            <LpIcon
              v-if="item.icon"
              :name="item.icon"
              :size="15"
              class="transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-data-[highlighted]/item:translate-x-0.5"
            />
            {{ item.label }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
