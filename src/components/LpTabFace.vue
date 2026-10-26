<script setup lang="ts">
/*
 * What a tab shows: its icon with a dot or a count on the corner, its label,
 * and a trailing dot or count where there is no icon to carry them. Shared by
 * LpTabs and LpBottomNav, so a section tab and a page in the bottom bar read
 * the same. Not exported on its own.
 */
import AttentionDot from "./AttentionDot.vue"
import LpBadge from "./LpBadge.vue"
import LpIcon from "./LpIcon.vue"
import LpRollingText from "./LpRollingText.vue"

defineProps<{
  item: { label: string; icon?: string; dot?: boolean; badge?: number | string }
  bottom?: boolean
  compact?: boolean
  active?: boolean
}>()
</script>

<template>
  <span v-if="item.icon" class="relative z-10 inline-flex">
    <LpIcon :name="item.icon" :size="bottom ? 22 : 14" />
    <AttentionDot v-if="item.dot" corner />
    <!-- On a bottom bar the count rides on the icon's corner, as phone
         navs draw it: the label under the icon has no room beside it. -->
    <Transition name="lp-tab-badge">
      <LpBadge
        v-if="bottom && item.badge != null"
        size="sm"
        :tone="active ? 'brand' : 'neutral'"
        class="absolute -right-3 -top-1.5 min-w-[18px] justify-center"
      >
        <LpRollingText :value="item.badge" />
      </LpBadge>
    </Transition>
  </span>
  <span class="relative z-10" :class="bottom ? 'max-w-full truncate' : compact && item.icon ? 'sr-only' : ''">{{ item.label }}</span>
  <AttentionDot v-if="item.dot && !item.icon" />
  <!-- The count rolls when it changes, and the chip scales in and out
       rather than popping. -->
  <Transition name="lp-tab-badge">
    <LpBadge
      v-if="!(bottom && item.icon) && item.badge != null"
      size="sm"
      :tone="active ? 'brand' : 'neutral'"
      class="relative z-10 min-w-[18px] justify-center"
    >
      <LpRollingText :value="item.badge" />
    </LpBadge>
  </Transition>
</template>
