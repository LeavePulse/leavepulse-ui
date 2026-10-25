<script setup lang="ts" generic="T extends object">
import { nextTick, ref } from "vue"
import { useFieldControl } from "../composables/useField"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useRepeater, type RepeaterItemKey } from "../composables/useRepeater"
import { usePrefersReducedMotion } from "../composables/useReducedMotion"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpShift from "./LpShift.vue"

defineOptions({ inheritAttrs: false })
const props = defineProps<{
  /** Return a fresh item when Add is pressed. Data and validation remain the caller's. */
  createItem: () => T
  /** Stable business key for immutable reloads; omitted, object identity keeps unsaved rows stable. */
  itemKey?: RepeaterItemKey<T>
  label?: string
  disabled?: boolean
  labels?: Partial<{ add: string; remove: string; empty: string }>
}>()
const model = defineModel<T[]>({ default: () => [] })
defineSlots<{
  default?(props: { item: T; index: number; disabled: boolean; update: (item: T) => void; remove: () => void }): unknown
  empty?(): unknown
}>()

const field = useFieldControl(() => ({ wrapped: false, disabled: props.disabled }))
const text = useLabels("repeater", { add: "Add item", remove: "Remove item {index}", empty: "No items" }, () => props.labels)
const list = useRepeater({
  value: () => model.value,
  set: (items) => { model.value = items },
  createItem: () => props.createItem(),
  itemKey: () => props.itemKey,
  disabled: () => field.value.disabled,
})
const { rows } = list
const rowsHost = ref<HTMLElement | null>(null)
const reducedMotion = usePrefersReducedMotion()
const addButton = ref<InstanceType<typeof LpButton> | null>(null)
const focusable = 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex="0"], [contenteditable="true"]'
function focusRow(index: number) {
  rowAt(index)?.querySelector<HTMLElement>(focusable)?.focus({ preventScroll: true })
}
function rowAt(index: number): HTMLElement | undefined {
  return Array.from(rowsHost.value?.children ?? []).filter((node): node is HTMLElement =>
    node.hasAttribute("data-lp-repeater-row") && !node.hasAttribute("inert"),
  )[index]
}
function beforeLeave(el: Element) {
  const row = el as HTMLElement
  row.style.width = `${row.offsetWidth}px`
  row.style.top = `${row.offsetTop}px`
  row.setAttribute("inert", "")
  row.setAttribute("aria-hidden", "true")
}
function beforeEnter(el: Element) {
  const row = el as HTMLElement
  row.removeAttribute("inert")
  row.removeAttribute("aria-hidden")
  row.style.removeProperty("top")
  row.style.removeProperty("width")
}
async function add() {
  if (field.value.disabled) return
  list.add()
  await nextTick()
  focusRow(model.value.length - 1)
}
async function remove(index: number) {
  if (field.value.disabled) return
  const row = rowAt(index)
  const restore = row?.contains(row.ownerDocument.activeElement)
  list.remove(index)
  if (!restore) return
  await nextTick()
  if (model.value.length) focusRow(Math.min(index, model.value.length - 1))
  else (addButton.value?.$el as HTMLElement | undefined)?.focus({ preventScroll: true })
}
defineExpose({ add, remove, update: list.update })
const { class: rootClass, attrs: rest } = useMergedAttrs("flex min-w-0 flex-col gap-2")
</script>

<template>
  <div v-bind="rest" :class="rootClass">
    <div class="flex items-center justify-between gap-2">
      <span v-if="label" class="text-sm font-medium text-ink">{{ label }}</span>
      <LpButton ref="addButton" size="xs" variant="ghost" :disabled="field.disabled" @click="add">
        <LpIcon name="lucide:plus" :size="14" />{{ text.add }}
      </LpButton>
    </div>
    <LpShift axis="height">
      <div ref="rowsHost" class="relative flex min-w-0 flex-col gap-2">
        <TransitionGroup name="lp-repeater" :css="!reducedMotion" @before-enter="beforeEnter" @before-leave="beforeLeave">
          <div v-for="({ item, key }, index) in rows" :key="key" data-lp-repeater-row class="flex min-w-0 items-start gap-2">
            <div class="min-w-0 flex-1">
              <slot :item="item" :index="index" :disabled="field.disabled" :update="(next: T) => list.update(index, next)" :remove="() => remove(index)" />
            </div>
            <LpButton variant="ghost" size="sm" square :disabled="field.disabled" :aria-label="text.remove.replace('{index}', String(index + 1))" @click="remove(index)">
              <LpIcon name="lucide:x" :size="14" />
            </LpButton>
          </div>
          <div v-if="!rows.length" key="empty" class="text-xs text-muted"><slot name="empty">{{ text.empty }}</slot></div>
        </TransitionGroup>
      </div>
    </LpShift>
  </div>
</template>

<style>
.lp-repeater-move,
.lp-repeater-enter-active,
.lp-repeater-leave-active {
  transition: transform var(--duration-fast) var(--ease-emphasized), opacity var(--duration-fast) var(--ease-emphasized);
}
.lp-repeater-leave-active {
  position: absolute;
}
.lp-repeater-enter-from,
.lp-repeater-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}
@media (prefers-reduced-motion: reduce) {
  .lp-repeater-move,
  .lp-repeater-enter-active,
  .lp-repeater-leave-active {
    transition: none;
  }
}
</style>
