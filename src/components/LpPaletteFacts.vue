<script setup lang="ts">
/*
 * A short list of facts in a palette preview: a label, and what it is set to
 * now. The tabs of a page, the fields of a settings section, a person's
 * standing, the instance a world belongs to. An icon or a colour dot leads
 * each row; `current` marks the one in effect.
 *
 *   <LpPaletteFacts
 *     title="Now"
 *     :items="[
 *       { icon: 'lucide:server', label: 'Instance', value: 'Survival' },
 *       { color: '#5865f2', label: 'Role colour', value: '#5865F2', mono: true },
 *     ]"
 *   />
 *
 * Values roll when they change while the row is on screen (a theme picked
 * with keepOpen, a count that refreshed), through LpRollingText. The `value`
 * slot draws a value of the app's own (chips, a switch) instead.
 */
import LpIcon from "./LpIcon.vue"
import LpRollingText from "./LpRollingText.vue"
import type { PaletteFact } from "./commandPalette"

withDefaults(
  defineProps<{
    items: PaletteFact[]
    /** Small heading over the list. */
    title?: string
    /** Plain rows instead of soft tiles, for a list read as text. */
    plain?: boolean
  }>(),
  { plain: false },
)

defineSlots<{
  value?: (props: { item: PaletteFact; index: number }) => unknown
}>()
</script>

<template>
  <section class="lp-palette-facts" :class="{ 'lp-palette-facts--plain': plain }">
    <p v-if="title" class="lp-palette-facts__title">{{ title }}</p>
    <ul class="lp-palette-facts__list">
      <li
        v-for="(item, index) in items"
        :key="`${item.label}-${index}`"
        class="lp-palette-facts__row"
        :class="{ 'is-current': item.current }"
        :aria-current="item.current || undefined"
      >
        <span v-if="item.color" class="lp-palette-facts__dot" :style="{ background: item.color }" />
        <LpIcon v-else-if="item.icon" :name="item.icon" :size="15" class="lp-palette-facts__icon" />
        <span class="lp-palette-facts__label">
          <span class="lp-palette-facts__name">{{ item.label }}</span>
          <span v-if="item.hint" class="lp-palette-facts__hint">{{ item.hint }}</span>
        </span>
        <span
          v-if="item.value !== undefined && item.value !== '' || $slots.value"
          class="lp-palette-facts__value"
          :class="{ 'lp-palette-facts__value--mono': item.mono }"
        >
          <slot name="value" :item="item" :index="index">
            <LpRollingText v-if="item.value !== undefined" :value="item.value" align="end" />
          </slot>
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.lp-palette-facts {
  min-width: 0;
}
.lp-palette-facts__title {
  margin: 0 0 0.4rem;
  color: var(--color-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lp-palette-facts__list {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.lp-palette-facts__row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--color-ink) 3%, transparent);
  color: var(--color-ink);
  font-size: 0.8125rem;
  transition: background-color var(--duration-fast, 150ms) ease;
}
.lp-palette-facts--plain .lp-palette-facts__row {
  padding: 0.15rem 0;
  background: transparent;
}
.lp-palette-facts__row.is-current {
  background: var(--color-brand-soft);
}
.lp-palette-facts--plain .lp-palette-facts__row.is-current {
  background: transparent;
  color: var(--color-brand);
}
.lp-palette-facts__icon {
  flex-shrink: 0;
  color: var(--color-muted);
  transition: color var(--duration-fast, 150ms) ease;
}
.is-current .lp-palette-facts__icon {
  color: var(--color-brand);
}
.lp-palette-facts__dot {
  width: 0.55rem;
  height: 0.55rem;
  flex-shrink: 0;
  margin: 0 0.15rem;
  border-radius: 9999px;
  box-shadow: 0 0 0 1px var(--color-line);
}
.lp-palette-facts__label {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}
.lp-palette-facts__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lp-palette-facts__hint {
  margin-top: 1px;
  color: var(--color-muted);
  font-size: 0.75rem;
  line-height: 1.45;
}
.lp-palette-facts__value {
  display: inline-flex;
  min-width: 0;
  max-width: 55%;
  flex-shrink: 0;
  justify-content: flex-end;
  overflow: hidden;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.lp-palette-facts__value :deep(.lp-roll) {
  max-width: 100%;
}
.lp-palette-facts__value--mono {
  font-family: var(--font-mono, ui-monospace, monospace);
}
</style>
