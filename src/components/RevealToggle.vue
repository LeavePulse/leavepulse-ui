<script setup lang="ts">
/*
 * The eye that shows and hides a value: LpPasswordInput's field, LpSecretField's
 * display and LpCodeDisplay's code. One button so the three answer a click the
 * same way: both eyes stay mounted and morph in place (lp-glyph-swap), the
 * pressed state is announced, and the tooltip says what the next click does
 * and doubles as the button's name. Internal; the fields expose it through
 * their own `revealed`/`visible` models.
 */
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpTooltip from "./LpTooltip.vue"

defineProps<{
  /** Glyph size in px. The button's own size comes from the caller's class. */
  iconSize: number
  /** What the button says while the value is hidden, and while it is shown. */
  showLabel: string
  hideLabel: string
  disabled?: boolean
  /** Id of the element whose content this reveals. */
  controls?: string
}>()

// The caller's class sizes the BUTTON (each field has its own), not the
// tooltip wrapper that is this component's root.
defineOptions({ inheritAttrs: false })

const revealed = defineModel<boolean>({ default: false })
</script>

<template>
  <LpTooltip :content="revealed ? hideLabel : showLabel" label>
    <LpButton
      variant="ghost"
      size="xs"
      square
      class="text-muted hover:text-ink"
      v-bind="$attrs"
      :disabled="disabled"
      :aria-pressed="revealed"
      :aria-controls="controls"
      @click="revealed = !revealed"
    >
      <span class="grid place-items-center">
        <LpIcon name="lucide:eye" :size="iconSize" class="lp-glyph-swap col-start-1 row-start-1" :data-on="!revealed || undefined" />
        <LpIcon name="lucide:eye-off" :size="iconSize" class="lp-glyph-swap col-start-1 row-start-1" :data-on="revealed || undefined" />
      </span>
    </LpButton>
  </LpTooltip>
</template>
