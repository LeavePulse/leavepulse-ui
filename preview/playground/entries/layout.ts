import { reactive } from "vue"
import {
  LpBadge,
  LpButton,
  LpCard,
  LpDock,
  LpGlowBorder,
  LpMagnetic,
  LpMasonry,
  LpRevealOnScroll,
  LpSegmented,
  LpSpotlight,
  LpSwitch,
} from "../../../src"
import type { ComponentEntry } from "./shared"

// Layout and card effects: components built from ideas seen in other kits, written from scratch.
// Each array lands in the section it is named after (see registry.ts).

const dockItems = [
  { id: "home", label: "Home", icon: "lucide:layout-dashboard" },
  { id: "library", label: "Library", icon: "lucide:box" },
  { id: "servers", label: "Servers", icon: "lucide:server" },
  { id: "friends", label: "Friends", icon: "lucide:users" },
  { id: "downloads", label: "Downloads", icon: "lucide:download" },
  { id: "settings", label: "Settings", icon: "lucide:settings" },
]

const memoTexts = [
  "Restart the proxy after the cert renews.",
  "Weekly backup moved to Sunday 03:00. The old cron entry is still there, disabled, in case the new one misbehaves.",
  "Ask about the GPU quota.",
  "Release notes: the launcher now resumes interrupted downloads and verifies every file before the first start, so a cut connection no longer leaves a broken instance.",
  "Pin node 18 for the panel build.",
  "Rotate the bot token on the 1st.",
  "The map server needs 6 GB of memory once the world passes 20k chunks; set the limit before the weekend event.",
  "Archive old logs.",
]

const memoTones = ["bg-brand/12", "bg-action/12", "bg-surface-soft", "bg-success/12", "bg-warning/12"]

function memo(n: number) {
  return { id: n, text: memoTexts[n % memoTexts.length]!, tone: memoTones[n % memoTones.length]! }
}

export const layoutBasics: ComponentEntry[] = [
  {
    id: "masonry",
    name: "Masonry",
    description:
      "Items of different heights packed into columns without the gaps a grid leaves: memo cards, screenshots, mod tiles. Each item goes, in order, into the shortest column, so the newest stay at the top and an appended item leaves the rest alone. The column count follows the container (`minColumnWidth`, or `columns` as a number or a `{ minWidth: count }` table). Items glide to their new places when the width, an item's size or the list changes, the height eases along, and the block makes a staggered entrance the first time it is seen.",
    components: { LpMasonry, LpCard, LpButton, LpSegmented },
    state: () =>
      reactive({
        items: Array.from({ length: 8 }, (_, n) => memo(n)),
        next: 8,
        width: "wide",
        widths: [
          { value: "narrow", label: "Narrow" },
          { value: "wide", label: "Wide" },
        ],
        add() {
          this.items.unshift(memo(this.next))
          this.next += 1
        },
        remove() {
          this.items.splice(Math.floor(this.items.length / 2), 1)
        },
        shuffle() {
          this.items.reverse()
        },
      }),
    template: `<div class="flex w-full max-w-3xl flex-col gap-3">
  <div class="flex flex-wrap items-center gap-2">
    <LpButton size="sm" @click="add()">Add to top</LpButton>
    <LpButton size="sm" variant="outline" @click="remove()">Remove one</LpButton>
    <LpButton size="sm" variant="outline" @click="shuffle()">Reverse</LpButton>
    <LpSegmented v-model="width" :options="widths" size="sm" />
  </div>
  <div :class="width === 'wide' ? 'w-full' : 'w-[22rem]'" class="transition-[width] duration-(--duration-slow) ease-(--ease-emphasized)">
    <LpMasonry :items="items" item-key="id" :min-column-width="170" :gap="12">
      <template #default="{ item }">
        <LpCard variant="flat" :class="item.tone" class="text-sm text-ink">{{ item.text }}</LpCard>
      </template>
    </LpMasonry>
  </div>
</div>`,
    thumb: `<div class="w-64">
  <LpMasonry :items="tItems" item-key="id" :columns="3" :gap="6" :entrance="false">
    <template #default="{ item }">
      <div class="rounded-control border border-line" :class="item.tone" :style="{ height: item.h + 'px' }" />
    </template>
  </LpMasonry>
</div>`,
    thumbLoop: {
      every: 1600,
      frames: [
        { tItems: [{ id: 1, h: 46, tone: "bg-brand/25" }, { id: 2, h: 30, tone: "bg-action/25" }, { id: 3, h: 60, tone: "bg-surface-soft" }, { id: 4, h: 38, tone: "bg-success/25" }, { id: 5, h: 52, tone: "bg-warning/25" }, { id: 6, h: 28, tone: "bg-brand/15" }] },
        { tItems: [{ id: 7, h: 34, tone: "bg-action/30" }, { id: 1, h: 46, tone: "bg-brand/25" }, { id: 2, h: 30, tone: "bg-action/25" }, { id: 3, h: 60, tone: "bg-surface-soft" }, { id: 4, h: 38, tone: "bg-success/25" }, { id: 5, h: 52, tone: "bg-warning/25" }, { id: 6, h: 28, tone: "bg-brand/15" }] },
        { tItems: [{ id: 7, h: 34, tone: "bg-action/30" }, { id: 1, h: 46, tone: "bg-brand/25" }, { id: 3, h: 60, tone: "bg-surface-soft" }, { id: 4, h: 38, tone: "bg-success/25" }, { id: 6, h: 28, tone: "bg-brand/15" }] },
      ],
    },
  },
  {
    id: "dock",
    name: "Dock",
    description:
      "A bar of icon buttons that swell under the mouse, the neighbours less with distance, for aiming at small targets in a dense quick bar (the launcher's apps, instances, tools). Touch, pen and reduced motion get plain buttons at rest size. Sizes are springs stepped per frame and written straight to the elements, so moving the pointer costs no re-render. One Tab stop with arrow keys inside (the focused icon swells too), labels in tooltips that also name the buttons, a dot under the ids in `active`. `orientation=\"vertical\"` for a side bar; `focusAt` drives the swell from outside for demos and tours.",
    components: { LpDock, LpSwitch },
    state: () =>
      reactive({
        items: dockItems,
        running: ["home", "servers"],
        vertical: false,
        picked: "",
      }),
    template: `<div class="flex flex-col items-center gap-4">
  <LpSwitch v-model="vertical" label="Vertical" />
  <div class="flex h-80 items-center justify-center">
    <LpDock
      :items="items"
      :active="running"
      :orientation="vertical ? 'vertical' : 'horizontal'"
      @select="(id) => { picked = id; running = running.includes(id) ? running.filter((r) => r !== id) : [...running, id] }"
    />
  </div>
  <p class="text-sm text-muted">Selected: {{ picked || 'nothing yet' }}</p>
</div>`,
    thumb: `<div class="flex h-28 items-end">
  <LpDock :items="items" :active="['home', 'servers']" :size="30" :magnify="48" :reach="90" :focus-at="tAt" />
</div>`,
    thumbLoop: {
      every: 700,
      frames: [{ tAt: null }, { tAt: 20 }, { tAt: 60 }, { tAt: 100 }, { tAt: 140 }, { tAt: 180 }, { tAt: 220 }, { tAt: null }],
    },
  },
]

