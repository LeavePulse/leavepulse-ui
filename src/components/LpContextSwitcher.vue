<script setup lang="ts">
/*
 * Which of an app's contexts the rail is showing — a server, a workspace, a
 * machine, a part of the product — and the menu to change it. Every app used
 * to draw this into the rail's header slot itself, each a little differently;
 * LpAppShell renders it from its `contexts` prop, and a standalone LpSidebar
 * can put it in its own header.
 *
 * The trigger shows the current context's icon and label, or whatever the
 * default slot draws (a brand mark for one context, a plain word for
 * another). Folded to icons it is the icon alone, or the label's first letter.
 */
import { computed } from "vue"
import { useLabels } from "../composables/useLpConfig"
import LpDropdownMenu from "./LpDropdownMenu.vue"
import LpIcon from "./LpIcon.vue"
import type { ContextMenuItemDef } from "./LpContextMenu.vue"
import type { AppContext } from "./sidebar"

const props = withDefaults(
  defineProps<{
    contexts: AppContext[]
    /** The current context's id (v-model). */
    modelValue?: string
    /** The icon rail: the trigger is a square with the icon or an initial. */
    compact?: boolean
    labels?: Partial<{ switch: string; title: string }>
  }>(),
  { compact: false },
)

const emit = defineEmits<{ (e: "update:modelValue", id: string): void }>()

const text = useLabels("contextSwitcher", { switch: "{label}, switch", title: "Switch to" }, () => props.labels)

const current = computed(() => props.contexts.find((c) => c.id === props.modelValue) ?? props.contexts[0])
const initial = computed(() => [...(current.value?.label ?? "")][0] ?? "")

const items = computed<ContextMenuItemDef[]>(() =>
  props.contexts.map((c) => ({
    label: c.label,
    icon: c.icon,
    checked: c.id === current.value?.id ? true : undefined,
    onSelect: () => {
      if (c.id !== current.value?.id) emit("update:modelValue", c.id)
    },
  })),
)
</script>

<template>
  <LpDropdownMenu :items="items" :title="text.title" :palette="false">
    <template #trigger>
      <button
        type="button"
        class="flex min-w-0 items-center gap-2 rounded-control text-base font-semibold text-ink outline-none transition-colors hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring"
        :class="compact ? 'grid size-9 shrink-0 place-items-center bg-surface-soft' : 'max-w-full px-2 py-1'"
        :aria-label="text.switch.replace('{label}', current?.label ?? '')"
      >
        <slot :context="current" :compact="compact">
          <template v-if="compact">
            <LpIcon v-if="current?.icon" :name="current.icon" :size="17" />
            <template v-else>{{ initial }}</template>
          </template>
          <template v-else>
            <LpIcon v-if="current?.icon" :name="current.icon" :size="17" class="shrink-0 text-brand" />
            <span class="truncate">{{ current?.label }}</span>
          </template>
        </slot>
        <LpIcon v-if="!compact" name="lucide:chevrons-up-down" :size="14" class="shrink-0 text-muted" />
      </button>
    </template>
  </LpDropdownMenu>
</template>
