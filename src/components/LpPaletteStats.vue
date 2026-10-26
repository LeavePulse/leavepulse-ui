<script setup lang="ts">
/*
 * A few figures in a palette preview, as tiles: mods and worlds in an
 * instance, downloads and follows of a project, members online. A number
 * turns to a new value through LpNumberFlow, text rolls through
 * LpRollingText, so a figure that refreshes while the row is highlighted
 * moves instead of blinking.
 *
 *   <LpPaletteStats :items="[
 *     { label: 'Downloads', value: 1250000, compact: true },
 *     { label: 'Latest', value: '1.21.4' },
 *   ]" />
 */
import LpNumberFlow from "./LpNumberFlow.vue"
import LpRollingText from "./LpRollingText.vue"
import LpSkeleton from "./LpSkeleton.vue"
import type { PaletteStat } from "./commandPalette"
import { computed } from "vue"

const props = withDefaults(
  defineProps<{
    items: PaletteStat[]
    loading?: boolean
    /** Tiles per row. */
    columns?: 2 | 3 | 4
  }>(),
  { columns: 2 },
)
const shown = computed(() => props.loading && !props.items.length ? Array.from({ length: props.columns }, () => ({ label: "", value: "—" } as PaletteStat)) : props.items)
</script>

<template>
  <dl class="lp-palette-stats" :aria-busy="loading || undefined" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }">
    <div v-for="(item, index) in shown" :key="`${item.label}-${index}`" class="lp-palette-stats__tile">
      <dt><LpSkeleton v-if="loading && !item.label" class="my-1 h-2 w-20" /><template v-else>{{ item.label }}</template></dt>
      <dd class="relative">
        <LpSkeleton v-if="loading" class="absolute top-1/2 h-[1em] w-16 max-w-full -translate-y-1/2" />
        <span :class="loading && 'invisible'" :aria-hidden="loading || undefined">
        <LpNumberFlow
          v-if="typeof item.value === 'number'"
          :value="item.value"
          :compact="item.compact"
          :suffix="item.suffix"
          :format="item.format"
          :animate-on-mount="false"
          grouped
        />
        <LpRollingText v-else :value="item.value" align="start" />
        </span>
      </dd>
    </div>
  </dl>
</template>

<style scoped>
.lp-palette-stats {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}
.lp-palette-stats__tile {
  min-width: 0;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--color-surface-soft) 55%, transparent);
}
dt {
  overflow: hidden;
  color: var(--color-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
dd {
  display: flex;
  min-width: 0;
  margin: 2px 0 0;
  color: var(--color-ink);
  font-size: 1.125rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}
dd :deep(.lp-roll) {
  max-width: 100%;
}
</style>
