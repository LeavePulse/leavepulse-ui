import { reactive, ref } from "vue"
import {
  confirm,
  LpMediaGallery,
  LpBadge,
  LpButton,
  LpChart,
  LpConfirmDialog,
  LpEmptyState,
  LpFileTree,
  type FileNode,
  LpIcon,
  LpInput,
  LpLightbox,
  type LightboxItem,
  LpLogViewer,
  LpNumberFlow,
  LpPagination,
  LpPie,
  LpProgress,
  LpRollingText,
  LpScrollArea,
  LpSlider,
  LpSparkline,
  LpStat,
  LpSwitch,
  LpTable,
  LpSegmented,
  LpUptimeBar,
  useTableFilterChoice,
  type TableFilters,
} from "../../../src"
import { ConfigScope } from "../demos"
import { type ComponentEntry } from "./shared"

export const data: ComponentEntry[] = [
  {
    id: "stat",
    name: "Stat",
    description:
      "Metric tile: label, mono value, hint, and an optional delta/trend badge. Numeric delta auto-derives direction & sign; invertTrend flips colours for \"lower is better\" metrics (latency, errors). `loading` pulses the value and the delta inside their own type size, so the tile is the same height loading and loaded and a KPI row does not move when the figures land.",
    components: { LpStat, LpSwitch },
    state: () => reactive({ loading: false }),
    template: `<div class="flex w-full flex-col gap-4">
  <label class="flex items-center gap-2 text-sm text-muted"><LpSwitch v-model="loading" /> Loading</label>
  <div class="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
    <LpStat online label="Servers online" value="43" hint="Responding now." :loading="loading" />
    <LpStat label="Revenue" value="€8,420" :delta="12.4" delta-suffix="%" hint="vs last week" :loading="loading" />
    <LpStat label="Avg latency" value="48 ms" :delta="-6" invert-trend hint="lower is better" :loading="loading" />
    <LpStat label="Signups" :value="312" delta="+18%" :loading="loading" />
  </div>
</div>`,
    thumb: `<div class="grid w-72 grid-cols-2 gap-4">
  <LpStat online label="Servers online" :value="tOnline" />
  <LpStat label="Revenue" :value="tRevenue" :delta="tDelta" delta-suffix="%" />
</div>`,
    thumbLoop: { every: 2000, frames: [{ tOnline: "43", tRevenue: "€8,420", tDelta: 12.4 }, { tOnline: "41", tRevenue: "€8,135", tDelta: -3.4 }, { tOnline: "46", tRevenue: "€9,010", tDelta: 7.1 }] }
  },
  {
    id: "progress",
    name: "Progress",
    description:
      "One value as a bar or a ring — same data, same tones. `variant=\"ring\"` for KPI dials, where a percentage should read at a glance. A `class` lands on the outside of either and is merged, so `h-2.5` thickens a bare bar and `w-40` narrows a titled one.",
    components: { LpProgress, LpSlider, LpButton },
    state: () => reactive({ live: 35 }),
    template: `<div class="flex flex-col gap-8">
  <!-- Driven, because a static gauge cannot show the thing a gauge is for:
       what it does when the number CHANGES. -->
  <div class="flex w-80 flex-col gap-3">
    <LpSlider v-model="live" :min="0" :max="100" />
    <div class="flex gap-2">
      <LpButton size="sm" variant="soft" @click="live = 12">12</LpButton>
      <LpButton size="sm" variant="soft" @click="live = 64">64</LpButton>
      <LpButton size="sm" variant="soft" @click="live = 97">97</LpButton>
    </div>
    <LpProgress :value="live" tone="auto" title="Live" caption />
    <LpProgress :value="live" variant="ring" tone="auto" class="self-start" />
  </div>

  <div class="flex w-80 flex-col gap-3">
    <LpProgress :value="35" />
    <LpProgress :value="55" class="h-2.5" />
    <LpProgress :value="70" tone="action" />
    <LpProgress :value="90" tone="danger" />
  </div>

  <!-- A usage row: title + reading, and tone="auto" colouring itself by how
       full it is. This is what a capacity gauge needs, so it lives here rather
       than being rebuilt (with raw colours) in each consumer. -->
  <div class="flex w-80 flex-col gap-3">
    <LpProgress title="CPU" :value="34" tone="auto" caption />
    <LpProgress title="Memory" :value="82" tone="auto" caption="52 GB / 64 GB" />
    <LpProgress title="Disk" :value="94" tone="auto" caption="924 GB / 983 GB" />
  </div>

  <div class="flex flex-wrap items-center gap-6">
    <LpProgress variant="ring" :value="85" label />
    <LpProgress variant="ring" :value="92" tone="action" label />
    <LpProgress variant="ring" :value="68" tone="accent" label />
    <LpProgress variant="ring" :value="97" tone="danger" label />
    <LpProgress variant="ring" :value="100" tone="action" label />
    <LpProgress variant="ring" :value="42" :size="64" :thickness="6" label="3/8" />
    <LpProgress variant="ring" :value="60" :size="20" :thickness="3" />
  </div>
</div>`,
    thumb: `<div class="flex w-64 items-center gap-5">
  <div class="flex min-w-0 flex-1 flex-col gap-3">
    <LpProgress title="CPU" :value="tCpu" tone="auto" caption :animate-on-mount="false" />
    <LpProgress title="Disk" :value="tDisk" tone="auto" caption :animate-on-mount="false" />
  </div>
  <LpProgress variant="ring" :value="tCpu" :size="56" label :animate-on-mount="false" />
</div>`,
    thumbLoop: { every: 1800, frames: [{ tCpu: 64, tDisk: 94 }, { tCpu: 31, tDisk: 72 }, { tCpu: 88, tDisk: 51 }] }
  },
  {
    id: "number-flow",
    name: "Number Flow / Rolling Text",
    description:
      "A figure that travels to its new value, and text that moves aside for its replacement. Both exist so a change is visible as a change — in place, an updated value tells the reader nothing about where it came from.",
    components: { LpNumberFlow, LpRollingText, LpButton, LpSegmented },
    state: () =>
      reactive({
        n: 10000,
        money: 8420.5,
        statuses: ["operational", "degraded", "maintenance", "down"],
        si: 0,
        status: "operational",
        mode: "slide",
        modes: [
          { value: "slide", label: "slide" },
          { value: "flip", label: "flip" },
        ],
      }),
    template: `<div class="flex w-full max-w-2xl flex-col gap-10">
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-baseline gap-6">
      <LpNumberFlow class="font-mono text-4xl font-medium text-ink" :value="n" grouped />
      <LpNumberFlow class="font-mono text-4xl font-medium text-brand" :value="n" compact />
      <LpNumberFlow class="font-mono text-2xl text-muted-strong" :value="money" prefix="€" :decimals="2" grouped />
    </div>
    <div class="flex flex-wrap gap-2">
      <LpButton size="sm" variant="soft" @click="n = 10000; money = 8420.5">10k</LpButton>
      <LpButton size="sm" variant="soft" @click="n = 100000; money = 24980.75">100k</LpButton>
      <LpButton size="sm" variant="soft" @click="n = 1000000; money = 512300.4">1M</LpButton>
      <LpButton size="sm" variant="soft" @click="n = 42; money = 19.99">42</LpButton>
    </div>
    <p class="text-xs text-muted">
      The distance is covered in one beat — stepping by +1 from 10k to 1M would
      take a month. \`compact\` abbreviates; without it the figure stays exact.
    </p>
  </div>

  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-6">
      <LpRollingText
        class="font-mono text-2xl font-medium text-ink"
        :value="status"
        :mode="mode"
        align="start"
      />
      <LpSegmented v-model="mode" :options="modes" size="sm" />
    </div>
    <div>
      <LpButton
        size="sm"
        variant="soft"
        @click="si = (si + 1) % statuses.length; status = statuses[si]"
      >
        Next status
      </LpButton>
    </div>
    <p class="text-xs text-muted">
      slide reads as a reel advancing; flip as one object showing another side.
      Both are used in LpPie's centre — hover its slices to see them together.
    </p>
  </div>
</div>`,
    thumb: `<div class="flex flex-col items-center gap-2">
  <LpNumberFlow class="font-mono text-3xl font-medium text-ink" :value="tCount" grouped />
  <LpRollingText class="font-mono text-lg text-muted-strong" :value="tWord" />
</div>`,
    thumbLoop: { every: 1900, frames: [{ tCount: 1250000, tWord: "operational" }, { tCount: 1318402, tWord: "degraded" }, { tCount: 1402977, tWord: "recovering" }] }
  },
  {
    id: "pie",
    name: "Pie / Donut",
    description:
      "Shares of a whole. Takes any number of slices: the tail folds into \"Other\" (which keeps its total and a count) so twenty categories stay readable without losing data. Hover lifts a slice; click pins a selection — Ctrl toggles, Shift takes a range, dragging across gathers, right-click opens a menu. The legend works from the keyboard, and `data-table` (on Services) adds a visually hidden table for screen readers. `loading` draws a pulsing ring (a disc for `pie`) at the chart's size with legend rows beside it, and eases into the chart; the sweep waits for the data.",
    components: { LpPie, LpSwitch },
    state: () =>
      reactive({
        loading: false,
        disk: [
          { label: "Containers", value: 412 },
          { label: "Images", value: 186 },
          { label: "Volumes", value: 143 },
          { label: "Logs", value: 61 },
          { label: "Free", value: 181, color: "var(--color-surface-soft)" },
        ],
        fleet: [
          { label: "Running", value: 38, color: "var(--color-action)" },
          { label: "Stopped", value: 3, color: "var(--color-muted)" },
          { label: "Crashloop", value: 1, color: "var(--color-danger)" },
        ],
        // Twenty categories: what a shared kit actually gets handed.
        langs: [
          { label: "TypeScript", value: 4120 }, { label: "Python", value: 3880 },
          { label: "Rust", value: 2140 }, { label: "Vue", value: 1980 },
          { label: "Java", value: 940 }, { label: "Go", value: 610 },
          { label: "Shell", value: 420 }, { label: "SQL", value: 380 },
          { label: "CSS", value: 310 }, { label: "Kotlin", value: 240 },
          { label: "HTML", value: 190 }, { label: "Dockerfile", value: 160 },
          { label: "YAML", value: 140 }, { label: "TOML", value: 95 },
          { label: "Proto", value: 88 }, { label: "Makefile", value: 42 },
          { label: "JSON", value: 38 }, { label: "Lua", value: 21 },
          { label: "Nix", value: 12 }, { label: "Perl", value: 4 },
        ],
        picked: "nothing selected",
        sliceMenu: (slice: { label: string }, selection: { label: string }[]) =>
          selection.length > 1
            ? [
                { label: `Compare ${selection.length} slices`, icon: "lucide:git-compare" },
                { label: "Copy totals", icon: "lucide:copy", separatorBefore: true },
              ]
            : [
                { label: `Drill into ${slice.label}`, icon: "lucide:search" },
                { label: "Exclude", icon: "lucide:eye-off" },
                { label: "Copy value", icon: "lucide:copy", shortcut: "⌘C", separatorBefore: true },
              ],
      }),
    template: `<div class="flex w-full max-w-3xl flex-col gap-10">
  <label class="flex items-center gap-2 text-sm text-muted"><LpSwitch v-model="loading" /> Loading</label>
  <div class="-mt-6 flex flex-wrap gap-10 max-sm:justify-center">
    <LpPie
      :slices="disk"
      :loading="loading"
      title="Disk usage"
      subtitle="data-vps · 983 GB"
      unit=" GB"
      :show-percent="false"
      :menu-items="sliceMenu"
      @selection-change="picked = $event.length ? $event.map(s => s.label).join(' + ') : 'nothing selected'"
    />
    <LpPie
      :slices="fleet"
      type="pie"
      :loading="loading"
      title="Services"
      :size="150"
      :max-slices="0"
      data-table
    />
  </div>

  <p class="-mt-6 text-xs text-muted">
    Selected: {{ picked }} — click a slice, Ctrl-click to add, Shift for a range,
    drag across to gather, right-click for a menu.
  </p>

  <!-- 20 slices in, 6 drawn: the tail is summed, not dropped. -->
  <LpPie
    :slices="langs"
    title="Lines by language"
    subtitle="20 categories in — the tail folds into Other, which keeps its count"
    other-label="Other languages"
    sort-by-size
  />

  <!-- Callout mode: leader lines instead of a legend. Labels are stacked and
       pushed apart, so a cluster of slivers stays readable. -->
  <LpPie
    :slices="langs"
    type="pie"
    :labels="true"
    :size="200"
    title="Callouts"
    subtitle="Names on the leader lines — no legend to cross-reference"
    sort-by-size
  />

  <!-- The same 20, unfolded. Nothing is lost either way; this one is just
       harder to read, which is the point of the default. -->
  <LpPie
    :slices="langs"
    title="Same data, every slice drawn"
    :max-slices="0"
    :size="150"
    :show-total="false"
  />
</div>`,
    thumb: `<LpPie :slices="tFleet" :size="120" :show-total="false" />`,
    thumbLoop: {
      every: 2200,
      frames: [
        { tFleet: [{ label: "Running", value: 38, color: "var(--color-action)" }, { label: "Stopped", value: 3, color: "var(--color-muted)" }, { label: "Crashloop", value: 1, color: "var(--color-danger)" }] },
        { tFleet: [{ label: "Running", value: 30, color: "var(--color-action)" }, { label: "Stopped", value: 8, color: "var(--color-muted)" }, { label: "Crashloop", value: 4, color: "var(--color-danger)" }] },
        { tFleet: [{ label: "Running", value: 41, color: "var(--color-action)" }, { label: "Stopped", value: 1, color: "var(--color-muted)" }, { label: "Crashloop", value: 0, color: "var(--color-danger)" }] },
      ],
    }
  },
  {
    id: "sparkline",
    name: "Sparkline",
    description:
      "A trend with no axes — sized for a table cell or a stat tile. Measures nothing and holds no state, so a page can carry dozens. `loading` holds the line's box with a pulsing band, then the line draws itself in.",
    components: { LpSparkline, LpStat, LpBadge, LpSwitch },
    state: () =>
      reactive({
        loading: false,
        hosts: [
          { name: "app-vps-1", load: [0.4, 0.5, 0.4, 0.6, 0.5, 0.7, 0.6, 0.8, 1.1, 0.9, 1.0, 1.2], now: "1.24", tone: "brand", up: true },
          { name: "data-vps", load: [2.1, 2.0, 2.2, 1.9, 2.1, 2.0, 2.2, 2.1, 2.0, 2.1, 2.2, 2.0], now: "2.02", tone: "brand", up: true },
          { name: "proxy-vps-1", load: [0.2, 0.2, 0.3, 0.2, 1.9, 3.4, 3.9, 3.2, 1.1, 0.4, 0.3, 0.2], now: "0.21", tone: "accent", up: true },
          { name: "edge-vps-2", load: [1.2, 1.4, 1.9, 2.2, 2.8, 3.1, 3.6, 4.0, 4.4, 4.9, 5.2, 5.8], now: "5.81", tone: "danger", up: true },
          { name: "old-vps", load: [null, null, null, null, null, null, null, null, null, null, null, null], now: "—", tone: "muted", up: false },
        ],
        revenue: [18, 22, 19, 26, 31, 28, 35, 42, 39, 48, 52, 61],
        errors: [1, 0, 2, 1, 4, 12, 8, 3, 2, 1, 1, 0],
      }),
    template: `<div class="flex w-full max-w-2xl flex-col gap-8">
  <label class="flex items-center gap-2 text-sm text-muted"><LpSwitch v-model="loading" /> Loading</label>
  <!-- In a stat tile: the delta says how much, the shape says how. -->
  <div class="-mt-4 flex flex-wrap gap-10 max-sm:justify-center">
    <LpStat label="Revenue" :value="61200" prefix="€" compact :delta="12.5" delta-suffix="%" :loading="loading">
      <template #trend>
        <LpSparkline :data="revenue" area show-last :width="96" :loading="loading" />
      </template>
    </LpStat>
    <LpStat label="Errors" value="0" :delta="-100" delta-suffix="%" invert-trend :loading="loading">
      <template #trend>
        <LpSparkline :data="errors" tone="danger" :width="96" :loading="loading" />
      </template>
    </LpStat>
  </div>

  <!-- In a list: one row per machine, the trend inline with the number. -->
  <div class="flex flex-col divide-y divide-line rounded-card border border-line">
    <div v-for="h in hosts" :key="h.name" class="flex items-center gap-4 px-4 py-2.5">
      <span class="w-24 shrink-0 truncate sm:w-32 font-mono text-sm text-ink">{{ h.name }}</span>
      <span class="w-14 shrink-0 text-right font-mono text-sm tabular-nums text-muted-strong">{{ h.now }}</span>
      <LpSparkline :data="h.load" :tone="h.tone" show-last :loading="loading" />
      <LpBadge :tone="h.up ? 'success' : 'neutral'" class="ml-auto">
        {{ h.up ? 'online' : 'offline' }}
      </LpBadge>
    </div>
  </div>

  <p class="text-xs text-muted">
    Same number, different story: proxy-vps-1 spiked and recovered, edge-vps-2 is
    climbing. A bar or a bare figure shows neither.
  </p>
</div>`,
    thumb: `<div class="flex w-72 flex-col divide-y divide-line rounded-card border border-line">
  <div v-for="h in hosts.slice(1, 4)" :key="h.name" class="flex items-center gap-3 px-3 py-1.5">
    <span class="w-24 shrink-0 truncate font-mono text-xs text-ink">{{ h.name }}</span>
    <LpSparkline :data="[...h.load, ...[...h.load].reverse()].slice(tShift, tShift + 12)" :tone="h.tone" :width="80" :height="22" show-last />
    <span class="ml-auto font-mono text-xs tabular-nums text-muted-strong">{{ h.now }}</span>
  </div>
</div>`,
    thumbLoop: { every: 2000, frames: [{ tShift: 0 }, { tShift: 2 }, { tShift: 4 }, { tShift: 6 }] },
  },
  {
    id: "uptime-bar",
    name: "Uptime Bar",
    description: "Status-page uptime scale. The figure counts real time: give each slice its `durations` (ms in each state) and one bad minute costs a minute, not a whole slice; without them slices weigh by their `start`–`end` span. It is never rounded up to 100% over an outage, and `uptime` takes an exact figure from the server instead. Hovering a slice shows its span, the time it spent in each state and its `events`. `loading` pulses a row of ticks at the bar's height and holds the figure, so the captions around it stay put.",
    components: { LpUptimeBar, LpSwitch },
    state: () =>
      reactive({
        loading: false,
        days: Array.from({ length: 60 }, (_, i) => {
          const DAY = 86_400_000
          const MIN = 60_000
          const start = Date.UTC(2026, 7, 27) + i * DAY
          const trouble: Record<number, { status: "down" | "degraded" | "maintenance"; minutes: number; at: number; text: string }> = {
            12: { status: "down", minutes: 47, at: 14 * 60 + 5, text: "Database failover, 47 min down" },
            33: { status: "degraded", minutes: 180, at: 9 * 60, text: "Slow responses from the EU region" },
            34: { status: "degraded", minutes: 12, at: 7 * 60 + 40, text: "Latency spike" },
            50: { status: "maintenance", minutes: 20, at: 3 * 60, text: "Planned upgrade" },
          }
          const t = trouble[i]
          if (!t) return { status: "operational", start, end: start + DAY, durations: { operational: DAY } }
          return {
            status: t.status,
            start,
            end: start + DAY,
            durations: { operational: DAY - t.minutes * MIN, [t.status]: t.minutes * MIN },
            events: [{ at: start + t.at * MIN, text: t.text, status: t.status }],
          }
        }),
      }),
    template: `<div class="w-96 flex flex-col gap-6">
  <label class="flex items-center gap-2 text-sm text-muted"><LpSwitch v-model="loading" /> Loading</label>
  <LpUptimeBar
    :segments="loading ? [] : days"
    :loading="loading"
    :skeleton-slices="60"
    title="api.leavepulse.io"
    start-label="60 days ago"
    end-label="Today"
  />
  <!-- custom per-status colours -->
  <LpUptimeBar
    :segments="days"
    title="custom colours"
    :colors="{ operational: '#22c55e', degraded: '#eab308', down: '#ef4444', maintenance: '#6366f1' }"
    start-label="60 days ago"
    end-label="Today"
  />
</div>`,
    thumb: `<div class="w-72">
  <LpUptimeBar :segments="[...days.slice(tShift), ...days.slice(0, tShift)]" title="api.leavepulse.io" start-label="60 days ago" end-label="Today" />
</div>`,
    thumbLoop: { every: 1600, frames: [{ tShift: 0 }, { tShift: 1 }, { tShift: 2 }, { tShift: 3 }] },
  },
  {
    id: "chart",
    name: "Chart",
    description:
      "Line, area and bar off one data shape. Hover snaps a crosshair to the nearest point and reads every series at once; the legend toggles series. `thresholds` draws reference lines or bands (`to`), `markers` pins events to an x position. The plot is keyboard reachable (arrows, Home, End, Enter), reads out a generated summary, and `data-table` adds a visually hidden table of the values. `loading` keeps the plot's height and pulses a stand-in of the chart's type in the plot area (bars, or a line; tick stubs on the axes), then swaps to the marks; an empty chart shows LpEmptyState.",
    components: { LpChart, LpButton, LpSwitch },
    state: () =>
      reactive({
        loading: false,
        hours: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`),
        traffic: [
          {
            name: "Requests",
            data: [120, 138, 131, 160, 210, 260, 340, 420, 480, 520, 505, 540,
                   610, 590, 560, 520, 480, 505, 470, 400, 330, 260, 190, 150],
          },
          {
            name: "Errors",
            axis: "right",
            color: "var(--color-danger)",
            data: [2, 1, 3, 2, 4, 3, 6, 8, 5, 12, 9, 7,
                   22, 18, 9, 6, 5, 4, 6, 3, 2, 2, 1, 1],
          },
        ],
        latency: [
          {
            name: "p95",
            data: [42, 45, 39, 51, 48, 62, 58, 71, 66, 59, 54, 47],
          },
          { name: "Budget", data: Array(12).fill(60), dashed: true, color: "var(--color-danger)" },
        ],
        months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        spend: [
          { name: "Compute", data: [320, 340, 310, 380, 420, 460] },
          { name: "Storage", data: [90, 95, 120, 118, 140, 160] },
          { name: "Egress", data: [40, 62, 55, 80, 74, 96] },
        ],
        quarters: ["W1", "W2", "W3", "W4", "W5", "W6"],
        gapped: [
          { name: "Sensor", data: [12, 15, null, null, 22, 19, 24, 30, null, 27, 31, 28] },
        ],
        netFlow: [
          { name: "Net change", data: [18, -7, 24, -12, 9, 31, -4, 15] },
        ],
        weeks: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"],
        slo: [
          { value: 60, label: "SLO 60 ms", color: "var(--color-danger)" },
          { value: 40, to: 50, label: "Target band", color: "var(--color-action)" },
        ],
        releases: [
          { at: "Mar", label: "v2.1" },
          { at: "Aug", label: "Incident", color: "var(--color-danger)" },
        ],
        picked: "right-click a point →",
        pointMenu: (point: { label: string; values: (number | null)[] }) => [
          { label: `Inspect ${point.label}`, icon: "lucide:search" },
          { label: "Compare with last week", icon: "lucide:git-compare" },
          {
            label: "Copy value",
            icon: "lucide:copy",
            shortcut: "⌘C",
            separatorBefore: true,
          },
        ],
      }),
    template: `<div class="flex w-full max-w-3xl flex-col gap-10">
  <label class="flex items-center gap-2 text-sm text-muted"><LpSwitch v-model="loading" /> Loading</label>
  <LpChart
    type="area"
    :loading="loading"
    :series="traffic"
    :labels="hours"
    title="Edge traffic"
    subtitle="Errors sit on their own axis — a shared one would flatten them"
    right-unit=" err"
    :height="220"
    :menu-items="pointMenu"
    ref="edge"
    @point-click="picked = 'clicked ' + $event.label"
  >
    <template #actions>
      <div class="flex gap-1">
        <LpButton size="xs" variant="ghost" @click="$refs.edge.exportCsv()">CSV</LpButton>
        <LpButton size="xs" variant="ghost" @click="$refs.edge.exportPng()">PNG</LpButton>
      </div>
    </template>
  </LpChart>
  <span class="-mt-6 text-xs text-muted">{{ picked }} · right-click the plot for a point menu</span>

  <LpChart
    type="line"
    :loading="loading"
    :series="latency"
    :labels="months"
    title="Response time"
    unit=" ms"
    show-points
    :height="200"
  />

  <LpChart
    type="bar"
    :loading="loading"
    :series="spend"
    :labels="quarters"
    stacked
    title="Infrastructure spend"
    unit=" €"
    :height="200"
  />

  <LpChart
    type="bar"
    :series="netFlow"
    :labels="weeks"
    title="Net flow"
    subtitle="Bars below the baseline round downward"
    unit=" GB"
    :height="180"
  />

  <!-- Reference lines and bands sit over the data; markers pin events to an x
       label. Tab into the plot and use the arrow keys: the live readout is what
       a screen reader hears. data-table adds a visually hidden table. -->
  <LpChart
    type="line"
    :series="[latency[0]]"
    :labels="months"
    :thresholds="slo"
    :markers="releases"
    title="Thresholds and markers"
    subtitle="Tab into the plot, then use the arrow keys, Home and End"
    unit=" ms"
    show-points
    data-table
    :height="200"
  />

  <LpChart
    type="line"
    :series="gapped"
    :labels="months"
    title="Gaps stay gaps"
    subtitle="null breaks the line instead of drawing through it"
    show-points
    :height="180"
  />
</div>`,
    thumb: `<div class="w-72">
  <LpChart type="area" :series="[{ ...traffic[0], data: [...traffic[0].data.slice(tShift), ...traffic[0].data.slice(0, tShift)] }]" :labels="hours" :height="140" :show-legend="false" :y-ticks="3" />
</div>`,
    thumbLoop: { every: 2200, frames: [{ tShift: 0 }, { tShift: 4 }, { tShift: 8 }] },
  },
  {
    id: "log-viewer",
    name: "Log Viewer",
    description:
      "Terminal-flavoured log stream: tonal level rail, timestamps, source chips, search highlighting, and a sticky tail that glides to the bottom as lines arrive (jump-to-latest pill when you scroll up). New rows fade in. The filter button (shown only while searching) collapses the view to matching lines. `compact` folds consecutive identical lines into one, badged ×N. Right-click a line for copy actions (message / line / timestamp), \"filter by\" source·level (emits @filter), and your own extraRowItems.",
    components: { LpLogViewer, LpInput, LpButton, LpSwitch, LpIcon },
    state: () => {
      const samples: { level: string; source: string; message: string }[] = [
        { level: "info", source: "api", message: "GET /v1/servers 200 in 14ms" },
        { level: "debug", source: "auth", message: "token verified for user 4821 (scope: read)" },
        { level: "success", source: "deploy", message: "ger-01-p rolled out — 3/3 replicas healthy" },
        { level: "warn", source: "db", message: "connection pool at 82% — consider raising max" },
        { level: "error", source: "api", message: "POST /v1/billing 502 upstream timeout after 30s" },
        { level: "info", source: "nats", message: "subscribed metrics.host.* (queue=ingest)" },
        { level: "trace", source: "cache", message: "miss key=profile:4821 ttl=300" },
        { level: "fatal", source: "core", message: "panic: nil pointer in scheduler.tick() — restarting" },
      ]
      const s = reactive({
        wrap: false,
        compact: false,
        query: "",
        onlyMatches: false,
        n: 0,
        lines: Array.from({ length: 18 }, (_, i) => {
          const base = Date.now() - (18 - i) * 1400
          const x = samples[i % samples.length]
          return { ...x, time: base }
        }) as { level: string; source: string; message: string; time: number }[],
        push() {
          const x = samples[s.n++ % samples.length]
          s.lines.push({ ...x, time: Date.now() })
        },
        // Repeat the last line — with compact on, watch the ×N badge climb.
        repeat() {
          const last = s.lines[s.lines.length - 1]
          if (last) s.lines.push({ ...last, time: Date.now() })
        },
        // Right-click → "Filter by …" emits this; here we just drive the search.
        onFilter(by: { source?: string; level?: string }) {
          s.query = by.source ?? by.level ?? ""
          s.onlyMatches = true
        },
        // Consumer-supplied extra row actions, appended below the built-ins.
        extraItems: (line: { source?: string }) => [
          { label: "Open trace", icon: "lucide:scan-search", onSelect: () => alert("trace for " + (line.source ?? "?")) },
        ],
      })
      return s
    },
    template: `<div class="flex w-[36rem] max-w-full flex-col gap-3">
  <div class="flex flex-wrap items-center gap-3">
    <LpInput v-model="query" icon="lucide:search" placeholder="Highlight…" class="min-w-48 flex-1" />
    <Transition
      enter-active-class="transition duration-150 ease-[var(--ease-emphasized)]"
      enter-from-class="-translate-x-1 scale-95 opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="-translate-x-1 scale-95 opacity-0"
    >
      <label v-if="query.trim()" class="flex shrink-0 items-center gap-2 text-xs text-muted">
        <LpSwitch v-model="onlyMatches" />
        <LpIcon name="lucide:filter" :size="14" /> Only matches
      </label>
    </Transition>
    <label class="flex items-center gap-2 text-xs text-muted">
      <LpSwitch v-model="wrap" /> Wrap
    </label>
    <label class="flex items-center gap-2 text-xs text-muted">
      <LpSwitch v-model="compact" /> Compact
    </label>
    <LpButton size="sm" variant="soft" @click="push">Push line</LpButton>
    <LpButton size="sm" variant="ghost" @click="repeat">Repeat last</LpButton>
  </div>
  <LpLogViewer
    :lines="lines"
    :highlight="query"
    :filter-matches="onlyMatches"
    :wrap="wrap"
    :compact="compact"
    :extra-row-items="extraItems"
    height="18rem"
    @filter="onFilter"
  />
  <p class="text-xs text-muted">Right-click a line → copy / filter by source·level / Open trace.</p>
  <p class="text-xs text-muted">With <code>toolbar</code> and <code>max-lines="12"</code>: search (Enter / Shift+Enter / F3), level chips, newest 12 lines.</p>
  <LpLogViewer :lines="lines" toolbar persist="preview-logs" :max-lines="12" line-numbers height="14rem" />
</div>`,
    thumb: `<div class="w-72">
  <LpLogViewer :lines="lines.slice(tStart, tStart + 6)" height="8.5rem" :row-menu="false" />
</div>`,
    thumbLoop: { every: 1500, frames: [{ tStart: 0 }, { tStart: 1 }, { tStart: 2 }, { tStart: 3 }] },
  },
  {
    id: "table",
    name: "Table",
    description:
      "Data-driven table: typed columns (align/width/sortable), row key, empty state, per-column scoped cell slots (`#cell-<key>`), client/server sorting via v-model:sort, row selection via v-model:selected (press a row's tick and drag down the column to tick a run; Ctrl+A ticks all, Escape clears), a per-row right-click menu via `rowMenu` (return `{ title, subtitle, icon, items }` to head it with the row's name), `loading` for rows a parent fetches (skeleton rows in the shape of the columns while empty, dimmed while refreshing), stickyHeader, and a server-backed mode via `load` (paging, sort and header filters done by the server, debounced and abortable). A column's `sortValue` maps a row to what it sorts by, and `compare` takes over the ordering entirely. A `filterable` column gets a funnel in its header: a searchable list of its values with counts, `Only` on each value, All / None / Invert, and after a search the matches as a whole; filters in force show as chips above the table with the row count. `selectable=\"hold\"` hides the tick column until a long press on a row selects it (keep holding and drag to select more), after which clicks toggle rows and Escape clears; the `#bulk` slot holds actions for the selection. `density`, `summary` and `persist` (sort, filters and hidden columns remembered across visits) round it off. The header filters can be owned by the page (`v-model:filters`, the hidden values per column), so a control above the table that filters the same column is one state with its funnel: `useTableFilterChoice` turns a column into a choice for LpSegmented or tiles, a column's `filterValues` keeps every value on offer when the rows are already narrowed upstream, `filterCounts: false` drops counts that would mislead then, and `filtered` with `@reset-filters` lets the empty table's reset clear the page's own search too. A column's `hideBelow` leaves it out while the table is narrower than that (Status below 520px here).",
    components: { LpTable, LpBadge, LpButton, LpIcon, LpInput, LpSegmented, LpSwitch },
    state: () => {
      const issueFilters = ref<TableFilters>({})
      const s = reactive({
        loading: false,
        sort: { key: "amount", dir: "desc" },
        selected: ["ORD-1041"],
        columns: [
          { key: "id", label: "Order", width: "30%", sortable: true, nowrap: true },
          { key: "amount", label: "Amount", align: "right", sortable: true },
          { key: "status", label: "Status", align: "center", hideBelow: 520 },
          { key: "actions", label: "", align: "right", width: "48px" },
        ],
        rows: [
          { id: "ORD-1042", amount: 12, status: "paid" },
          { id: "ORD-1041", amount: 12, status: "pending" },
          { id: "ORD-1040", amount: 24, status: "failed" },
          { id: "ORD-1039", amount: 8, status: "paid" },
        ],
        // A longer set so the sticky-header table actually scrolls.
        manyRows: Array.from({ length: 40 }, (_, i) => ({
          id: `ORD-${1100 + i}`,
          amount: ((i * 37) % 90) + 5,
          status: (["paid", "pending", "failed"] as const)[i % 3],
        })),
        asyncColumns: [
          { key: "id", label: "Order", width: "30%", sortable: true, nowrap: true },
          { key: "amount", label: "Amount", align: "right", sortable: true },
          { key: "status", label: "Status", align: "center", filterable: true },
        ],
        // A stand-in server: filters, sorts and pages 40 orders after a delay.
        async loadOrders(query: { page: number; pageSize: number; sort: { key: string; dir: string } | null; hidden: Record<string, unknown[]> }, signal: AbortSignal) {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 350)
            signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("aborted", "AbortError")) })
          })
          const all = s.manyRows as { id: string; amount: number; status: string }[]
          let rows = all.filter((r) => !(query.hidden.status ?? []).includes(r.status))
          if (query.sort) {
            const { key, dir } = query.sort
            rows = [...rows].sort((a, b) => (a[key as "amount"] > b[key as "amount"] ? 1 : -1) * (dir === "asc" ? 1 : -1))
          }
          const start = (query.page - 1) * query.pageSize
          return {
            rows: rows.slice(start, start + query.pageSize),
            total: rows.length,
            facets: { status: [...new Set(all.map((r) => r.status))] },
          }
        },
        // Many values per column, for the filter popover and hold-to-select.
        issueColumns: [
          { key: "title", label: "Issue", width: "40%", sortable: true },
          { key: "status", label: "Status", filterable: true },
          { key: "owner", label: "Owner", filterable: true, sortable: true },
          { key: "points", label: "Points", align: "right", sortable: true },
        ],
        issues: Array.from({ length: 60 }, (_, i) => ({
          id: i + 1,
          title: ["Login loops", "Slow search", "Broken export", "Typo in footer", "Flaky test", "Memory leak"][i % 6] + " #" + (i + 1),
          status: ["Open", "Triaged", "In progress", "In review", "Blocked", "QA", "Ready", "Released", "Reopened", "Won't fix", "Duplicate", "Closed"][(i * 7) % 12],
          owner: ["Ada", "Grace", "Linus", "Margaret", "Ken", "Barbara"][(i * 5) % 6],
          points: [1, 2, 3, 5, 8, 13][(i * 3) % 6],
        })),
        issueSelection: [] as number[],
        issueFilters,
        issueStage: useTableFilterChoice(issueFilters, "status", {
          all: null,
          active: ["Open", "Triaged", "In progress", "In review", "Blocked", "QA", "Ready", "Reopened"],
          done: ["Released", "Won't fix", "Duplicate", "Closed"],
        }),
        issueSearch: "",
        closeSelected() {
          for (const issue of s.issues) if (s.issueSelection.includes(issue.id)) issue.status = "Closed"
          s.issueSelection = []
        },
        serverSelection: [] as string[],
        allMatching: false,
        // Custom ordering: priority by rank, not alphabet; version by its numbers.
        ticketColumns: [
          { key: "title", label: "Ticket", width: "40%" },
          {
            key: "priority",
            label: "Priority",
            sortable: true,
            sortValue: (row: { priority: string }) => ["low", "medium", "high", "urgent"].indexOf(row.priority),
          },
          {
            key: "version",
            label: "Fixed in",
            align: "right",
            sortable: true,
            compare: (a: { version: string }, b: { version: string }) =>
              a.version.localeCompare(b.version, undefined, { numeric: true }),
          },
        ],
        tickets: [
          { title: "Login loops", priority: "urgent", version: "2.10.0" },
          { title: "Typo in footer", priority: "low", version: "2.9.1" },
          { title: "Slow search", priority: "high", version: "2.10.2" },
          { title: "Dark mode glitch", priority: "medium", version: "2.2.0" },
        ],
        ticketSort: { key: "priority", dir: "desc" },
        // Per-row menu: the right-clicked row's items, headed by its id.
        rowMenu(row: { id: string; status: string; amount: number }) {
          return {
            title: row.id,
            subtitle: `€${row.amount.toFixed(2)} · ${row.status}`,
            icon: "lucide:receipt",
            items: [
            { label: "Copy ID", icon: "lucide:copy", onSelect: () => navigator.clipboard?.writeText(row.id) },
            {
              label: "Mark as paid",
              icon: "lucide:check-circle",
              disabled: row.status === "paid",
              onSelect: () => { row.status = "paid" },
              separatorBefore: true,
            },
            {
              label: "Delete",
              icon: "lucide:trash-2",
              danger: true,
              onSelect: () => { s.rows = s.rows.filter((r) => r.id !== row.id) },
            },
            ],
          }
        },
      })
      return s
    },
    template: `<div class="flex flex-col gap-2">
  <label class="flex items-center gap-2 text-sm text-muted"><LpSwitch v-model="loading" /> Loading (empty table)</label>
  <LpTable
    :columns="columns"
    :rows="loading ? [] : rows"
    :loading="loading"
    row-key="id"
    selectable
    exportable
    export-filename="orders"
    :row-menu="rowMenu"
    v-model:selected="selected"
    v-model:sort="sort"
  >
    <template #cell-amount="{ value }">€{{ value.toFixed(2) }}</template>
    <template #cell-status="{ value }">
      <LpBadge :tone="value === 'paid' ? 'success' : value === 'pending' ? 'neutral' : 'danger'">
        {{ value }}
      </LpBadge>
    </template>
    <template #cell-actions="{ openMenu }">
      <LpButton variant="ghost" size="sm" square aria-label="Actions" @click.stop="openMenu">
        <LpIcon name="lucide:more-vertical" />
      </LpButton>
    </template>
  </LpTable>
  <p class="text-xs text-muted">Sorted by {{ sort?.key ?? '—' }} {{ sort?.dir ?? '' }} · {{ selected.length }} selected · right-click a row, or open its menu from the button</p>

  <!-- Fixed height + stickyHeader: scrolls via LpScrollArea, header pins to top. -->
  <p class="mt-2 text-xs font-medium text-muted">Many values — open the funnel on Status or Owner; the Stage switch above and the Status funnel are one filter (v-model:filters with useTableFilterChoice). To select: hover a row and click the box at its left edge, or press and hold a row, then keep holding and drag over others; once rows are selected a click adds or removes one, Escape clears:</p>
  <div class="flex flex-wrap items-center gap-2">
    <LpInput v-model="issueSearch" size="sm" icon="lucide:search" placeholder="Search issues" aria-label="Search issues" class="w-56" />
    <LpSegmented v-model="issueStage" size="sm" :options="[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'done', label: 'Done' }]" aria-label="Stage" />
  </div>
  <LpTable
    :columns="issueColumns"
    :rows="issueSearch ? issues.filter((i) => i.title.toLowerCase().includes(issueSearch.toLowerCase())) : issues"
    v-model:filters="issueFilters"
    :filtered="!!issueSearch"
    @reset-filters="issueSearch = ''"
    row-key="id"
    selectable="hold"
    sticky-header
    density="compact"
    summary
    persist="preview-issues"
    v-model:selected="issueSelection"
    class="h-80"
  >
    <template #bulk>
      <LpButton size="sm" variant="outline" @click="closeSelected">Close selected</LpButton>
    </template>
  </LpTable>

  <p class="mt-2 text-xs font-medium text-muted">sortValue and compare — Priority sorts by rank, Fixed in by version number:</p>
  <LpTable :columns="ticketColumns" :rows="tickets" row-key="title" v-model:sort="ticketSort" />

  <p class="mt-2 text-xs font-medium text-muted">stickyHeader — scroll the table, the header stays:</p>
  <LpTable
    :columns="columns"
    :rows="manyRows"
    row-key="id"
    sticky-header
    class="h-64"
  >
    <template #cell-amount="{ value }">€{{ value.toFixed(2) }}</template>
    <template #cell-status="{ value }">
      <LpBadge :tone="value === 'paid' ? 'success' : value === 'pending' ? 'neutral' : 'danger'">
        {{ value }}
      </LpBadge>
    </template>
  </LpTable>

  <p class="mt-2 text-xs font-medium text-muted">load — the server pages, sorts and filters; tick the header box, then "Select all" goes past the page:</p>
  <LpTable
    :columns="asyncColumns"
    :load="loadOrders"
    :page-size="8"
    row-key="id"
    selectable
    v-model:selected="serverSelection"
    v-model:all-matching="allMatching"
  >
    <template #cell-amount="{ value }">€{{ value.toFixed(2) }}</template>
    <template #cell-status="{ value }">
      <LpBadge :tone="value === 'paid' ? 'success' : value === 'pending' ? 'neutral' : 'danger'">
        {{ value }}
      </LpBadge>
    </template>
  </LpTable>
</div>`,
    thumb: `<div class="w-72">
  <LpTable
    :columns="[{ key: 'id', label: 'Order', nowrap: true }, { key: 'amount', label: 'Amount', align: 'right' }, { key: 'status', label: 'Status', align: 'center' }]"
    :rows="tRows"
    row-key="id"
    density="compact"
  >
    <template #cell-amount="{ value }">€{{ value.toFixed(2) }}</template>
    <template #cell-status="{ value }">
      <LpBadge :tone="value === 'paid' ? 'success' : value === 'pending' ? 'neutral' : 'danger'">{{ value }}</LpBadge>
    </template>
  </LpTable>
</div>`,
    thumbLoop: {
      every: 2000,
      frames: [
        { tRows: [{ id: "ORD-1042", amount: 12, status: "paid" }, { id: "ORD-1041", amount: 12, status: "pending" }, { id: "ORD-1040", amount: 24, status: "failed" }] },
        { tRows: [{ id: "ORD-1042", amount: 12, status: "paid" }, { id: "ORD-1041", amount: 12, status: "paid" }, { id: "ORD-1040", amount: 24, status: "failed" }] },
        { tRows: [{ id: "ORD-1043", amount: 31, status: "pending" }, { id: "ORD-1042", amount: 12, status: "paid" }, { id: "ORD-1041", amount: 12, status: "paid" }] },
      ],
    },
  },
  {
    id: "pagination",
    name: "Pagination",
    description:
      "Windowed page navigator (prev/next + ellipses). v-model:page (1-based); size it via total+pageSize or pageCount. Pairs with Table. Below it: every built-in string in the kit comes from a label scope, so `provideLpConfig({ labels })` at the app root translates them all at once; a component's own `labels` prop still wins.",
    components: { LpPagination, LpTable, LpConfirmDialog, LpButton, LpSwitch, ConfigScope },
    state: () =>
      reactive({
        page: 4,
        german: true,
        ask: false,
        germanLabels: {
          table: { empty: "Noch nichts hier" },
          confirm: { confirm: "Best\u00e4tigen", cancel: "Abbrechen" },
          pagination: { previous: "Zur\u00fcck", next: "Weiter", nav: "Seiten" },
        },
        columns: [{ key: "name", label: "Name" }],
      }),
    template: `<div class="flex w-full max-w-md flex-col items-center gap-3">
  <LpPagination v-model:page="page" :total="240" :page-size="10" />
  <p class="text-xs text-muted">Page {{ page }} of 24</p>

  <div class="mt-4 flex w-full flex-col gap-3 border-t border-line pt-4">
    <LpSwitch v-model="german" label="German labels via provideLpConfig" />
    <ConfigScope :labels="german ? germanLabels : undefined">
      <div class="flex flex-col gap-3">
        <LpTable :columns="columns" :rows="[]" />
        <LpButton class="self-start" variant="outline" @click="ask = true">Open a confirm dialog</LpButton>
        <LpConfirmDialog v-model:open="ask" title="Publish the page?" />
      </div>
    </ConfigScope>
  </div>
</div>`,
    thumb: `<div class="flex flex-col items-center gap-2">
  <LpPagination :page="tPage" :total="240" :page-size="10" :siblings="0" />
  <p class="text-xs text-muted">Page {{ tPage }} of 24</p>
</div>`,
    thumbLoop: { every: 1400, frames: [{ tPage: 4 }, { tPage: 5 }, { tPage: 6 }, { tPage: 7 }, { tPage: 6 }, { tPage: 5 }] }
  },
  {
    id: "file-tree",
    name: "FileTree",
    description:
      "File/folder tree: directories-first ordering, type-derived icons, size/modified columns, per-row context menus (headed by the entry's name and icon) and lazy children (a dir with no `children` emits `expand` once). `checkable` turns it into a picker — tri-state folders, cascading ticks, and a rolled-up summary of what's selected. Arrows navigate, →/← expand, Space ticks.",
    components: { LpFileTree, LpSwitch },
    state: () => {
      const s = reactive({
        nodes: [
          {
            id: "/instance",
            name: ".minecraft",
            kind: "dir",
            children: [
              {
                id: "/instance/saves",
                name: "saves",
                kind: "dir",
                modified: Date.now() - 3600_000,
                children: [
                  { id: "/instance/saves/world", name: "world", kind: "dir", size: 412_000_000, modified: Date.now() - 3600_000, children: [] },
                  { id: "/instance/saves/flat", name: "flat", kind: "dir", size: 18_400_000, modified: Date.now() - 86_400_000 * 9, children: [] },
                ],
              },
              {
                id: "/instance/config",
                name: "config",
                kind: "dir",
                children: [
                  { id: "/instance/config/options.txt", name: "options.txt", kind: "file", size: 3_100, modified: Date.now() - 7200_000 },
                  { id: "/instance/config/servers.dat", name: "servers.dat", kind: "file", size: 812, modified: Date.now() - 86_400_000 },
                ],
              },
              // No `children` key → lazy: expanding emits `expand`.
              { id: "/instance/mods", name: "mods", kind: "dir", size: 96_800_000 },
              // Deliberately huge: expanding a real instance's resourcepacks dir
              // is the worst case the tree has to stay smooth on.
              {
                id: "/instance/resourcepacks",
                name: "resourcepacks",
                kind: "dir",
                children: Array.from({ length: 222 }, (_, i) => ({
                  id: `/instance/resourcepacks/pack-${i}.zip`,
                  name: `pack-${String(i).padStart(3, "0")}.zip`,
                  kind: "file" as const,
                  size: 40_000 + i * 5_137,
                  modified: Date.now() - 86_400_000 * (i % 30),
                })),
              },
              { id: "/instance/logs", name: "logs", kind: "dir", children: [] },
              { id: "/instance/options.txt", name: "options.txt", kind: "file", size: 2_400, modified: Date.now() - 1800_000 },
              { id: "/instance/launcher.lock", name: "launcher.lock", kind: "file", size: 0, disabled: true, meta: "in use" },
            ],
          },
        ] as FileNode[],
        expanded: ["/instance"] as string[],
        checked: ["/instance/config"] as string[],
        loadingIds: [] as string[],
        selected: "",
        checkable: true,
        stats: "",
        onExpand(node: FileNode) {
          if (node.id !== "/instance/mods") return
          // Pretend to fetch the directory listing.
          s.loadingIds = [node.id]
          setTimeout(() => {
            const find = (list: FileNode[]): FileNode | undefined => {
              for (const n of list) {
                if (n.id === node.id) return n
                const hit = n.children && find(n.children)
                if (hit) return hit
              }
            }
            const dir = find(s.nodes)
            if (dir) {
              dir.children = [
                { id: "/instance/mods/sodium.jar", name: "sodium.jar", kind: "file", size: 4_200_000, modified: Date.now() - 86_400_000 * 3 },
                { id: "/instance/mods/lithium.jar", name: "lithium.jar", kind: "file", size: 1_100_000, modified: Date.now() - 86_400_000 * 3 },
                { id: "/instance/mods/iris.jar", name: "iris.jar", kind: "file", size: 8_600_000, modified: Date.now() - 86_400_000 * 12 },
              ]
              decorate(dir.children)
            }
            s.loadingIds = []
          }, 900)
        },
      })
      const decorate = (list: FileNode[]) => {
        for (const n of list) {
          n.menu = [
            { label: "Copy path", icon: "lucide:clipboard" },
            { label: "Reveal in files", icon: "lucide:external-link" },
            { label: "Exclude from backup", icon: "lucide:x", danger: true },
          ]
          if (n.children) decorate(n.children)
        }
      }
      decorate(s.nodes)
      return s
    },
    template: `<div class="flex w-[26rem] flex-col gap-2">
  <label class="flex items-center gap-2 text-xs text-muted">
    <LpSwitch v-model="checkable" /> checkable (backup picker)
  </label>

  <div class="h-80 rounded-card border border-line bg-surface-raised p-2">
    <LpFileTree
      persist="preview-files"
      :nodes="nodes"
      :loading-ids="loadingIds"
      :checkable="checkable"
      show-size
      show-modified
      v-model:selected="selected"
      v-model:expanded="expanded"
      v-model:checked="checked"
      @expand="onExpand"
      @summary="(s) => (stats = s.files + ' files / ' + s.dirs + ' folders / ' + s.sizeLabel)"
    />
  </div>
  <p class="text-xs text-muted">
    "mods" loads lazily · tick a folder to take its whole subtree · right-click a row
  </p>
  <p class="text-xs text-muted">summary event → {{ stats || '—' }}</p>
</div>`,
    thumb: `<div class="w-64 rounded-card border border-line bg-surface-raised p-1.5">
  <LpFileTree
    :nodes="[
      { id: 'saves', name: 'saves', kind: 'dir', children: [] },
      { id: 'config', name: 'config', kind: 'dir', children: [
        { id: 'config/options.txt', name: 'options.txt', kind: 'file', size: 3100 },
        { id: 'config/servers.dat', name: 'servers.dat', kind: 'file', size: 812 },
      ] },
      { id: 'launcher.lock', name: 'launcher.lock', kind: 'file', size: 0 },
    ]"
    :expanded="tOpen"
    :checked="['config']"
    checkable
    show-size
  />
</div>`,
    thumbLoop: { every: 1800, frames: [{ tOpen: ["config"] }, { tOpen: [] }] },
  },
  {
    id: "media-gallery",
    name: "MediaGallery",
    description:
      "Thumbnail grid that opens into the Lightbox. `columns` takes a number or a per-breakpoint object; `max` caps the grid and badges the last tile with the remainder, which opens at the first hidden image. An item marked `spoiler` arrives covered: one click uncovers it, a second opens it, and while covered it stays out of the lightbox so paging cannot land on it. Items are LightboxItem, so a set passes straight through. `itemMenu(item, index)` gives a thumbnail a right-click menu headed by its title and picture (a covered spoiler shows neither); the first grid has one. Texts come from `labels` (\"mediaGallery\" scope).",
    components: { LpMediaGallery },
    state: () => {
      const plate = (label: string, from: string, to: string, w = 1200, h = 800) =>
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
 font-family="Inter,system-ui,sans-serif" font-size="${Math.round(h / 6)}" font-weight="700"
 fill="rgba(255,255,255,.92)">${label}</text></svg>`,
        )

      return reactive({
        shots: [
          { src: plate("1", "#5865F2", "#8b5cf6"), title: "spawn.png", description: "1200 × 800" },
          { src: plate("2", "#eb459e", "#f0b35a"), title: "nether.png", description: "1200 × 800" },
          { src: plate("3", "#39e58c", "#00bcff"), title: "base.png", description: "1200 × 800" },
          { src: plate("4", "#f0b35a", "#eb459e"), title: "end.png", description: "1200 × 800" },
          { src: plate("5", "#00bcff", "#5865F2"), title: "farm.png", description: "1200 × 800" },
          { src: plate("6", "#8b5cf6", "#39e58c"), title: "portal.png", description: "1200 × 800" },
          { src: plate("7", "#ff6b6b", "#feca57"), title: "mesa.png", description: "1200 × 800" },
        ] as LightboxItem[],
        mixed: [
          { src: plate("1", "#5865F2", "#8b5cf6"), title: "spawn.png" },
          { src: plate("2", "#eb459e", "#f0b35a"), title: "ending.png", spoiler: true },
          { src: plate("3", "#39e58c", "#00bcff"), title: "base.png" },
          { src: plate("4", "#f0b35a", "#eb459e"), title: "boss.png", spoiler: true },
        ] as LightboxItem[],
      })
    },
    template: `<div class="flex flex-col gap-6">
  <div>
    <p class="mb-2 text-xs text-muted">columns=3 — click any tile</p>
    <div class="w-[420px] max-w-full">
      <LpMediaGallery
        :items="shots"
        :columns="3"
        :item-menu="() => [
          { label: 'Download', icon: 'lucide:download', shortcut: 'Ctrl+S' },
          { label: 'Copy link', icon: 'lucide:link' },
          { label: 'Delete', icon: 'lucide:trash-2', danger: true, separatorBefore: true },
        ]"
      />
    </div>
  </div>

  <div>
    <p class="mb-2 text-xs text-muted">max=4 — the last tile counts the rest and opens at image 5</p>
    <div class="w-[420px] max-w-full">
      <LpMediaGallery :items="shots" :columns="4" :max="4" />
    </div>
  </div>

  <div>
    <p class="mb-2 text-xs text-muted">
      spoiler — a covered tile takes one click to uncover and a second to open; a
      covered image is kept out of the lightbox entirely, so paging cannot walk into one
    </p>
    <div class="w-[420px] max-w-full">
      <LpMediaGallery :items="mixed" :columns="4" />
    </div>
  </div>

  <div>
    <p class="mb-2 text-xs text-muted">aspect="video", gap=1, responsive columns</p>
    <div class="w-[420px] max-w-full">
      <LpMediaGallery :items="shots.slice(0, 4)" :columns="{ base: 1, sm: 2 }" aspect="video" :gap="1" />
    </div>
  </div>
</div>`,
    thumb: `<div class="w-64">
  <LpMediaGallery :items="shots" :columns="4" :max="4" :openable="false" />
</div>`,
  },
  {
    id: "lightbox",
    name: "Lightbox",
    description:
      "Full-screen image viewer: arrows or swipe to page, wheel zooms toward the cursor over the picture and pages through the set off it, drag pans, double-click toggles fit/2x, pinch on touch, rotate, download, copy. Esc or a backdrop click closes; a filmstrip tracks the set. Keyboard: ←/→, Home/End, +/−, 0, R.",
    components: { LpLightbox, LpButton, LpIcon },
    state: () => {
      // Inline SVGs so the demo needs no network (and works in a Tauri shell).
      const plate = (label: string, from: string, to: string, w = 1200, h = 800) =>
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<g fill="none" stroke="rgba(255,255,255,.22)" stroke-width="2">
${Array.from({ length: 12 }, (_, i) => `<circle cx="${w / 2}" cy="${h / 2}" r="${40 + i * 46}"/>`).join("")}
</g>
<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
 font-family="Inter,system-ui,sans-serif" font-size="${Math.round(h / 9)}" font-weight="700"
 fill="rgba(255,255,255,.92)">${label}</text>
<text x="50%" y="${h - 40}" text-anchor="middle" font-family="Inter,system-ui,sans-serif"
 font-size="26" fill="rgba(255,255,255,.6)">${w} × ${h}</text></svg>`,
        )

      return reactive({
        open: false,
        index: 0,
        shots: [
          { src: plate("Spawn", "#0ea5e9", "#1e3a8a"), title: "2026-07-28_09.14.22.png", description: "1200 × 800 · 412 KB" },
          { src: plate("Nether", "#f97316", "#7f1d1d", 1600, 900), title: "2026-07-27_23.01.10.png", description: "1600 × 900 · 780 KB" },
          { src: plate("Base", "#22c55e", "#14532d", 900, 1200), title: "2026-07-26_18.44.03.png", description: "900 × 1200 · 640 KB — portrait" },
          { src: plate("End", "#a855f7", "#312e81"), title: "2026-07-25_07.30.55.png", description: "1200 × 800 · 505 KB" },
        ] as LightboxItem[],
      })
    },
    template: `<div class="flex flex-col gap-3">
  <div class="flex flex-wrap gap-2">
    <button
      v-for="(shot, i) in shots"
      :key="i"
      type="button"
      class="size-24 overflow-hidden rounded-card outline-none ring-1 ring-line transition-[scale,box-shadow] hover:scale-[1.03] hover:ring-brand focus-visible:ring-2 focus-visible:ring-ring"
      @click="index = i; open = true"
    >
      <img :src="shot.src" :alt="shot.title" class="size-full object-cover" />
    </button>
  </div>
  <p class="text-xs text-muted">
    Click a thumbnail · wheel = zoom to cursor · drag = pan (or swipe to page at fit) ·
    double-click = fit/2x · ←/→ Home/End +/− 0 R
  </p>

  <LpLightbox
    v-model:open="open"
    v-model:index="index"
    :items="shots"
    copyable
  />
</div>`,
    thumb: `<div class="relative flex h-36 w-72 flex-col items-center justify-center gap-2 overflow-hidden rounded-card bg-black/90 p-2">
  <div class="absolute right-2 top-2 flex gap-1 text-white/70">
    <LpIcon name="lucide:zoom-in" :size="14" />
    <LpIcon name="lucide:rotate-cw" :size="14" />
    <LpIcon name="lucide:download" :size="14" />
    <LpIcon name="lucide:x" :size="14" />
  </div>
  <div class="flex items-center gap-3">
    <LpIcon name="lucide:chevron-left" :size="18" class="text-white/70" />
    <img :src="shots[tShot].src" alt="" class="h-20 rounded-inner object-cover" />
    <LpIcon name="lucide:chevron-right" :size="18" class="text-white/70" />
  </div>
  <div class="flex gap-1">
    <img v-for="(s, i) in shots" :key="i" :src="s.src" alt="" class="h-5 w-7 rounded-[3px] object-cover transition-opacity duration-300" :class="i === tShot ? 'ring-2 ring-white' : 'opacity-50'" />
  </div>
</div>`,
    thumbLoop: { every: 1800, frames: [{ tShot: 0 }, { tShot: 1 }, { tShot: 2 }] },
  },
]
