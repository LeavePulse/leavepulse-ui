<script setup lang="ts">
/*
 * A key combination drawn as keycaps: "Ctrl+K" is two caps, "G I" is G then
 * I. Written the way LpShortcutsDialog reads combos, and drawn the same way,
 * so a hint in a palette preview, a tooltip or a menu matches the reference.
 *
 *   <LpKeys combo="Ctrl+Shift+P" label="from anywhere" />
 *
 * On an Apple keyboard Ctrl and Alt read as the symbols printed on its keys.
 */
import { computed } from "vue"
import { appleModifierLabel, useAppleKeyboard } from "../composables/useHotkeys"
import { useLabels } from "../composables/useLpConfig"
import { comboSteps } from "./keys"

const props = withDefaults(
  defineProps<{
    /** "Ctrl+K", "Ctrl++", or a sequence "G I". Or keys already split. */
    combo: string | string[]
    /** Text after the caps, e.g. what the keys do. */
    label?: string
    size?: "sm" | "md"
  }>(),
  { size: "md" },
)

const text = useLabels("shortcuts", { then: "then" })
const apple = useAppleKeyboard()

const steps = computed(() => (Array.isArray(props.combo) ? [props.combo] : comboSteps(props.combo)))
</script>

<template>
  <span class="lp-keys" :class="`lp-keys--${size}`">
    <template v-for="(step, stepIndex) in steps" :key="stepIndex">
      <span v-if="stepIndex" class="lp-keys__then">{{ text.then }}</span>
      <!-- A chord never splits: squeezed, the keys wrap between steps, not
           between Ctrl and K. -->
      <span class="lp-keys__step">
        <kbd v-for="(key, index) in step" :key="`${key}-${index}`">{{ appleModifierLabel(key.trim(), apple) }}</kbd>
      </span>
    </template>
    <span v-if="label || $slots.default" class="lp-keys__label"><slot>{{ label }}</slot></span>
  </span>
</template>

<style scoped>
.lp-keys {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  color: var(--color-muted);
}
.lp-keys__step {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.lp-keys__then {
  padding: 0 2px;
  font-size: 0.68rem;
}
.lp-keys__label {
  margin-left: 5px;
  font-size: 0.75rem;
}
kbd {
  display: inline-flex;
  min-width: 20px;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border: 1px solid var(--color-line-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--color-ink) 6%, transparent);
  color: var(--color-muted-strong);
  font-family: inherit;
  font-size: 0.7rem;
  line-height: 1.5;
}
.lp-keys--sm kbd {
  min-width: 16px;
  padding: 0 4px;
  font-size: 0.65rem;
}
</style>
