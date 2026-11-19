<script setup lang="ts">
/*
 * One option row of LpCommandPalette: icon or picture, the label, description
 * and excerpt split around the query, and the hint on its right. The palette
 * owns the list, the highlight and every handler; the row only draws.
 */
import { computed } from "vue"
import LpAvatar from "./LpAvatar.vue"
import LpIcon from "./LpIcon.vue"
import MenuShortcut from "./MenuShortcut.vue"
import { IMAGE_RADIUS, imageOf } from "./commandPalette"
import type { HighlightPart } from "./commandSearch"
import type { Command } from "./commandPaletteTypes"

const props = defineProps<{
  command: Command
  /** Position in the flat list, what `data-cmd-index` carries. */
  index: number
  selected: boolean
  /** The "Show N more" row of a folded group. */
  more: boolean
  /** The row's link, when it renders as one. */
  href?: string
  excerptLines: number
  highlight: (value: string, extra?: string[]) => HighlightPart[]
}>()

const image = computed(() => imageOf(props.command))
</script>

<template>
  <!-- tabindex -1: the rows are reached with the arrows from the box,
       so Tab should not walk through every one of them. -->
  <component
    :is="href ? 'a' : 'button'"
    :href="command.disabled ? undefined : href"
    :type="href ? undefined : 'button'"
    role="option"
    tabindex="-1"
    :aria-label="command.description ? `${command.label} ${command.description}` : command.label"
    :aria-selected="selected"
    :aria-disabled="command.disabled || undefined"
    :data-cmd-index="index"
    :disabled="href ? undefined : command.disabled"
    class="lp-cmd-item flex w-full gap-3 rounded-inner px-2.5 py-2 text-left text-sm outline-none transition-colors duration-[var(--duration-fast)] disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45"
    :class="[
      command.excerpt ? 'items-start' : 'items-center',
      selected
        ? 'bg-brand-soft text-brand'
        : more
          ? 'text-muted hover:bg-surface-soft/60'
          : 'text-ink hover:bg-surface-soft/60',
    ]"
  >
    <!-- Named from label and description, not from content: split
         into <mark> parts, a row's text was not always read as its
         name (BotEco's palette showed nameless options), and the
         shortcut or prefix kbd is not part of what the row is. -->
    <!-- A picture takes the icon's slot at the icon's footprint, with
         a negative margin so a 20px avatar does not make its row
         taller than its neighbours. -->
    <LpAvatar
      v-if="image"
      :src="image.src ?? undefined"
      :alt="image.alt ?? ''"
      :fallback="image.fallback"
      :icon="image.icon"
      :shape="image.shape ?? 'soft'"
      :pixel-size="20"
      class="-my-0.5 -ml-0.5 shrink-0 text-[9px]"
      :class="IMAGE_RADIUS[image.shape ?? 'soft']"
    />
    <LpIcon v-else-if="command.icon" :name="command.icon" :size="16" class="shrink-0" :class="{ 'mt-0.5': command.excerpt }" />
    <span class="min-w-0 flex-1">
      <span class="block truncate font-medium">
        <template v-for="(p, pi) in highlight(command.label, command.highlight)" :key="`l${pi}`">
          <mark v-if="p.hit" class="rounded-xs bg-brand/25 text-ink">{{ p.text }}</mark>
          <template v-else>{{ p.text }}</template>
        </template>
      </span>
      <span v-if="command.description" class="mt-0.5 block truncate text-xs text-muted">
        <template v-for="(p, pi) in highlight(command.description, command.highlight)" :key="`d${pi}`">
          <mark v-if="p.hit" class="rounded-xs bg-brand/20 text-ink">{{ p.text }}</mark>
          <template v-else>{{ p.text }}</template>
        </template>
      </span>
      <!-- Wraps rather than truncates: a passage cut to one line
           stops before the part that explains the match. Ink, not
           brand, on the active row: a paragraph in accent colour is
           hard to read. -->
      <span
        v-if="command.excerpt"
        class="lp-cmd-excerpt mt-1 block text-[13px] leading-snug text-ink/80"
        :style="{ '-webkit-line-clamp': excerptLines }"
      >
        <template v-for="(p, pi) in highlight(command.excerpt, command.highlight)" :key="`e${pi}`">
          <mark v-if="p.hit" class="rounded-xs bg-brand/20 text-ink">{{ p.text }}</mark>
          <template v-else>{{ p.text }}</template>
        </template>
      </span>
    </span>
    <!-- Keys mean nothing to a finger: hidden on a touch screen. -->
    <MenuShortcut v-if="command.shortcut" :combo="command.shortcut" class="[@media(hover:none)_and_(pointer:coarse)]:hidden" />
    <!-- The prefix that opens this mode from the box, so the
         shortcut is learned by seeing it rather than reading docs. -->
    <kbd
      v-else-if="command.prefix && command.children"
      class="shrink-0 rounded-small border border-line px-1.5 font-mono text-[11px] whitespace-pre text-muted [@media(hover:none)_and_(pointer:coarse)]:hidden"
    >{{ command.prefix }}</kbd>
    <!-- Drills in rather than runs: worth saying before the click,
         since the two look identical otherwise. -->
    <LpIcon
      v-else-if="command.children"
      name="lucide:chevron-right"
      :size="14"
      class="shrink-0 text-muted"
    />
  </component>
</template>

<style scoped>
.lp-cmd-excerpt {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
/* Each result eases in; honours reduced motion. */
.lp-cmd-item {
  --rise: 3px;
  animation: rise-in 140ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  .lp-cmd-item {
    animation: none;
  }
}
</style>
