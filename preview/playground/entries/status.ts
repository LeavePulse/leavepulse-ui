import { reactive } from "vue"
import {
  LpActivityLine,
  LpButton,
  LpCard,
  LpGauge,
  LpQuota,
  LpRelativeTime,
  LpSegmented,
  LpSlider,
  LpStatus,
  LpSwitch,
} from "../../../src"
import type { ComponentEntry } from "./shared"

// Status and data: components built from ideas seen in other kits, written from scratch.
// Each array lands in the section it is named after (see registry.ts).

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
// Dates for the examples, fixed when the page loads so they age while it is
// open, which is exactly what LpRelativeTime is for.
const loadedAt = Date.now()

export const statusBasics: ComponentEntry[] = [
  {
    id: "status",
    name: "Status",
    description:
      "What state something is in, as a light and a word: online, offline, degraded, down, maintenance, starting, unknown. The caller passes the state; tone, pulse and wording follow, so every status in an app agrees. Live and transitional states pulse (in phase across the page), steady ones stay still; a change crossfades the light and rolls the word. `variant=\"pill\"` for a header chip, `hide-label` for a dense column (the word stays for screen readers and on hover), `announce` for the one status the user is waiting on.",
    components: { LpStatus, LpSegmented },
    state: () => reactive({ state: "starting" }),
    template: `<div class="flex flex-col gap-6">
  <LpSegmented
    v-model="state"
    size="sm"
    :options="['online', 'starting', 'degraded', 'down', 'maintenance', 'offline', 'unknown'].map((value) => ({ value, label: value }))"
  />
  <div class="flex flex-wrap items-center gap-6">
    <LpStatus :state="state" announce />
    <LpStatus :state="state" variant="pill" />
    <LpStatus :state="state" variant="pill" size="sm" />
    <LpStatus :state="state" hide-label />
  </div>

  <!-- A list of services: the light carries the state, the word confirms it. -->
  <ul class="flex w-72 flex-col divide-y divide-line text-sm">
    <li class="flex items-center justify-between py-2"><span class="text-ink">api-gateway</span><LpStatus state="online" /></li>
    <li class="flex items-center justify-between py-2"><span class="text-ink">matchmaker</span><LpStatus state="degraded" /></li>
    <li class="flex items-center justify-between py-2"><span class="text-ink">replays</span><LpStatus state="maintenance" /></li>
    <li class="flex items-center justify-between py-2"><span class="text-ink">eu-west-2</span><LpStatus state="down" /></li>
    <li class="flex items-center justify-between py-2"><span class="text-ink">beta-shard</span><LpStatus state="offline" label="Paused" /></li>
  </ul>
</div>`,
    thumb: `<div class="flex flex-col items-start gap-3">
  <LpStatus :state="tState" variant="pill" />
  <LpStatus state="online" />
  <LpStatus state="degraded" />
  <LpStatus state="down" />
</div>`,
    thumbLoop: {
      every: 1600,
      frames: [{ tState: "starting" }, { tState: "online" }, { tState: "degraded" }, { tState: "maintenance" }],
    },
  },
  {
    id: "relative-time",
    name: "Relative Time",
    description:
      "A date said the way people say it (\"3 minutes ago\", \"in 2 hours\") that keeps itself true: every instance shares one clock, and each sleeps until its own text would change, so a page of two hundred timestamps costs one timer. Locale from the prop or the app's ConfigProvider (Intl.RelativeTimeFormat), text rolls when it changes, the exact date is in a tooltip and `<time datetime>`. `formatRelativeTime` is exported for non-Vue callers.",
    components: { LpRelativeTime, LpSegmented },
    state: () => reactive({ style: "long", locale: "en" }),
    template: `<div class="flex flex-col gap-5">
  <div class="flex flex-wrap gap-3">
    <LpSegmented v-model="style" :options="['long', 'short', 'narrow'].map((value) => ({ value, label: value }))" />
    <LpSegmented v-model="locale" :options="['en', 'fr', 'de'].map((value) => ({ value, label: value }))" />
  </div>
  <dl class="grid w-80 grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
    <dt class="text-muted">Opened</dt><dd class="text-ink"><LpRelativeTime :date="${loadedAt}" :format="style" :locale="locale" /></dd>
    <dt class="text-muted">Last deploy</dt><dd class="text-ink"><LpRelativeTime :date="${loadedAt - 3 * MIN - 20_000}" :format="style" :locale="locale" /></dd>
    <dt class="text-muted">Backup</dt><dd class="text-ink"><LpRelativeTime :date="${loadedAt - 26 * HOUR}" :format="style" :locale="locale" /></dd>
    <dt class="text-muted">Next restart</dt><dd class="text-ink"><LpRelativeTime :date="${loadedAt + 2 * HOUR + 5 * MIN}" :format="style" :locale="locale" /></dd>
    <dt class="text-muted">Season ends</dt><dd class="text-ink"><LpRelativeTime :date="${loadedAt + 40 * DAY}" :format="style" :locale="locale" /></dd>
    <dt class="text-muted">Account created</dt><dd class="text-ink"><LpRelativeTime :date="${loadedAt - 420 * DAY}" :format="style" :locale="locale" :tooltip="false" /></dd>
  </dl>
</div>`,
    thumb: `<div class="flex flex-col gap-2 text-sm">
  <div class="flex justify-between gap-6"><span class="text-muted">Deployed</span><LpRelativeTime class="text-ink" :date="tDeploy" :tooltip="false" /></div>
  <div class="flex justify-between gap-6"><span class="text-muted">Restart</span><LpRelativeTime class="text-ink" :date="tRestart" :tooltip="false" /></div>
  <div class="flex justify-between gap-6"><span class="text-muted">Backup</span><LpRelativeTime class="text-ink" :date="${loadedAt - 26 * HOUR}" :tooltip="false" /></div>
</div>`,
    thumbLoop: {
      every: 1600,
      frames: [
        { tDeploy: loadedAt - 3 * MIN, tRestart: loadedAt + 2 * HOUR },
        { tDeploy: loadedAt - 4 * MIN, tRestart: loadedAt + 90 * MIN },
        { tDeploy: loadedAt - 5 * MIN, tRestart: loadedAt + 40 * MIN },
        { tDeploy: loadedAt, tRestart: loadedAt + 10 * MIN },
      ],
    },
  },
]

