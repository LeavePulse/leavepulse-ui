import { reactive } from "vue"
import {
  LpButton, LpCard, LpCodeDisplay, LpContextMenu, LpDataList, LpDropdownMenu,
  LpFormField, LpGauge, LpLoader, LpNumberField, LpPasswordInput, LpProgress,
  LpQuota, LpRangeSlider, LpRelativeTime, LpSecretField, LpSkeleton, LpSlider,
  LpStatus, LpSwitch, type MenuItem,
} from "../../../src"
import type { ComponentEntry } from "./shared"

export const patterns: ComponentEntry[] = [
  {
    id: "numbers-together",
    name: "Numbers and ranges",
    description: "A number field and a slider can edit the same value: type an exact amount or drag to explore. A range slider selects two bounds instead. Clearing the number field keeps its empty state; the slider keeps a numeric fallback.",
    related: [
      { id: "numberfield", description: "An exact number, units, bounds and keyboard stepping. A blank field is null." },
      { id: "slider", description: "One bounded value, adjusted continuously by pointer or keyboard." },
      { id: "range-slider", description: "Two endpoints of an interval, with an optional minimum gap." },
      { id: "formfield", description: "The shared label, description and validation around either control." },
    ],
    components: { LpFormField, LpNumberField, LpSlider, LpRangeSlider },
    state: () => reactive({ capacity: 64 as number | null, range: [20, 80] as [number, number] }),
    template: `<div class="flex w-full max-w-md flex-col gap-6">
  <LpFormField label="Capacity" description="Type an exact percentage or use the slider below.">
    <LpNumberField v-model="capacity" :min="0" :max="100" unit="%" />
  </LpFormField>
  <LpSlider :model-value="capacity ?? 0" @update:model-value="capacity = $event" :min="0" :max="100" aria-label="Capacity slider" />
  <LpFormField label="Alert window" :description="range[0] + '% to ' + range[1] + '%'">
    <LpRangeSlider v-model="range" :min="0" :max="100" :aria-labels="['Lower bound', 'Upper bound']" />
  </LpFormField>
</div>`,
    thumb: `<div class="flex w-64 flex-col gap-4"><LpNumberField :model-value="64" unit="%" aria-label="Capacity" /><LpSlider :model-value="64" aria-label="Capacity slider" /></div>`,
  },
  {
    id: "secrets-together",
    name: "Passwords, secrets and codes",
    description: "These controls hide text for different tasks. Enter a password, copy an existing API secret, or transcribe a short pairing code. The values below are demonstration data.",
    related: [
      { id: "password", description: "Password entry with a reveal button and password-manager autocomplete." },
      { id: "secret-field", description: "An existing secret with copy and reveal actions; input mode also edits it." },
      { id: "code-display", description: "A code to read or transcribe, grouped for legibility; supports expiry and acknowledgement." },
      { id: "otp", description: "Enter a received verification code rather than display an issued one." },
    ],
    components: { LpFormField, LpPasswordInput, LpSecretField, LpCodeDisplay },
    state: () => reactive({ password: "" }),
    template: `<div class="flex w-full max-w-md flex-col gap-6">
  <LpFormField label="Account password"><LpPasswordInput v-model="password" autocomplete="current-password" /></LpFormField>
  <LpSecretField label="API token" value="lp_demo_not_a_real_token_123456" :auto-hide="10" />
  <div class="flex flex-col gap-2"><p class="text-sm text-muted">Pairing code — enter this on another device</p><LpCodeDisplay code="482913" /></div>
</div>`,
    thumb: `<div class="flex w-64 flex-col gap-3"><LpSecretField value="lp_demo_token" /><LpCodeDisplay code="482913" /></div>`,
  },
  {
    id: "meters-together",
    name: "Progress, readings and quotas",
    description: "Similar shapes can carry different meanings. Progress answers how far a task has advanced; a gauge shows a current reading; a quota compares consumption with a limit, including overruns. The sliders change upload progress and storage consumption independently.",
    related: [
      { id: "progress", description: "A fraction toward completion, drawn as a bar or a ring. Choose a fixed tone for task progress." },
      { id: "gauge", description: "A current reading within a scale, with thresholds in the reading's own units." },
      { id: "quota", description: "Used capacity versus a limit, with units, remaining capacity and over-limit states." },
      { id: "stat", description: "A standalone figure and its trend when no bounded scale is needed." },
    ],
    components: { LpProgress, LpGauge, LpQuota, LpSlider },
    state: () => reactive({ completed: 64, usage: 72 }),
    template: `<div class="flex w-full max-w-lg flex-col gap-6">
  <LpProgress :value="completed" title="Upload progress" tone="brand" label />
  <LpSlider v-model="completed" :min="0" :max="100" aria-label="Upload progress" />
  <div class="flex flex-wrap items-center gap-6">
    <LpGauge :value="72" label="CPU" unit="%" />
    <LpQuota :used="usage" :limit="100" label="Storage" unit="GB" class="min-w-0 flex-1 basis-48" />
  </div>
  <LpSlider v-model="usage" :min="0" :max="120" aria-label="Storage usage" />
</div>`,
    thumb: `<div class="flex w-64 items-center gap-4"><LpGauge :value="72" label="CPU" unit="%" :size="96" /><LpQuota :used="72" :limit="100" label="Storage" unit="GB" class="min-w-0 flex-1" /></div>`,
  },
  {
    id: "menus-together",
    name: "One set of menu actions",
    description: "The row's button and right-click menu share one items array, including submenus. Change an action once and both entry points agree. A popover is for arbitrary content rather than a list of commands.",
    related: [
      { id: "dropdown", description: "An explicit button opens a list of commands; clicking the button again closes it." },
      { id: "contextmenu", description: "The same commands on right-click, scoped to the item under the pointer." },
      { id: "popover", description: "A small floating panel containing custom content or fields." },
      { id: "tooltip", description: "A short explanation on hover or focus, without interactive actions." },
    ],
    components: { LpContextMenu, LpDropdownMenu, LpButton },
    state: () => {
      const state = reactive({ selected: "No action yet", items: [] as MenuItem[] })
      state.items = [
        { label: "Open", icon: "lucide:external-link", onSelect: () => { state.selected = "Opened api-gateway" } },
        { label: "Move to", icon: "lucide:folder-input", children: [
          { label: "Production", onSelect: () => { state.selected = "Moved to Production" } },
          { label: "Staging", onSelect: () => { state.selected = "Moved to Staging" } },
        ] },
      ]
      return state
    },
    template: `<div class="flex w-full max-w-md flex-col gap-3">
  <LpContextMenu :items="items" title="api-gateway">
    <div class="flex items-center justify-between gap-4 rounded-card border border-line p-4">
      <span class="text-sm">api-gateway <span class="text-muted">· right-click this row</span></span>
      <LpDropdownMenu :items="items" title="api-gateway" right-click-too>
        <template #trigger><LpButton size="sm" variant="ghost" aria-label="Service actions">•••</LpButton></template>
      </LpDropdownMenu>
    </div>
  </LpContextMenu>
  <output class="text-sm text-muted" aria-live="polite">{{ selected }}</output>
</div>`,
    thumbState: false,
    thumb: `<div class="flex w-64 items-center justify-between rounded-card border border-line p-3 text-sm"><span>api-gateway</span><LpButton size="sm" variant="ghost">•••</LpButton></div>`,
  },
  {
    id: "service-together",
    name: "A service summary",
    description: "Compose a service card from its existing pieces. DataList owns labels and values, its slots hold status and relative time, and Quota describes storage. The address uses DataList's built-in copy action.",
    related: [
      { id: "card", description: "The surface around a group of related information." },
      { id: "data-list", description: "Label/value layout, responsive stacking, empty values and copy actions." },
      { id: "status", description: "A named service state with consistent wording and tone." },
      { id: "relative-time", description: "A timestamp that stays current as the card remains open." },
      { id: "quota", description: "Storage consumption and the remaining allowance." },
      { id: "copy-button", description: "A reusable copy action; DataList already supplies it for copyable values." },
    ],
    components: { LpCard, LpDataList, LpStatus, LpRelativeTime, LpQuota, LpSwitch },
    state: () => reactive({ online: true, deployed: Date.now() - 5 * 60_000 }),
    template: `<div class="flex w-full max-w-md flex-col gap-4">
  <LpSwitch v-model="online" label="Service online" />
  <LpCard class="flex flex-col gap-4">
    <h2 class="text-base font-semibold">api-gateway</h2>
    <LpDataList divided :items="[
      { key: 'state', label: 'Status' },
      { label: 'Address', value: 'api.leavepulse.net:443', mono: true, copyable: true },
      { key: 'deploy', label: 'Deployed' },
    ]">
      <template #value-state><LpStatus :state="online ? 'online' : 'offline'" /></template>
      <template #value-deploy><LpRelativeTime :date="deployed" /></template>
    </LpDataList>
    <LpQuota :used="72" :limit="100" label="Storage" unit="GB" />
  </LpCard>
</div>`,
    thumb: `<LpCard class="w-64 space-y-3"><div class="flex justify-between text-sm"><span>api-gateway</span><LpStatus state="online" /></div><LpQuota :used="72" :limit="100" label="Storage" unit="GB" /></LpCard>`,
  },
  {
    id: "loading-together",
    name: "Loading without layout jumps",
    description: "Reserve the shape of known content with Skeleton, use Loader when the duration is unknown, and show Progress only when a real fraction is available. Button's loading state handles its own spinner and keeps the label's width.",
    related: [
      { id: "skeleton", description: "A placeholder matching the shape and dimensions of the coming content." },
      { id: "loader", description: "An indeterminate wait, with an announcement and a delay to avoid flashing." },
      { id: "progress", description: "Measured progress with a known total." },
      { id: "button", description: "Use loading on the initiating action to preserve its width and block repeat submissions." },
    ],
    components: { LpSkeleton, LpLoader, LpProgress, LpButton, LpSwitch, LpCard },
    state: () => reactive({ loading: true }),
    template: `<div class="flex w-full max-w-md flex-col gap-5">
  <LpSwitch v-model="loading" label="Loading" />
  <LpCard class="flex h-28 flex-col justify-center gap-3" :aria-busy="loading">
    <LpSkeleton v-if="loading" class="space-y-3"><div class="lp-skeleton-item h-5 w-32 rounded-control" /><div class="lp-skeleton-item h-4 w-full rounded-control" /></LpSkeleton>
    <div v-else class="space-y-3"><h2 class="h-5 text-sm font-semibold">api-gateway</h2><p class="h-4 text-xs text-muted">Production · Frankfurt</p></div>
  </LpCard>
  <div class="flex h-10 items-center justify-between gap-4"><LpLoader :active="loading" :delay="0" label="Fetching service" /><LpButton :loading="loading">Refresh service</LpButton></div>
  <LpProgress :value="64" title="Downloading a known 100 MB file" tone="brand" label />
</div>`,
    thumb: `<LpCard class="w-64 space-y-3"><LpSkeleton class="h-4 w-28" /><LpSkeleton class="h-3 w-full" /><LpProgress :value="64" tone="brand" /></LpCard>`,
  },
]
