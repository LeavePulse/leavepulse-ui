import { reactive } from "vue"
import {
  LpBadge,
  LpButton,
  LpCountdown,
  LpLoader,
  LpPipeline,
  LpSegmented,
  LpStepMark,
  LpSwitch,
  overallStatus,
  type PipelineStep,
  type StepStatus,
} from "../../../src"
import type { ComponentEntry } from "./shared"

// Processes: components built from ideas seen in other kits, written from scratch.
// Each array lands in the section it is named after (see registry.ts).

/* A deploy, as a CI run reports it: the app only ever sends statuses and times. */
const deploySteps = (): PipelineStep[] => [
  { key: "checkout", label: "Checkout", status: "pending", description: "git fetch origin main" },
  {
    key: "build",
    label: "Build image",
    status: "pending",
    description: "docker build -t panel:4.2.0",
    steps: [
      { key: "deps", label: "Install dependencies", status: "pending" },
      { key: "compile", label: "Compile", status: "pending" },
      { key: "bundle", label: "Bundle assets", status: "pending" },
    ],
  },
  { key: "test", label: "Tests", status: "pending", description: "412 specs" },
  { key: "lint", label: "Lint docs", status: "pending", description: "Only on docs changes" },
  { key: "deploy", label: "Deploy", status: "pending", description: "nevery-1, nevery-2" },
]

/* Statuses as a thumb frame: the same run, one step further each time. */
const thumbRun = (statuses: StepStatus[]): PipelineStep[] =>
  ["Checkout", "Build", "Test", "Deploy"].map((label, i) => ({
    label,
    status: statuses[i],
    duration: statuses[i] === "success" ? [4200, 72000, 38000, 15000][i] : undefined,
  }))

export const processBasics: ComponentEntry[] = [
  {
    id: "loader",
    name: "Loader",
    description:
      "The kit's loading indicator: spinner, dots or an indeterminate bar, in four sizes (`inline` follows the font) and the kit tones. It waits `delay` ms before appearing, so a fast load shows nothing, and stays `minVisible` ms once shown, so it never blinks. role=\"status\" with a polite label; under reduced motion it breathes instead of moving. With a default slot it is a placeholder that swaps to the content when `active` goes off.",
    components: { LpLoader, LpButton, LpSwitch, LpSegmented },
    state: () =>
      reactive({
        loading: false,
        slow: true,
        tone: "brand",
        tones: [
          { value: "current", label: "current" },
          { value: "brand", label: "brand" },
          { value: "action", label: "action" },
          { value: "muted", label: "muted" },
        ],
        timer: 0 as ReturnType<typeof setTimeout> | 0,
        reload(this: { loading: boolean; slow: boolean; timer: ReturnType<typeof setTimeout> | 0 }) {
          clearTimeout(this.timer)
          this.loading = true
          // A fast load (80 ms) never shows the loader at all; a slow one does.
          this.timer = setTimeout(() => { this.loading = false }, this.slow ? 1600 : 80)
        },
      }),
    template: `<div class="flex w-full max-w-xl flex-col gap-6">
  <div class="flex flex-wrap items-center gap-6">
    <LpLoader size="sm" :tone="tone" />
    <LpLoader :tone="tone" track />
    <LpLoader size="lg" :tone="tone" />
    <LpLoader variant="dots" :tone="tone" />
    <LpLoader variant="dots" size="lg" :tone="tone" label="Connecting" />
    <span class="text-lg text-ink">Syncing <LpLoader size="inline" :delay="0" /></span>
  </div>
  <LpLoader variant="bar" :tone="tone" label="Fetching servers" />
  <LpSegmented v-model="tone" :options="tones" size="sm" />

  <div class="flex flex-col gap-3 rounded-card border border-line p-4">
    <div class="flex items-center gap-3">
      <LpButton size="sm" variant="soft" @click="reload()">Reload</LpButton>
      <label class="flex items-center gap-2 text-sm text-muted"><LpSwitch v-model="slow" /> Slow response</label>
    </div>
    <LpLoader :active="loading" variant="dots" tone="brand" label="Loading servers">
      <ul class="flex flex-col gap-1 text-sm text-ink">
        <li>nevery-1 · 12 containers</li>
        <li>nevery-2 · 9 containers</li>
      </ul>
    </LpLoader>
  </div>
</div>`,
    thumb: `<div class="flex w-64 flex-col items-center gap-6">
  <div class="flex items-center gap-6">
    <LpLoader :delay="0" tone="brand" size="lg" track />
    <LpLoader :delay="0" variant="dots" tone="action" size="lg" />
  </div>
  <LpLoader :delay="0" variant="bar" tone="brand" label="Fetching servers" />
</div>`,
  },
]

