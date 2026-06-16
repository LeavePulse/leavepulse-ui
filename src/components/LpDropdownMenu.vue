<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui"
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
        class="z-(--z-popover) min-w-44 rounded-control border border-line bg-surface-overlay p-1 shadow-panel backdrop-blur outline-none data-[state=open]:animate-[popover-in_140ms_var(--ease-emphasized)] data-[state=closed]:animate-[popover-out_120ms_ease]"
      >
        <template v-for="(item, i) in items" :key="i">
          <DropdownMenuSeparator v-if="item.separatorBefore" class="my-1 h-px bg-line" />
          <DropdownMenuItem
            class="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none data-[highlighted]:bg-brand-soft"
            :class="item.danger ? 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger' : 'text-ink data-[highlighted]:text-brand'"
            @select="item.onSelect?.()"
          >
            <LpIcon v-if="item.icon" :name="item.icon" :size="15" />
            {{ item.label }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
