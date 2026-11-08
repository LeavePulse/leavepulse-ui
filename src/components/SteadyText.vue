<script setup lang="ts">
/*
 * Text that changes while it is read (a clock, a length under a dragged
 * handle) in a box as wide as the widest it will get: an invisible twin of
 * that widest text sits in the same grid cell, the way LpEditable sizes its
 * field. Without it each new value resized the box and everything after it
 * on the line shifted, and a row that wraps re-wrapped and took the whole
 * layout under it up and down with it.
 *
 * `widest` is the longest the text can be, its digits as zeros: with
 * tabular figures every digit is as wide as a zero.
 */
defineProps<{ text: string; widest: string }>()
</script>

<template>
  <span class="inline-grid whitespace-nowrap tabular-nums">
    <span aria-hidden="true" class="invisible col-start-1 row-start-1">{{ widest }}</span>
    <span class="col-start-1 row-start-1">{{ text }}</span>
  </span>
</template>