export const processForms: ComponentEntry[] = []

export const processData: ComponentEntry[] = [
  {
    id: "pipeline",
    name: "Pipeline",
    description:
      "A run of jobs and the state each is in: pending, running, success, failed, skipped, cancelled. Durations come from `duration` or from `startedAt`/`finishedAt` (a running step's clock ticks on its own, paused while the tab is hidden). The line fills behind passed steps and breaks where the run stopped; a running step sends a light along it. Vertical (default) folds sub-steps and a `detail` slot under a step and opens failed or running ones by itself; horizontal is a strip, compact turns it into marks with tooltips. `follow` keeps the current step in view. Not LpStepper: that is a wizard with one current step, this is a monitor where every step has its own state. LpStepMark is the glyph on its own.",
    components: { LpPipeline, LpButton, LpSwitch, LpSegmented, LpBadge, LpStepMark },
    state: () => {
      const s = reactive({
        steps: deploySteps(),
        orientation: "vertical",
        orientations: [
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ],
        compact: false,
        failNext: false,
        expanded: [] as string[],
        get overall(): StepStatus {
          return overallStatus(s.steps)
        },
        // One click moves the run on by one job, as a CI webhook would.
        advance(): void {
          const at = s.steps.findIndex((st) => st.status === "running")
          const now = Date.now()
          if (at !== -1) {
            const step = s.steps[at]
            const child = step.steps?.findIndex((c) => c.status === "running") ?? -1
            if (step.steps && child !== -1) {
              step.steps[child].status = "success"
              step.steps[child].duration = 800 + Math.round(Math.random() * 20000)
              const next = step.steps[child + 1]
              if (next) { next.status = "running"; next.startedAt = now; return }
            }
            step.status = s.failNext ? "failed" : "success"
            step.finishedAt = now
            if (s.failNext) {
              s.steps.slice(at + 1).forEach((st) => { st.status = "cancelled" })
              return
            }
          }
          const next = s.steps.findIndex((st) => st.status === "pending")
          if (next === -1) return
          // Docs did not change, so the docs job is skipped rather than run.
          if (s.steps[next].key === "lint") {
            s.steps[next].status = "skipped"
            return s.advance()
          }
          s.steps[next].status = "running"
          s.steps[next].startedAt = now
          const first = s.steps[next].steps?.[0]
          if (first) { first.status = "running"; first.startedAt = now }
        },
        reset() {
          s.steps = deploySteps()
          s.expanded = []
        },
      })
      return s
    },
    template: `<div class="flex w-full max-w-2xl flex-col gap-5">
  <div class="flex flex-wrap items-center gap-3">
    <LpButton size="sm" @click="advance()">Advance</LpButton>
    <LpButton size="sm" variant="soft" @click="reset()">Reset</LpButton>
    <label class="flex items-center gap-2 text-sm text-muted"><LpSwitch v-model="failNext" /> Fail the next job</label>
    <label class="flex items-center gap-2 text-sm text-muted"><LpSwitch v-model="compact" /> Compact</label>
    <LpSegmented v-model="orientation" :options="orientations" size="sm" />
  </div>
  <div class="flex items-center gap-2 text-sm text-muted">
    Run #4182
    <LpBadge size="sm" :tone="overall === 'failed' ? 'danger' : overall === 'success' ? 'success' : overall === 'running' ? 'brand' : 'neutral'">{{ overall }}</LpBadge>
  </div>
  <div class="max-h-96 overflow-y-auto rounded-card border border-line p-4">
    <LpPipeline
      v-model:expanded="expanded"
      :steps="steps"
      :orientation="orientation"
      :compact="compact"
      follow
    >
      <template #detail="{ step }">
        <pre v-if="step.status === 'failed'" class="overflow-x-auto rounded-control bg-danger-soft px-3 py-2 font-mono text-xs text-danger">error: process exited with code 1</pre>
        <span v-else class="text-xs text-muted">Logs for {{ step.label }} stream here.</span>
      </template>
    </LpPipeline>
  </div>

  <div class="flex flex-wrap items-center gap-3 text-xs text-muted">
    <span class="inline-flex items-center gap-1.5"><LpStepMark status="pending" :number="1" /> pending</span>
    <span class="inline-flex items-center gap-1.5"><LpStepMark status="running" /> running</span>
    <span class="inline-flex items-center gap-1.5"><LpStepMark status="success" /> success</span>
    <span class="inline-flex items-center gap-1.5"><LpStepMark status="failed" /> failed</span>
    <span class="inline-flex items-center gap-1.5"><LpStepMark status="skipped" /> skipped</span>
    <span class="inline-flex items-center gap-1.5"><LpStepMark status="cancelled" /> cancelled</span>
  </div>
</div>`,
    thumb: `<div class="flex w-72 flex-col gap-3">
  <LpPipeline :steps="tRun" orientation="horizontal" compact />
  <LpPipeline :steps="tRun" compact />
</div>`,
    thumbLoop: {
      every: 1400,
      frames: [
        { tRun: thumbRun(["success", "running", "pending", "pending"]) },
        { tRun: thumbRun(["success", "success", "running", "pending"]) },
        { tRun: thumbRun(["success", "success", "success", "running"]) },
        { tRun: thumbRun(["success", "success", "success", "success"]) },
        { tRun: thumbRun(["success", "success", "failed", "cancelled"]) },
        { tRun: thumbRun(["running", "pending", "pending", "pending"]) },
      ],
    },
  },
  {
    id: "countdown",
    name: "Countdown",
    description:
      "Time left until a moment (`to`) or for a wait (`seconds`): a clock under an hour, the two largest units above (\"2d 3h\"), rounded up so 0:00 means now. Each digit rolls on its own. The time is always deadline minus now, ticks land on the second, and a hidden tab stops ticking and is right again on return: no drift. A ring or bar shows what is left, `urgent-at` turns it danger, `paused` freezes it, `done` fires once and a `done` slot replaces the digits. role=\"timer\", with polite announcements only at round marks. Pure helpers (`splitTime`, `formatTime`, `timeParts`) are exported.",
    components: { LpCountdown, LpButton, LpSwitch },
    state: () =>
      reactive({
        paused: false,
        doneCount: 0,
        maintenance: Date.now() + 2 * 86_400_000 + 3 * 3_600_000 + 12 * 60_000,
        launch: Date.now() + 14 * 60_000 + 30_000,
        launchFrom: Date.now() - 5 * 60_000,
      }),
    template: `<div class="flex w-full max-w-xl flex-col gap-6">
  <p class="text-sm text-muted">
    We sent a code to your email. Resend in
    <LpCountdown ref="resend" :seconds="15" class="text-ink" @done="doneCount++">
      <template #done><button class="text-brand underline" @click="$refs.resend.restart()">Resend now</button></template>
    </LpCountdown>
  </p>

  <div class="flex flex-wrap items-center gap-8">
    <LpCountdown :seconds="45" progress="ring" :ring-size="72" :urgent-at="10" :paused="paused" class="text-base" />
    <div class="flex flex-col gap-1">
      <span class="text-xs text-muted">Maintenance in</span>
      <LpCountdown :to="maintenance" class="text-2xl text-ink" />
    </div>
    <div class="flex w-48 flex-col gap-1">
      <span class="text-xs text-muted">Lobby closes in</span>
      <LpCountdown :to="launch" :from="launchFrom" progress="bar" class="text-lg text-ink" />
    </div>
  </div>

  <label class="flex items-center gap-2 text-sm text-muted"><LpSwitch v-model="paused" /> Pause the ring</label>
  <span class="text-xs text-muted">done fired {{ doneCount }} time(s)</span>
</div>`,
    thumb: `<div class="flex w-64 items-center justify-center gap-6">
  <LpCountdown :seconds="tSec" progress="ring" :ring-size="72" :urgent-at="5" class="text-base" />
  <div class="flex flex-col gap-1">
    <span class="text-xs text-muted">Maintenance in</span>
    <LpCountdown :seconds="tLong" class="text-xl text-ink" />
  </div>
</div>`,
    thumbLoop: { every: 20000, frames: [{ tSec: 20, tLong: 183_720 }, { tSec: 21, tLong: 183_721 }] },
  },
]

export const processOverlays: ComponentEntry[] = []
export const processMotion: ComponentEntry[] = []