export const statusForms: ComponentEntry[] = []

export const statusData: ComponentEntry[] = [
  {
    id: "gauge",
    name: "Gauge",
    description:
      "One reading within a range, as a dial: CPU load, disk, a score. Steps of the scale (`thresholds`, in the gauge's own units) colour the arc and notch the track; unset, the capacity scale applies (warning from 80%, danger from 90%), the same one LpProgress and LpQuota use. Arc and figure move off one tweened value, sweep in when first seen, and the gauge is a `role=\"meter\"` whose spoken value names the step it is in. `variant=\"full\"` is a 270° dial. LpProgress's ring stays the shape for progress toward done.",
    components: { LpGauge, LpSlider },
    state: () => reactive({ load: 64, score: 72 }),
    template: `<div class="flex flex-col gap-8">
  <div class="flex w-80 flex-col gap-3">
    <LpSlider v-model="load" :min="0" :max="100" />
  </div>
  <div class="flex flex-wrap items-end gap-8">
    <LpGauge :value="load" label="CPU" unit="%" />
    <LpGauge :value="load" label="CPU" unit="%" variant="full" :size="140" />
    <!-- Higher is better: the steps rise toward ok. -->
    <LpGauge
      :value="score"
      label="Match score"
      :thresholds="[{ at: 0, tone: 'danger' }, { at: 50, tone: 'warning' }, { at: 75, tone: 'ok' }]"
      :size="140"
    />
    <LpGauge :value="load * 0.9 + 20" :min="20" :max="110" label="GPU" unit="°C" tone="brand" :show-thresholds="false" :size="120" />
  </div>
  <div class="flex w-80 flex-col gap-3">
    <span class="text-xs text-muted">Score</span>
    <LpSlider v-model="score" :min="0" :max="100" />
  </div>
</div>`,
    thumb: `<div class="flex items-end gap-5">
  <LpGauge :value="tLoad" label="CPU" unit="%" :size="128" :animate-on-mount="false" />
  <LpGauge :value="tTemp" :min="20" :max="100" label="Temp" unit="°" variant="full" :size="96" :show-thresholds="false" :animate-on-mount="false" tone="brand" />
</div>`,
    thumbLoop: {
      every: 1800,
      frames: [
        { tLoad: 42, tTemp: 55 },
        { tLoad: 84, tTemp: 71 },
        { tLoad: 96, tTemp: 88 },
        { tLoad: 23, tTemp: 47 },
      ],
    },
  },
  {
    id: "quota",
    name: "Quota",
    description:
      "\"Used of limit\": label, reading in its unit (`unit=\"bytes\"` scales in binary steps through Intl's own unit names, a string is a suffix, a function says it its own way), a bar, and what is left. The tone rises toward the limit; past it the bar stretches to hold what is used and the limit becomes a mark along it, so 12 of 10 GB reads as running over a line instead of as a full bar. `parts` stack the bar with a legend. No limit reads \"No limit\" and drops the bar.",
    components: { LpQuota, LpSlider },
    state: () => reactive({ used: 6.2 }),
    template: `<div class="flex w-96 flex-col gap-8">
  <LpSlider v-model="used" :min="0" :max="14" :step="0.1" />
  <LpQuota label="Storage" :used="used * 1024 ** 3" :limit="10 * 1024 ** 3" unit="bytes" />
  <LpQuota
    label="Storage by kind"
    :limit="10 * 1024 ** 3"
    :used="used * 1024 ** 3"
    unit="bytes"
    :parts="[
      { label: 'Replays', value: used * 0.55 * 1024 ** 3 },
      { label: 'Backups', value: used * 0.3 * 1024 ** 3 },
      { label: 'Logs', value: used * 0.15 * 1024 ** 3 },
    ]"
  />
  <LpQuota label="Seats" :used="Math.round(used)" :limit="12" unit="seats" />
  <LpQuota label="Webhooks" :used="Math.round(used * 3)" unit="hooks" />
</div>`,
    thumb: `<div class="flex w-64 flex-col gap-4">
  <LpQuota label="Storage" :used="tUsed * 1024 ** 3" :limit="10 * 1024 ** 3" unit="bytes" :animate-on-mount="false" />
  <LpQuota label="Seats" :used="tSeats" :limit="12" unit="seats" :animate-on-mount="false" />
</div>`,
    thumbLoop: {
      every: 1900,
      frames: [
        { tUsed: 4.2, tSeats: 5 },
        { tUsed: 8.6, tSeats: 10 },
        { tUsed: 12.4, tSeats: 12 },
        { tUsed: 6.1, tSeats: 7 },
      ],
    },
  },
  {
    id: "activity-line",
    name: "Activity Line",
    description:
      "A hairline over the edge of a card, table or page saying \"something is happening here\": a sweep while the length of the work is unknown, a fill once `value` is known, and on `active` going false a run to the end and a fade. It waits `delay` ms before appearing, so a fast load never flashes it, and lies over the edge of its positioned parent without moving anything (`placement=\"inline\"` takes a line in the flow instead).",
    components: { LpActivityLine, LpButton, LpCard, LpSwitch },
    state: () => reactive({ active: true, determinate: false, value: 30 }),
    template: `<div class="flex w-96 flex-col gap-4">
  <div class="flex flex-wrap items-center gap-4 text-sm text-muted">
    <label class="flex items-center gap-2"><LpSwitch v-model="active" /> Active</label>
    <label class="flex items-center gap-2"><LpSwitch v-model="determinate" /> Known progress</label>
    <LpButton size="sm" variant="soft" @click="value = Math.min(100, value + 20)">+20%</LpButton>
    <LpButton size="sm" variant="soft" @click="value = 0">Reset</LpButton>
  </div>
  <LpCard class="relative overflow-hidden">
    <LpActivityLine :active="active" :value="determinate ? value : null" />
    <div class="flex flex-col gap-1 text-sm">
      <span class="text-ink">Match history</span>
      <span class="text-muted">The line sits on the card's top edge and takes no room.</span>
    </div>
  </LpCard>
</div>`,
    thumb: `<div class="flex w-64 flex-col gap-3">
  <LpCard class="relative overflow-hidden">
    <LpActivityLine :active="tActive" :value="tValue" :delay="0" />
    <div class="flex flex-col gap-2">
      <div class="h-2 w-24 rounded-pill bg-surface-soft" />
      <div class="h-2 w-40 rounded-pill bg-surface-soft" />
      <div class="h-2 w-32 rounded-pill bg-surface-soft" />
    </div>
  </LpCard>
</div>`,
    thumbLoop: {
      every: 1400,
      frames: [
        { tActive: true, tValue: null },
        { tActive: true, tValue: null },
        { tActive: true, tValue: 40 },
        { tActive: true, tValue: 80 },
        { tActive: false, tValue: 80 },
      ],
    },
  },
]

export const statusOverlays: ComponentEntry[] = []
export const statusMotion: ComponentEntry[] = []