export const layoutForms: ComponentEntry[] = []
export const layoutData: ComponentEntry[] = []
export const layoutOverlays: ComponentEntry[] = []

export const layoutMotion: ComponentEntry[] = [
  {
    id: "reveal-on-scroll",
    name: "Reveal on scroll",
    description:
      "Content that arrives the first time it is scrolled into view: a block of cards, a section further down a long page. `preset` is `fade`, `rise`, `blur` or `scale`, `direction` the way it travels, `delay` and `duration` in ms; `stagger` animates the direct children one after another (the steps stop growing after ten, so long lists still finish quickly). Plays once, through the Web Animations API on transform and opacity; reduced motion shows everything at once. Components that animate their own arrival (charts, progress) do not need it: they wait for `useReveal` themselves.",
    components: { LpRevealOnScroll, LpCard, LpSegmented },
    state: () =>
      reactive({
        preset: "rise",
        presets: [
          { value: "fade", label: "Fade" },
          { value: "rise", label: "Rise" },
          { value: "blur", label: "Blur" },
          { value: "scale", label: "Scale" },
        ],
        round: 0,
      }),
    template: `<div class="flex w-96 flex-col gap-3">
  <LpSegmented v-model="preset" :options="presets" @update:model-value="round++" />
  <div class="h-72 overflow-auto rounded-card border border-line bg-surface-soft p-3">
    <div class="flex h-56 items-end justify-center pb-4 text-xs text-muted">↓ scroll down ↓</div>
    <LpRevealOnScroll :key="preset + round" :preset="preset" :stagger="80" class="flex flex-col gap-2">
      <LpCard v-for="n in 5" :key="n" variant="flat" class="text-sm">Card {{ n }}</LpCard>
    </LpRevealOnScroll>
    <div class="h-24" />
  </div>
</div>`,
    thumb: `<LpRevealOnScroll :key="tRound" :stagger="120" class="flex w-56 flex-col gap-2">
  <LpCard v-for="n in 3" :key="n" variant="flat" padded class="py-2 text-sm">Section {{ n }}</LpCard>
</LpRevealOnScroll>`,
    thumbLoop: { every: 1800, frames: [{ tRound: 0 }, { tRound: 1 }] },
  },
  {
    id: "spotlight",
    name: "Spotlight",
    description:
      "A soft glow that follows the mouse inside a surface, so the tile about to be clicked is lit without a hover border shouting it. On a card it is the `spotlight` prop of LpCard; LpSpotlight wraps anything else. `color`, `size` and `strength` tune it. The position is written to custom properties once per frame, never through a re-render; touch and reduced motion draw nothing.",
    components: { LpSpotlight, LpCard },
    template: `<div class="grid w-[32rem] grid-cols-2 gap-3">
  <LpCard v-for="n in 4" :key="n" spotlight interactive>
    <p class="m-0 text-sm font-medium text-ink">Instance {{ n }}</p>
    <p class="m-0 mt-1 text-xs text-muted">Move the mouse over the cards.</p>
  </LpCard>
  <LpSpotlight color="var(--color-action)" :size="200" :strength="28" class="col-span-2 border border-line bg-surface p-4 text-sm text-muted">
    Any element: LpSpotlight with the action colour.
  </LpSpotlight>
</div>`,
    thumb: `<div class="w-60">
  <LpCard spotlight data-lp-spot :style="{ '--lp-spot-x': tX + 'px', '--lp-spot-y': '40px' }">
    <p class="m-0 text-sm font-medium text-ink">Instance</p>
    <p class="m-0 mt-1 text-xs text-muted">The glow follows the mouse.</p>
  </LpCard>
</div>`,
    thumbLoop: { every: 900, frames: [{ tX: 60 }, { tX: 130 }, { tX: 200 }, { tX: 130 }] },
  },
  {
    id: "glow-border",
    name: "Glow border",
    description:
      "A gradient running round the edge, for the one item that must be noticed first: a new release, the recommended option. Several on one screen cancel each other out. On a card it is LpCard's `glow`; LpGlowBorder wraps anything else (pass a radius class matching the child). Pure CSS: the angle is a registered property, so where `@property` is missing (older WebKitGTK) and under reduced motion the ring is a still gradient. `active` fades it out without changing the layout.",
    components: { LpGlowBorder, LpCard, LpBadge, LpButton, LpSwitch },
    state: () => reactive({ on: true }),
    template: `<div class="flex w-96 flex-col gap-4">
  <LpSwitch v-model="on" label="Highlighted" />
  <LpGlowBorder :active="on">
    <LpCard>
      <div class="flex items-center justify-between gap-2">
        <p class="m-0 text-sm font-medium text-ink">Fabric 0.16 pack</p>
        <LpBadge tone="brand">New</LpBadge>
      </div>
      <p class="m-0 mt-1 text-xs text-muted">Recommended for this instance.</p>
    </LpCard>
  </LpGlowBorder>
  <LpCard glow spotlight>
    <p class="m-0 text-sm text-ink">LpCard with glow and spotlight together.</p>
  </LpCard>
  <LpGlowBorder from="var(--color-success)" to="var(--color-brand)" :speed="2.5" :width="2" class="self-start rounded-pill">
    <LpButton class="rounded-pill">Update available</LpButton>
  </LpGlowBorder>
</div>`,
    thumb: `<div class="w-60">
  <LpCard glow>
    <div class="flex items-center justify-between gap-2">
      <p class="m-0 text-sm font-medium text-ink">Fabric pack</p>
      <LpBadge tone="brand">New</LpBadge>
    </div>
    <p class="m-0 mt-1 text-xs text-muted">Recommended.</p>
  </LpCard>
</div>`,
  },
  {
    id: "magnetic",
    name: "Magnetic",
    description:
      "Leans what it wraps toward a nearby mouse and springs back when it leaves, so the one primary action of a screen (the launcher's Play) meets the cursor a little way. Keep it to one or two per screen. `reach` is how far past the edge the pull is felt, `strength` the fraction of the distance it travels. Layout is untouched (only `translate` moves); touch and reduced motion leave it still.",
    components: { LpMagnetic, LpButton },
    template: `<div class="flex h-48 w-96 items-center justify-center gap-8">
  <LpMagnetic><LpButton size="lg">Play</LpButton></LpMagnetic>
  <LpMagnetic :reach="40" :strength="0.4"><LpButton variant="outline">Stronger, shorter</LpButton></LpMagnetic>
</div>`,
    thumb: `<div class="flex h-24 items-center justify-center">
  <div class="transition-[translate] duration-(--duration-slow) ease-(--ease-settle)" :style="{ translate: tPull }">
    <LpButton size="lg">Play</LpButton>
  </div>
</div>`,
    thumbLoop: { every: 1100, frames: [{ tPull: "0px 0px" }, { tPull: "8px -4px" }, { tPull: "0px 0px" }, { tPull: "-7px 3px" }] },
  },
]
