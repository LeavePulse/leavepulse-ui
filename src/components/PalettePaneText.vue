<script setup lang="ts">
/*
 * The preview pane's own drawing of a row, used when neither the app's
 * `#preview` slot nor the row's `previewComponent` draws it: the row's
 * picture and label, its description, and its text in paragraphs that arrive
 * one after another.
 */
import { computed } from "vue"
import LpAvatar from "./LpAvatar.vue"
import LpIcon from "./LpIcon.vue"
import { IMAGE_RADIUS, imageOf } from "./commandPalette"
import type { HighlightPart } from "./commandSearch"
import type { Command } from "./commandPaletteTypes"
import { staggerDelay } from "./reveal"

const props = defineProps<{
  command: Command
  highlight: (value: string, extra?: string[]) => HighlightPart[]
}>()

const image = computed(() => imageOf(props.command))

/*
 * The text in paragraphs, so they can arrive one after another. A blank line
 * separates them, as in the `preview` the consumer wrote.
 */
const paragraphs = computed(() =>
  (props.command.preview ?? props.command.excerpt ?? "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean),
)

/*
 * The row's description heads the pane only when it says something the body
 * does not: a command whose full text opens with its description (or is it)
 * would otherwise print the same sentences twice, once small and once large.
 */
const description = computed(() => {
  const own = props.command.description?.trim()
  if (!own) return undefined
  const body = paragraphs.value.join(" ")
  return body.startsWith(own) ? undefined : own
})

/** Stagger between paragraphs (after the description), capped so a long section does not trickle in. */
const paraDelay = (index: number) => `${staggerDelay(index + 1, 0, 45, 10)}ms`
</script>

<template>
  <div class="lp-cmd-para flex items-center gap-2 text-ink">
    <LpAvatar
      v-if="image"
      :src="image.src ?? undefined"
      :alt="image.alt ?? ''"
      :fallback="image.fallback"
      :icon="image.icon"
      :shape="image.shape ?? 'soft'"
      :pixel-size="28"
      class="shrink-0"
      :class="IMAGE_RADIUS[image.shape ?? 'soft']"
    />
    <LpIcon v-else-if="command.icon" :name="command.icon" :size="16" class="shrink-0 text-muted" />
    <h3 class="min-w-0 text-base font-semibold">{{ command.label }}</h3>
  </div>
  <p v-if="description" class="lp-cmd-para mt-0.5 text-xs text-muted">
    {{ description }}
  </p>
  <p
    v-for="(para, i) in paragraphs"
    :key="i"
    class="lp-cmd-para mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/90"
    :style="{ animationDelay: paraDelay(i) }"
  >
    <template v-for="(p, pi) in highlight(para, command.highlight)" :key="`p${pi}`">
      <mark v-if="p.hit" class="rounded-xs bg-brand/25 text-ink">{{ p.text }}</mark>
      <template v-else>{{ p.text }}</template>
    </template>
  </p>
</template>

<style scoped>
.lp-cmd-para {
  --rise: 4px;
  animation: rise-in 260ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  .lp-cmd-para {
    animation: none;
  }
}
</style>
