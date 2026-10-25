<script lang="ts">
export default { inheritAttrs: false }

export interface DataListItem {
  /** Stable key, used for slots (`#value-<key>`, `#label-<key>`) and list identity. Defaults to the label. */
  key?: string
  label: string
  /** The value. Empty (`null`, `undefined`, `""`) shows the placeholder. */
  value?: string | number | null
  /** Offer a copy button for this value. */
  copyable?: boolean
  /** Monospace, for ids, addresses, hashes, versions. */
  mono?: boolean
  /** A note on what the label means, behind an info icon. */
  hint?: string
}

export interface DataListLabels extends Record<string, string> {
  empty: string
}
</script>

<script setup lang="ts">
/*
 * Facts about one thing, as label and value pairs: a server's address,
 * region, uptime and version; an account's id, plan and creation date.
 *
 *   <LpDataList :items="[
 *     { label: 'Address', value: '10.0.4.12:25565', mono: true, copyable: true },
 *     { label: 'Region', value: 'Frankfurt' },
 *     { label: 'Players', value: online },
 *   ]" />
 *
 * Rendered as a real description list (<dl>/<dt>/<dd>), so assistive tech
 * reads each value with its label.
 *
 * Side by side when there is room, label above value when there is not —
 * decided by the list's OWN width (a container query), not the window's: the
 * same list sits in a wide page and in a narrow side panel, and only its own
 * width says which reads better. Labels share one column, so values line up.
 *
 * Values are watched things — a player count, a status — so a short value
 * that changes rolls to the new one (LpRollingText) instead of flicking.
 */
import { computed, useSlots } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import LpCopyButton from "./LpCopyButton.vue"
import LpIcon from "./LpIcon.vue"
import LpRollingText from "./LpRollingText.vue"
import LpTooltip from "./LpTooltip.vue"

const props = withDefaults(
  defineProps<{
    items: DataListItem[]
    /**
     * `auto` (default) is side by side, stacking when the list itself is
     * narrower than ~20rem. `horizontal` and `stacked` fix one.
     */
    layout?: "auto" | "horizontal" | "stacked"
    /** Hairlines between rows, for a long list read as a table. */
    divided?: boolean
    size?: "sm" | "md"
    labels?: Partial<DataListLabels>
  }>(),
  { layout: "auto", size: "md" },
)

const text = useLabels<DataListLabels>("dataList", { empty: "—" }, () => props.labels)
const slots = useSlots()

const keyOf = (item: DataListItem) => item.key ?? item.label
const isEmpty = (value: DataListItem["value"]) => value === null || value === undefined || value === ""
// Long text wraps; rolling a paragraph would clip it to one line.
const rolls = (value: DataListItem["value"]) => !isEmpty(value) && String(value).length <= 48

/*
 * Literal classes per layout: the consuming app's Tailwind scans this file as
 * text, so container variants built at runtime would never be emitted.
 *   - the list is a two-column grid, each row a subgrid, so every label
 *     shares the first column and every value starts on one line;
 *   - stacked collapses it to one column.
 */
const GRID = {
  auto: "grid-cols-1 @xs:grid-cols-[fit-content(40%)_minmax(0,1fr)]",
  horizontal: "grid-cols-[fit-content(40%)_minmax(0,1fr)]",
  stacked: "grid-cols-1",
} as const
const ROW = {
  auto: "gap-0.5 @xs:col-span-2 @xs:grid-cols-subgrid @xs:gap-x-6",
  horizontal: "col-span-2 grid-cols-subgrid gap-x-6",
  stacked: "gap-0.5",
} as const

const { class: rootClass, attrs: rest } = useMergedAttrs(() => "@container w-full")
const pad = computed(() => (props.size === "sm" ? "py-1.5 text-xs" : "py-2.5 text-sm"))
</script>

<template>
  <div :class="rootClass" v-bind="rest">
    <TransitionGroup
      tag="dl"
      class="grid"
      :class="GRID[layout]"
      move-class="transition-transform duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none"
      enter-active-class="transition-opacity duration-(--duration-medium) motion-reduce:transition-none"
      enter-from-class="opacity-0"
      leave-active-class="hidden"
    >
      <div
        v-for="(item, i) in items"
        :key="keyOf(item)"
        class="group/row grid items-baseline"
        :class="[ROW[layout], pad, divided && i > 0 ? 'border-t border-line' : '']"
      >
        <dt class="flex min-w-0 items-center gap-1 text-muted">
          <slot :name="`label-${keyOf(item)}`" :item="item">
            <slot name="label" :item="item">{{ item.label }}</slot>
          </slot>
          <LpTooltip v-if="item.hint" :content="item.hint">
            <button
              type="button"
              class="grid size-4 shrink-0 place-items-center rounded-full text-muted/80 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
              :aria-label="item.hint"
            >
              <LpIcon name="lucide:info" :size="12" />
            </button>
          </LpTooltip>
        </dt>
        <dd class="flex min-w-0 items-center gap-1.5 text-ink" :class="item.mono ? 'font-mono' : ''">
          <span class="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <slot
              v-if="slots[`value-${keyOf(item)}`] || slots.value"
              :name="slots[`value-${keyOf(item)}`] ? `value-${keyOf(item)}` : 'value'"
              :item="item"
              :value="item.value"
            />
            <span v-else-if="isEmpty(item.value)" class="text-muted">{{ text.empty }}</span>
            <LpRollingText v-else-if="rolls(item.value)" :value="item.value!" align="start" wrap />
            <template v-else>{{ item.value }}</template>
          </span>
          <!-- Quiet until the row is hovered or focused; always there on touch,
               where nothing hovers. -->
          <LpCopyButton
            v-if="item.copyable && !isEmpty(item.value)"
            :value="String(item.value)"
            size="xs"
            class="-my-1 size-6 shrink-0 opacity-0 transition-opacity duration-(--duration-fast) group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=copied]:opacity-100 [@media(hover:none)]:opacity-100"
          />
        </dd>
      </div>
    </TransitionGroup>
  </div>
</template>
