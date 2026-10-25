<script lang="ts">
// The caller's `class` is merged into the dot's own rather than appended.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * The small dot on a tab or a segment that says "something behind this wants
 * a look". Internal: LpTabs and LpSegmented both draw it, on the icon's corner
 * when there is an icon to sit on, otherwise after the label. Decorative; the
 * thing it marks says why in its own words.
 */
import { useMergedAttrs } from "../composables/useMergedClass"

const props = defineProps<{
  /** On the corner of the icon it rides on (the icon's box is `relative`), rather than after the label. */
  corner?: boolean
}>()

const { class: dotClass, attrs: rest } = useMergedAttrs(() =>
  `rounded-full bg-accent ${props.corner ? "absolute -right-1 -top-0.5 size-2" : "relative z-10 size-1.5 self-start"}`,
)
</script>

<template>
  <span aria-hidden="true" :class="dotClass" v-bind="rest" />
</template>
