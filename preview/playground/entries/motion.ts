import { reactive } from "vue"
import {
  LpBadge,
  LpButton,
  LpCard,
  LpDisclosure,
  LpInput,
  LpShift,
  LpSwap,
  LpSlider,
  LpRangeSlider,
  LpVideoBackdrop,
  formatClipTime,
  LpSwitch,
  LpSegmented,
  LpTabs,
  LpTilt,
} from "../../../src"
import videoBackdropSample from "../../assets/video-backdrop-sample.webm"
import { type ComponentEntry } from "./shared"

export const motion: ComponentEntry[] = [
  {
    id: "swap",
    name: "Swap",
    description:
      "One piece of content standing in for another: the section picked in a side nav, a wizard step, the view chosen in a segmented control. The outgoing content fades out, the incoming one rises in like LpTabs panels, and the box eases between the two heights (LpShift), so what sits below glides instead of jumping. `swapKey` decides what counts as another piece: key it by section, not by record, or a data refresh replays the entrance.",
    components: { LpSwap, LpSegmented, LpCard },
    state: () =>
      reactive({
        view: "short",
        views: [
          { value: "short", label: "Short" },
          { value: "long", label: "Long" },
          { value: "list", label: "List" },
        ],
      }),
    template: `<div class="flex w-96 flex-col gap-3">
  <LpSegmented v-model="view" :options="views" />
  <LpCard>
    <LpSwap :swap-key="view">
      <p v-if="view === 'short'" class="text-sm text-muted">A single line of content.</p>
      <p v-else-if="view === 'long'" class="text-sm leading-relaxed text-muted">
        A longer paragraph that takes several lines, so the card has to grow. Without the swap the
        card would snap to its new height in one frame and the line below would jump with it.
      </p>
      <ul v-else class="flex flex-col gap-1 text-sm text-muted">
        <li v-for="n in 5" :key="n">Row {{ n }}</li>
      </ul>
    </LpSwap>
  </LpCard>
  <p class="text-xs text-muted">This line rides the card's height instead of jumping.</p>
</div>`,
    thumb: `<div class="flex w-64 flex-col gap-2">
  <LpSegmented :model-value="tView" :options="views" size="sm" />
  <LpCard>
    <LpSwap :swap-key="tView">
      <p v-if="tView === 'short'" class="m-0 text-sm text-muted">One line.</p>
      <p v-else-if="tView === 'long'" class="m-0 text-sm leading-relaxed text-muted">A longer paragraph that takes two lines, so the card grows.</p>
      <ul v-else class="m-0 flex list-none flex-col gap-1 p-0 text-sm text-muted"><li>api-1 · healthy</li><li>api-2 · healthy</li><li>worker · restarting</li></ul>
    </LpSwap>
  </LpCard>
</div>`,
    thumbLoop: { every: 2200, frames: [{ tView: "long" }, { tView: "list" }, { tView: "short" }] }
  },
  {
    id: "shift",
    name: "Shift",
    description:
      "Eases a box whose size comes from its content, so what sits around it glides instead of jumping. Reach for it wherever a change of content changes measurements: a toolbar gaining a button, a label swapped by a translation, a validation message appearing under a field. `axis` picks the dimension that is content-derived \u2014 pin only the one that actually moves. Note it is the NEIGHBOURS that motivate it: the row below is what jolts when a box above resizes in one frame.",
    components: { LpShift, LpButton, LpBadge, LpCard },
    state: () =>
      reactive({
        eased: true,
        extra: false,
        detail: false,
      }),
    template: `<div class="flex w-96 flex-col gap-4">
  <div class="flex items-center gap-2">
    <LpButton size="sm" variant="outline" @click="extra = !extra">
      {{ extra ? 'Remove' : 'Add' }} a control
    </LpButton>
    <LpButton size="sm" variant="outline" @click="detail = !detail">
      {{ detail ? 'Collapse' : 'Expand' }} detail
    </LpButton>
    <LpButton size="sm" variant="ghost" @click="eased = !eased">
      {{ eased ? 'Easing on' : 'Easing off' }}
    </LpButton>
  </div>

  <!-- width: the row of controls is content-derived, and the badge after it is
       what would otherwise jump sideways. -->
  <div class="flex items-center gap-2">
    <LpShift axis="width" :disabled="!eased">
      <div class="flex items-center gap-2">
        <LpButton size="sm">Deploy</LpButton>
        <LpButton v-if="extra" size="sm" variant="outline">Roll back</LpButton>
      </div>
    </LpShift>
    <LpBadge tone="neutral">\u2190 this shifts</LpBadge>
  </div>

  <!-- height: the card grows, and the line under it rides the tween. -->
  <LpShift axis="height" :disabled="!eased">
    <LpCard variant="flat" padded>
      <p class="m-0 text-sm text-ink">app-vps-1 \u00b7 healthy</p>
      <p v-if="detail" class="m-0 mt-2 text-sm leading-relaxed text-muted">
        14 services, last reconciled 40 seconds ago. The private address is
        pinned to the bridge, and the health gate reads the ready endpoint.
      </p>
    </LpCard>
  </LpShift>
  <span class="text-sm text-muted">\u2191 toggle with easing off to see the jump</span>
</div>`,
    thumb: `<div class="flex flex-col items-center gap-3">
  <div class="flex items-center gap-2">
    <LpShift axis="width">
      <div class="flex items-center gap-2">
        <LpButton size="sm">Deploy</LpButton>
        <LpButton v-if="tMore" size="sm" variant="outline">Roll back</LpButton>
      </div>
    </LpShift>
    <LpBadge tone="neutral">← this shifts</LpBadge>
  </div>
  <LpCard variant="flat" padded class="w-64"><p class="m-0 text-sm text-ink">app-vps-1 · healthy</p></LpCard>
</div>`,
    thumbLoop: { every: 2000, frames: [{ tMore: true }, { tMore: false }] }
  },
  {
    id: "disclosure",
    name: "Disclosure",
    description: "Collapsible \"show more\" section. label/icon or a #trigger slot; height + fade animate on toggle. scroll-into-view smooth-scrolls the block into view on open so revealed content isn't left below the fold.",
    components: { LpDisclosure, LpInput },
    state: () => reactive({ open: false, value: "" }),
    template: `<!-- scroll-into-view needs a scroll container to demo: this box scrolls,
     and the spacers push the block below the fold. Open it to watch it
     smooth-scroll itself to the top. -->
<div class="h-64 w-80 overflow-auto rounded-card border border-line bg-surface-soft p-3">
  <div class="flex h-40 items-end justify-center text-xs text-muted">↓ scroll down, then open ↓</div>
  <div class="flex flex-col gap-3 py-3">
    <LpDisclosure label="Customize text" icon="lucide:sliders-horizontal" scroll-into-view>
      <LpInput v-model="value" placeholder="Details template…" />
      <p class="text-xs text-muted">Body animates open, fades in, and the block scrolls into view.</p>
    </LpDisclosure>
    <LpDisclosure v-model:open="open" default-open>
      <template #trigger>Advanced (custom #trigger) — {{ open ? "open" : "closed" }}</template>
      <p class="text-sm text-muted">Controlled via v-model:open, starts open.</p>
    </LpDisclosure>
  </div>
  <div class="flex h-40 items-start justify-center text-xs text-muted">extra space below</div>
</div>`,
    thumb: `<div class="w-64">
  <LpDisclosure label="Customize text" icon="lucide:sliders-horizontal" :open="tOpen">
    <p class="m-0 text-sm text-muted">Revealed content eases in under the trigger.</p>
  </LpDisclosure>
</div>`,
    thumbLoop: { every: 1800, frames: [{ tOpen: true }, { tOpen: false }] },
  },
  {
    id: "video-backdrop",
    name: "VideoBackdrop",
    description:
      "A muted looping video behind something, filling the positioned box it sits in. Loops a stretch of the clip (start, end), blends the seam so a clip whose last frame does not match its first loops without a jump (crossfade), plays faster or slower (rate) and darkens under text (dim). Pauses on paused, in a hidden tab, off screen and under reduced motion, where it shows the stretch's first frame. The sample clip jumps from its last frame to its first: set crossfade to 0 to see the cut it hides.",
    components: { LpVideoBackdrop, LpRangeSlider, LpSlider, LpSwitch },
    state: () =>
      reactive({
        src: videoBackdropSample,
        duration: 6,
        clip: [0, 6] as [number, number],
        crossfade: 0.8,
        rate: 1,
        dim: 0.25,
        paused: false,
        formatClipTime,
      }),
    template: `<div class="flex w-[28rem] flex-col gap-4">
  <div class="relative aspect-video overflow-hidden rounded-card border border-line">
    <LpVideoBackdrop
      :src="src"
      :start="clip[0]"
      :end="clip[1]"
      :crossfade="crossfade"
      :rate="rate"
      :dim="dim"
      :paused="paused"
      @loaded="(info) => { duration = info.duration; clip = [0, info.duration] }"
    />
    <div class="relative flex h-full items-end p-4 text-lg font-semibold text-white">Text over the backdrop</div>
  </div>
  <label class="text-xs text-muted">Loop {{ formatClipTime(clip[0], true) }} to {{ formatClipTime(clip[1], true) }}</label>
  <LpRangeSlider v-model="clip" :min="0" :max="duration" :step="0.1" :min-gap="0.5" :format="(v) => formatClipTime(v, true)" />
  <label class="text-xs text-muted">Crossfade {{ crossfade.toFixed(1) }} s</label>
  <LpSlider :model-value="crossfade * 10" :min="0" :max="20" @update:model-value="(v) => (crossfade = v / 10)" />
  <label class="text-xs text-muted">Speed {{ rate }}×</label>
  <LpSlider :model-value="rate * 100" :min="25" :max="200" :step="5" @update:model-value="(v) => (rate = v / 100)" />
  <label class="text-xs text-muted">Dim {{ Math.round(dim * 100) }}%</label>
  <LpSlider :model-value="dim * 100" :min="0" :max="80" @update:model-value="(v) => (dim = v / 100)" />
  <div class="flex items-center gap-2 text-sm"><LpSwitch v-model="paused" /> Paused</div>
</div>`,
    thumb: `<div class="relative h-32 w-60 overflow-hidden rounded-card border border-line">
  <LpVideoBackdrop :src="src" :dim="0.25" paused />
  <div class="relative flex h-full items-end p-3 text-sm font-semibold text-white">Text over the backdrop</div>
</div>`,
  },
  {
    id: "tilt",
    name: "Tilt",
    description:
      "Pointer-tracking 3D tilt wrapper — rotates toward the cursor with an optional glare sweep and hover lift. Wrap any card.",
    components: { LpTilt, LpCard, LpBadge },
    template: `<div class="flex flex-wrap gap-6">
  <LpTilt class="w-56">
    <LpCard class="flex flex-col gap-2">
      <span class="font-semibold text-ink">Default tilt</span>
      <span class="text-sm text-muted">Move the pointer across the card.</span>
    </LpCard>
  </LpTilt>
  <LpTilt glare :max="16" :lift="8" class="w-56">
    <LpCard class="flex flex-col gap-2">
      <span class="font-semibold text-ink">Glare + stronger</span>
      <span class="text-sm text-muted">max=16, lift=8, glare on.</span>
      <LpBadge tone="brand">Hover me</LpBadge>
    </LpCard>
  </LpTilt>
</div>`,
    thumb: `<LpTilt glare :max="16" :lift="8" class="w-56">
  <LpCard class="flex flex-col gap-2">
    <span class="font-semibold text-ink">Tilt</span>
    <span class="text-sm text-muted">Leans toward the pointer.</span>
    <LpBadge tone="brand" class="self-start">Hover me</LpBadge>
  </LpCard>
</LpTilt>`,
  },
]
