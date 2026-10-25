<script setup lang="ts">
/*
 * A shortcut hint at the end of a menu or palette row. Internal: drawn by
 * ContextMenuItems (context and dropdown menus) and LpCommandPalette.
 *
 * It is LpKeys, not a bare <kbd>, so a combo reads the way the rest of the kit
 * draws it and maps to the keyboard in front of the user: "Ctrl+K" shows ⌘K on
 * an Apple keyboard. The full keycap look would outweigh the label it sits
 * beside, so the caps lose their raised edge and fill here and keep only a
 * hairline outline: a quiet hint, not a second control.
 */
import LpKeys from "./LpKeys.vue"

defineProps<{ combo: string }>()
</script>

<template>
  <span class="lp-menu-shortcut shrink-0">
    <LpKeys :combo="combo" size="sm" />
  </span>
</template>

<style scoped>
.lp-menu-shortcut :deep(.lp-keys kbd) {
  min-width: 0;
  padding: 0 4px;
  border-width: 1px;
  border-color: var(--color-line);
  background: transparent;
  color: var(--color-muted);
  font-size: 0.68rem;
  line-height: 1.45;
}
</style>
