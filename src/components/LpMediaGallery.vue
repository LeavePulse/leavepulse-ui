<script setup lang="ts">
/*
 * A grid of thumbnails that opens into the lightbox.
 *
 * The pairing is the point: LpLightbox already knows how to page, zoom, rotate
 * and download a set of images, but it has no way in — something has to show
 * the set and say which one was clicked. That something is otherwise rewritten
 * per feature, each time with its own idea of what a missing image looks like
 * and whether the keyboard can reach it.
 *
 * Deliberately nothing but a grid. Column counts and gaps are all it decides;
 * a layout where the first image is large and the next two are narrow is a
 * composition, and it belongs to the feature that wants it — which can lay its
 * own elements over this grid, or pass `columns` per breakpoint and be done.
 * The kit's job is the part that repeats: the thumbnails, the focus ring, the
 * counter on an overflowing set, and the wiring to the lightbox.
 *
 * Items are LightboxItem, not a shape of this component's own, so a set can go
 * straight from here into the lightbox with nothing in between. `thumb` is the
 * small source when one exists; without it the grid shows `src`, which is
 * correct but heavier, and that is the caller's call to make.
 *
 * An item marked `spoiler` arrives covered and takes a click to uncover. The
 * cover is per image and the reveal is remembered per image, because a set is
 * usually mixed — one marked screenshot among plain ones.
 */
import { computed, ref } from "vue"
import type { LightboxItem } from "./lightbox"
import { useMergedAttrs } from "../composables/useMergedClass"
import LpIcon from "./LpIcon.vue"
import LpLightbox from "./LpLightbox.vue"

const props = withDefaults(
  defineProps<{
    /** Images in the set. The same shape LpLightbox takes. */
    items: LightboxItem[]
    /**
     * Thumbnails per row. A number is that many at every width; an object is
     * per breakpoint, e.g. `{ base: 2, md: 3, lg: 4 }`.
     */
    columns?: number | { base?: number; sm?: number; md?: number; lg?: number; xl?: number }
    /** Space between thumbnails, as a Tailwind gap step. */
    gap?: 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4
    /** Shape of each cell. `auto` lets the image decide its own height. */
    aspect?: "square" | "video" | "auto"
    /**
     * Show at most this many, with the remainder as a "+N" badge over the last
     * visible one — the usual treatment for a set too big for the space it has.
     * Clicking the badge opens the lightbox at the first hidden image, because
     * that is the one the count is about.
     */
    max?: number
    /** Open the lightbox on click. Off makes the grid a pure display. */
    openable?: boolean
    /** Passed through to the lightbox. */
    downloadable?: boolean
    /** Passed through to the lightbox. */
    rotatable?: boolean
    /** Accessible name for the grid. */
    ariaLabel?: string
  }>(),
  {
    columns: 3,
    gap: 2,
    aspect: "square",
    openable: true,
    downloadable: true,
    rotatable: true,
    ariaLabel: "Media",
  },
)

const emit = defineEmits<{
  /** A thumbnail was activated, before the lightbox opens. */
  (e: "select", item: LightboxItem, index: number): void
  /** A spoiler was uncovered. */
  (e: "reveal", item: LightboxItem): void
  (e: "update:open", value: boolean): void
}>()

defineSlots<{
  /** Replace a cell's contents. Gets the item and its index. */
  item(props: { item: LightboxItem; index: number }): unknown
  /** Shown instead of the grid when `items` is empty. */
  empty(): unknown
}>()

const open = ref(false)
const index = ref(0)

// `max` counts what is SHOWN, so the badge reads "+N more" rather than "N
// total". A set of 7 capped at 4 shows 4 cells, the last one badged +3.
const visible = computed(() =>
  props.max && props.items.length > props.max ? props.items.slice(0, props.max) : props.items,
)
const hiddenCount = computed(() => Math.max(props.items.length - visible.value.length, 0))

/*
 * Column classes are written out rather than interpolated. Tailwind scans
 * source text for complete class names, so `grid-cols-${n}` compiles to
 * nothing — the class exists in the DOM and never in the stylesheet. This is
 * the same reason the kit's other size maps are written as literals.
 */
const COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
}
const COLS_SM: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
}
const COLS_MD: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
}
const COLS_LG: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
}
const COLS_XL: Record<number, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
}

const GAPS: Record<number, string> = {
  0: "gap-0",
  0.5: "gap-0.5",
  1: "gap-1",
  1.5: "gap-1.5",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
}

const ASPECTS = {
  square: "aspect-square",
  video: "aspect-video",
  auto: "",
} as const

const columnClass = computed(() => {
  const c = props.columns
  if (typeof c === "number") return COLS[c] ?? COLS[3]!
  return [
    COLS[c.base ?? 1] ?? COLS[1],
    c.sm ? COLS_SM[c.sm] : "",
    c.md ? COLS_MD[c.md] : "",
    c.lg ? COLS_LG[c.lg] : "",
    c.xl ? COLS_XL[c.xl] : "",
  ]
    .filter(Boolean)
    .join(" ")
})

const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  ["grid", columnClass.value, GAPS[props.gap] ?? GAPS[2]].join(" "),
)

function activate(i: number) {
  const item = props.items[i]
  if (!item) return
  // `select` reports the position in the caller's own array, which is the one
  // they can do anything with — the lightbox's filtered index is internal.
  emit("select", item, i)
  if (!props.openable) return
  // Covered images are not in the lightbox's list, so the index has to be
  // translated into it.
  const at = openIndexOf(i)
  if (at === -1) return
  index.value = at
  open.value = true
  emit("update:open", true)
}

/** The badge is about the FIRST hidden image, so that is where it opens. */
function openOverflow() {
  activate(visible.value.length)
}

