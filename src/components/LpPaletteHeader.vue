<script setup lang="ts">
/*
 * The head of a palette preview: what kind of thing this is (eyebrow), its
 * name, a line under the name, and a lead paragraph. A picture or an icon
 * sits beside the name; badges and other extras go in the default slot,
 * between the name and the lead.
 *
 *   <LpPaletteHeader
 *     eyebrow="Modrinth"
 *     :title="hit.title"
 *     :subtitle="hit.author"
 *     :image="{ src: hit.iconUrl, fallback: initials }"
 *     :lead="hit.description"
 *   >
 *     <LpBadge>{{ hit.version }}</LpBadge>
 *   </LpPaletteHeader>
 *
 * Title, subtitle and lead take the preview slot's `highlight(text)` as well
 * as a string, to mark what was typed:
 *
 *   <LpPaletteHeader :title="highlight(command.label)" />
 *
 * The picture goes through LpAvatar: it fades in once loaded and falls back
 * to the initials or the icon when the link is dead.
 */
import { computed } from "vue"
import LpAvatar from "./LpAvatar.vue"
import LpIcon from "./LpIcon.vue"
import HighlightText from "./HighlightText.vue"
import type { HighlightPart } from "./commandSearch"
import type { CommandImage } from "./LpCommandPalette.vue"

const props = defineProps<{
  eyebrow?: string
  /** Text, or the preview slot's `highlight(text)` to mark the query. */
  title?: string | HighlightPart[]
  subtitle?: string | HighlightPart[]
  lead?: string | HighlightPart[]
  /** Icon beside the title, on a soft tile. */
  icon?: string
  /** Picture beside the title; wins over `icon`, which becomes its fallback. */
  image?: string | CommandImage | null
}>()

const picture = computed<CommandImage | null>(() => {
  if (!props.image) return null
  const image = typeof props.image === "string" ? { src: props.image } : props.image
  return { ...image, icon: image.icon ?? props.icon }
})
</script>

<template>
  <header class="lp-palette-header">
    <div class="lp-palette-header__row">
      <slot name="media">
        <LpAvatar
          v-if="picture"
          :src="picture.src ?? undefined"
          :alt="picture.alt ?? ''"
          :fallback="picture.fallback"
          :icon="picture.icon"
          :shape="picture.shape ?? 'soft'"
          :pixel-size="44"
          class="lp-palette-header__media"
        />
        <span v-else-if="icon" class="lp-palette-header__tile">
          <LpIcon :name="icon" :size="18" />
        </span>
      </slot>
      <div class="lp-palette-header__text">
        <p v-if="eyebrow" class="lp-palette-header__eyebrow">{{ eyebrow }}</p>
        <h3 v-if="title?.length || $slots.title" class="lp-palette-header__title">
          <slot name="title"><HighlightText v-if="title" :text="title" /></slot>
        </h3>
        <p v-if="subtitle?.length" class="lp-palette-header__subtitle"><HighlightText :text="subtitle" /></p>
      </div>
    </div>
    <div v-if="$slots.default" class="lp-palette-header__extra"><slot /></div>
    <p v-if="lead?.length || $slots.lead" class="lp-palette-header__lead">
      <slot name="lead"><HighlightText v-if="lead" :text="lead" /></slot>
    </p>
  </header>
</template>

<style scoped>
.lp-palette-header {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.6rem;
}
.lp-palette-header__row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
}
.lp-palette-header__media {
  flex-shrink: 0;
}
.lp-palette-header__tile {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--radius-control);
  background: var(--color-brand-soft);
  color: var(--color-brand);
}
.lp-palette-header__text {
  min-width: 0;
  flex: 1;
}
.lp-palette-header__eyebrow {
  margin: 0 0 2px;
  color: var(--color-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lp-palette-header__title {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.lp-palette-header__subtitle {
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--color-muted);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lp-palette-header__extra {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}
.lp-palette-header__lead {
  margin: 0;
  color: var(--color-muted-strong);
  font-size: 0.8125rem;
  line-height: 1.55;
  white-space: pre-line;
}
</style>
