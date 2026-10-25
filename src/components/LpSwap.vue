<script setup lang="ts">
/*
 * One piece of content standing in for another: the section picked in a side
 * nav, the step of a wizard, the view chosen in a segmented control. Without
 * it the old content vanishes and the new one appears in the same frame, and
 * everything below jumps to the new height.
 *
 *   <LpSidebar v-model="section" :items="items" />
 *   <LpSwap :swap-key="section">
 *     <SectionBody :name="section" />
 *   </LpSwap>
 *
 * The outgoing content fades out quickly, the incoming one rises in the way
 * LpTabs panels do (`rise-in`), and the box eases between the two heights
 * through LpShift, so what sits under it glides instead of jolting.
 *
 * `swapKey` is what decides that the content is "another one". Change it per
 * section, not per record: a key that changes on every reload replays the
 * entrance for data that merely refreshed.
 */
import LpShift from "./LpShift.vue"

defineProps<{
  /** Identity of the current content; a new value plays the swap. */
  swapKey: string | number
  /** Turn the motion off (the content still swaps). */
  disabled?: boolean
}>()
</script>

<template>
  <LpShift axis="height" :disabled="disabled">
    <Transition
      mode="out-in"
      :css="!disabled"
      enter-active-class="animate-[rise-in_220ms_var(--ease-emphasized)] [--rise:6px] motion-reduce:animate-none"
      leave-active-class="transition-opacity duration-[var(--duration-fast)] ease-out motion-reduce:transition-none"
      leave-to-class="opacity-0"
    >
      <div :key="swapKey">
        <slot />
      </div>
    </Transition>
  </LpShift>
</template>