/*
 * Which spoilers have been opened.
 *
 * Keyed by `src` rather than by index, because the index is not a name: a set
 * that gains an image at the front, or is filtered, shifts every position under
 * the cursor, and a grid keyed by index would then show the wrong picture as
 * already-revealed — which for a spoiler is the one failure that matters.
 */
const revealed = ref(new Set<string>())

function isHidden(item: LightboxItem): boolean {
  return Boolean(item.spoiler) && !revealed.value.has(item.src)
}

/*
 * A covered tile takes its click to uncover itself and STOPS there — it does
 * not also open the lightbox. Revealing and viewing are two separate requests,
 * and running them together puts a picture nobody has agreed to see yet
 * full-screen on the first click. The second click opens it like any other.
 */
function reveal(item: LightboxItem) {
  // A new Set, not .add(): a Set mutated in place is the same object, so a
  // computed reading it never sees a change.
  revealed.value = new Set(revealed.value).add(item.src)
  emit("reveal", item)
}

/*
 * The lightbox never receives a covered image. Paging through the set with the
 * arrow keys would otherwise walk straight into one full-screen, having asked
 * nobody — the grid's cover would have been for nothing. Items already revealed
 * pass through untouched, so opening the one you just uncovered still lands on
 * it.
 */
const openItems = computed(() => props.items.filter((item) => !isHidden(item)))

/** Index within `openItems` of the grid item at `i`, or -1 when it is covered. */
function openIndexOf(i: number): number {
  const item = props.items[i]
  return item ? openItems.value.indexOf(item) : -1
}

defineExpose({
  /** Open the lightbox at an index — for a "view all" button outside the grid. */
  openAt: (i: number) => activate(i),
  /** Uncover every spoiler in the set. */
  revealAll: () => {
    const next = new Set(revealed.value)
    for (const item of props.items) if (item.spoiler) next.add(item.src)
    revealed.value = next
  },
})
</script>

<template>
  <div v-if="!items.length">
    <slot name="empty" />
  </div>

  <div v-else role="group" :aria-label="ariaLabel" :class="rootClass" v-bind="rest">
    <button
      v-for="(item, i) in visible"
      :key="item.src + i"
      type="button"
      :class="[
        'group relative overflow-hidden rounded-card bg-surface-soft outline-none',
        ASPECTS[aspect],
        openable ? 'cursor-pointer' : 'cursor-default',
        'focus-visible:ring-2 focus-visible:ring-ring',
      ]"
      :aria-label="
        isHidden(item)
          ? 'Spoiler — show image'
          : hiddenCount && i === visible.length - 1
            ? `Show ${hiddenCount} more`
            : item.title || `Image ${i + 1} of ${items.length}`
      "
      @click="
        isHidden(item)
          ? reveal(item)
          : hiddenCount && i === visible.length - 1
            ? openOverflow()
            : activate(i)
      "
    >
      <slot name="item" :item="item" :index="i">
        <!-- decoding=async + loading=lazy: a gallery is often far down a page,
             and a grid of full-size sources is the difference between a page
             that settles and one that fetches a megabyte per cell on load.

             On the overflow cell the image carries the blur and the dimming
             itself instead of wearing a scrim — see the "+N" span below for
             why. `scale-[1.06]` goes with the blur: blurring samples past the
             image's own edge, so its outermost pixels fade toward transparent
             and the tile gets a soft translucent rim. Growing the image a
             little pushes that feathered edge outside the clip. -->
        <img
          :src="item.thumb || item.src"
          :alt="isHidden(item) ? '' : item.title || ''"
          loading="lazy"
          decoding="async"
          class="size-full object-cover transition-transform duration-[var(--duration-medium)] ease-[var(--ease-emphasized)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          :class="[
            isHidden(item)
              ? 'scale-[1.12] blur-[18px] brightness-[0.6] saturate-[1.1] group-hover:scale-[1.12]'
              : '',
            !isHidden(item) && hiddenCount && i === visible.length - 1
              ? 'scale-[1.06] blur-[2px] brightness-[0.45] group-hover:scale-[1.06]'
              : '',
          ]"
        >
      </slot>

      <!-- The overflow count on the LAST visible cell. Part of that cell's
           button rather than a sibling, so the tile stays one tab stop and one
           hit target.

           The DARKENING is not here — it rides on the image's own filter (see
           the `img` above). A scrim laid over the image as its own layer is the
           bug LpColorPicker's s/v square documents: a rounded clip is
           antialiased, so the pixels along each corner's arc get only partial
           coverage of the overlay, and the UNDARKENED image shows through the
           rest of the way — a bright fringe tracing the radius, faint at 100%
           and obvious zoomed. Dimming the image itself means the corner clips a
           finished pixel, which fades toward transparent instead of toward
           something that should never be on show. -->
      <!-- A covered tile says so in words. The blur alone is ambiguous — a
           heavily blurred photograph reads as one that failed to load, and the
           label is the difference between "broken" and "click to see". -->
      <span
        v-if="isHidden(item)"
        class="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span
          class="rounded-pill bg-black/55 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
        >
          Spoiler
        </span>
      </span>

      <span
        v-else-if="hiddenCount && i === visible.length - 1"
        class="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-medium text-white"
      >
        +{{ hiddenCount }}
      </span>

      <span
        v-else-if="openable"
        class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-[background-color,opacity] duration-[var(--duration-fast)] group-hover:bg-black/25 group-hover:opacity-100 motion-reduce:transition-none"
        aria-hidden="true"
      >
        <LpIcon name="lucide:maximize-2" :size="18" class="text-white" />
      </span>
    </button>

    <LpLightbox
      v-if="openable"
      v-model:open="open"
      v-model:index="index"
      :items="openItems"
      :downloadable="downloadable"
      :rotatable="rotatable"
    />
  </div>
</template>
