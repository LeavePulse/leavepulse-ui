import { reactive, type Component } from "vue"
import {
  LpAddressInput,
  LpAlert,
  LpAutocomplete,
  LpMapPicker,
  LpAvatar,
  LpBadge,
  LpBreadcrumbs,
  LpButton,
  LpCard,
  LpCheckbox,
  LpConfirmDialog,
  LpDisclosure,
  LpDivider,
  LpDrawer,
  LpCalendar,
  LpCodeBlock,
  LpCommandPalette,
  LpContextMenu,
  LpDatePicker,
  LpDropdownMenu,
  LpEmptyState,
  LpFileTree,
  type FileNode,
  LpFormField,
  LpIcon,
  LpInput,
  LpLightbox,
  type LightboxItem,
  LpLink,
  LpLogViewer,
  LpModal,
  LpNotificationBell,
  LpNumberField,
  LpOtpInput,
  LpPagination,
  LpPasswordInput,
  LpPhoneInput,
  LpPopover,
  LpProgress,
  LpRadio,
  LpRadioGroup,
  LpScrollArea,
  LpSelect,
  LpSkeleton,
  LpSlider,
  LpStat,
  LpStepper,
  LpSwitch,
  LpTable,
  LpTableOfContents,
  LpSegmented,
  LpSidebar,
  LpTabs,
  LpTextarea,
  LpThemeSwitcher,
  LpTilt,
  LpTooltip,
  LpUptimeBar,
  useToast,
} from "../../src"

export interface ComponentEntry {
  id: string
  name: string
  description: string
  /** Editable Vue template for the live example. */
  template: string
  /** Components in scope for the template. */
  components: Record<string, Component>
  /** Reactive state the template can bind to. */
  state?: () => Record<string, unknown>
}

const selectOpts = [
  { value: "eu", label: "Europe" },
  { value: "na", label: "North America" },
  { value: "asia", label: "Asia" },
]
const radioOpts = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
]
const tabItems = [
  { value: "a", label: "Overview", icon: "lucide:layout-dashboard" },
  { value: "b", label: "Settings", icon: "lucide:settings" },
]

export const registry: ComponentEntry[] = [
  {
    id: "button",
    name: "Button",
    description:
      "Variants, sizes (xs–lg), block, square (icon-only), glow, and `as` (render as a link).",
    components: { LpButton },
    template: `<div class="flex flex-col gap-3">
  <div class="flex flex-wrap items-center gap-2">
    <LpButton variant="solid">Solid</LpButton>
    <LpButton variant="action">Action</LpButton>
    <LpButton variant="outline">Outline</LpButton>
    <LpButton variant="soft">Soft</LpButton>
    <LpButton variant="ghost">Ghost</LpButton>
    <LpButton variant="muted">Muted</LpButton>
    <LpButton variant="light">Light</LpButton>
    <LpButton variant="danger">Danger</LpButton>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <LpButton glow variant="solid">Glow</LpButton>
    <LpButton glow variant="danger">Glow danger</LpButton>
    <LpButton glow variant="light">Glow light</LpButton>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <LpButton size="xs">xs</LpButton>
    <LpButton size="sm">sm</LpButton>
    <LpButton size="md">md</LpButton>
    <LpButton size="lg">lg</LpButton>
    <LpButton square variant="outline">+</LpButton>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <LpButton as="a" href="#" variant="outline">As link (a)</LpButton>
  </div>
</div>`,
  },
  {
    id: "input",
    name: "Input",
    description:
      "Text field with sizes and invalid state. Optional `label`/`hint`/`error` wrap it in a form field; `icon` (or the `leading`/`trailing` slots) adorn it. `pattern`/`restrict` validate or hard-block input; exposes `focus()`/`select()`/`blur()` for imperative focus (e.g. Enter → next field).",
    components: { LpInput, LpIcon },
    state: () => reactive({
      value: "",
      email: "",
      digits: "",
      // pattern = validate (won't block typing); restrict = block bad chars.
      emailPattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
      digitsOnly: /[0-9]/,
    }),
    template: `<div class="flex w-72 flex-col gap-3">
  <LpInput v-model="value" label="Email" icon="lucide:mail" placeholder="you@example.com" />
  <LpInput v-model="value" label="Password" hint="At least 8 characters." placeholder="••••••••" />
  <LpInput v-model="value" label="Username" error="Already taken" placeholder="taken" />
  <LpInput
    v-model="email"
    label="Email (pattern)"
    :pattern="emailPattern"
    hint="Turns red until it's a valid email — typing is never blocked."
    placeholder="you@example.com"
  />
  <LpInput
    v-model="digits"
    label="PIN (restrict)"
    :restrict="digitsOnly"
    inputmode="numeric"
    hint="Only digits can be typed or pasted."
    placeholder="0000"
  />
  <LpInput v-model="value" placeholder="Search…">
    <template #leading><LpIcon name="lucide:search" :size="15" /></template>
  </LpInput>
</div>`,
  },
  {
    id: "autocomplete",
    name: "Autocomplete",
    description:
      "Free-text field that suggests as you type but never forces a choice — the typed text is the model. Unlike Select, you can submit a value that isn't in the list. Supports client filtering, server-side suggestions, and the same pattern/restrict as Input.",
    components: { LpAutocomplete },
    state: () => reactive({
      value: "",
      frameworks: ["Vue", "React", "Svelte", "Solid", "Angular", "Qwik", "Preact"],
    }),
    template: `<div class="w-72">
  <LpAutocomplete
    v-model="value"
    :options="frameworks"
    icon="lucide:search"
    clearable
    placeholder="Type a framework…"
  />
  <p class="mt-2 text-xs text-muted">Value: {{ value || "—" }} (free text, not limited to the list)</p>
</div>`,
  },
  {
    id: "select",
    name: "Select",
    description: "Searchable / multiple select on reka-ui. Option values may be string OR number. Server-side search via v-model:searchTerm + :loading.",
    components: { LpSelect },
    state: () => reactive({
      value: undefined,
      options: selectOpts,
      pageSize: 30,
      sizes: [
        { value: 20, label: "20" },
        { value: 30, label: "30" },
        { value: 50, label: "50" },
      ],
      remoteValue: undefined,
      remoteTerm: "",
      remoteOptions: selectOpts,
    }),
    template: `<div class="flex w-72 flex-col gap-3">
  <LpSelect v-model="value" :options="options" searchable clearable placeholder="Pick a region" />
  <LpSelect v-model="pageSize" :options="sizes" />
  <p class="text-xs text-muted">numeric value: {{ pageSize }} ({{ typeof pageSize }})</p>
  <LpSelect
    v-model="remoteValue"
    v-model:search-term="remoteTerm"
    :options="remoteOptions"
    placeholder="Server-side search"
    search-placeholder="Type to query…"
  />
  <p class="text-xs text-muted">searchTerm: "{{ remoteTerm }}"</p>
</div>`,
  },
  {
    id: "switch",
    name: "Switch · Checkbox · Radio",
    description:
      "Boolean and choice controls. LpRadioGroup takes `:options` for plain rows, or LpRadio children when a row needs custom content.",
    components: { LpSwitch, LpCheckbox, LpRadioGroup, LpRadio },
    state: () => reactive({ on: true, checked: true, plan: "pro", tier: "pro", radioOpts }),
    template: `<div class="flex flex-col gap-6">
  <div class="flex items-start gap-8">
    <LpSwitch v-model="on" />
    <LpCheckbox v-model="checked" label="Remember me" />
    <LpRadioGroup v-model="plan" :options="radioOpts" />
  </div>

  <!-- LpRadio children: custom row content instead of the options shorthand. -->
  <LpRadioGroup v-model="tier">
    <div class="flex flex-col gap-2">
      <LpRadio value="free" label="Free" />
      <LpRadio value="pro">
        <span class="font-medium text-ink">Pro</span>
        <span class="text-muted"> — €9/mo, custom row markup</span>
      </LpRadio>
      <LpRadio value="ent" label="Enterprise" disabled />
    </div>
  </LpRadioGroup>
</div>`,
  },
  {
    id: "badge",
    name: "Badge",
    description: "Status pills in tonal variants.",
    components: { LpBadge },
    template: `<div class="flex flex-wrap gap-2">
  <LpBadge tone="neutral" dot>Neutral</LpBadge>
  <LpBadge tone="brand" dot>Online</LpBadge>
  <LpBadge tone="action">Active</LpBadge>
  <LpBadge tone="success" dot>Success</LpBadge>
  <LpBadge tone="outline">Outline</LpBadge>
  <LpBadge tone="danger" dot>Error</LpBadge>
</div>`,
  },
  {
    id: "card",
    name: "Card",
    description: "Surface container in raised / flat / ghost. Pass `menuItems` for a right-click menu.",
    components: { LpCard },
    state: () =>
      reactive({
        cardMenu: [
          { label: "Rename", icon: "lucide:pencil" },
          { label: "Duplicate", icon: "lucide:copy" },
          { label: "Delete", icon: "lucide:trash-2", danger: true, separatorBefore: true },
        ],
      }),
    template: `<div class="grid w-full grid-cols-3 gap-3">
  <LpCard>Raised</LpCard>
  <LpCard variant="flat">Flat</LpCard>
  <LpCard variant="flat" interactive :menu-items="cardMenu">Right-click me</LpCard>
</div>`,
  },
  {
    id: "tabs",
    name: "Tabs",
    description: "Sliding indicator + animated panels. variant=\"plain\" drops the bar chrome for nav rows.",
    components: { LpTabs },
    state: () => reactive({ tab: "a", items: tabItems }),
    template: `<div class="flex flex-col gap-3">
  <LpTabs v-model="tab" :items="items" />
  <LpTabs v-model="tab" :items="items" block />
  <LpTabs v-model="tab" :items="items" variant="plain" />
  <LpTabs v-model="tab" :items="items" variant="plain" accent />
</div>`,
  },
  {
    id: "sidebar",
    name: "Sidebar",
    description:
      "App-shell side navigation: icon + label items, labelled sections, badge counts, a sliding brand pill for the active item, a loading skeleton, and header/footer/actions slots (logo, user chip, logout). v-model binds the active id; pass isActive for router prefix-matching. Items can carry a `menu` for a right-click context menu. Set `responsive` + v-model:open to swap the rail for a swipe-to-close drawer on phones (the burger button below opens it). Mirrors the cabinet/profile sidebars in the apps.",
    components: { LpSidebar, LpAvatar, LpBadge, LpButton, LpIcon, LpSwitch },
    state: () =>
      reactive({
        active: "overview",
        loading: false,
        open: false,
        sections: [
          {
            items: [
              { id: "overview", label: "Overview", icon: "lucide:layout-dashboard" },
              {
                id: "servers",
                label: "Servers",
                icon: "lucide:server",
                badge: 12,
                menu: [
                  { label: "Open in new tab", icon: "lucide:external-link" },
                  { label: "Pin", icon: "lucide:pin" },
                ],
              },
              { id: "metrics", label: "Metrics", icon: "lucide:activity" },
            ],
          },
          {
            title: "Workspace",
            items: [
              { id: "logs", label: "Logs", icon: "lucide:scroll-text", badge: "3" },
              { id: "billing", label: "Billing", icon: "lucide:credit-card" },
              { id: "settings", label: "Settings", icon: "lucide:settings" },
            ],
          },
        ],
      }),
    template: `<div class="flex flex-col gap-3">
  <div class="flex items-center gap-4">
    <label class="flex items-center gap-2 text-xs text-muted">
      <LpSwitch v-model="loading" /> Loading
    </label>
    <LpButton variant="soft" size="sm" @click="open = true">
      <LpIcon name="lucide:menu" :size="16" /> Open drawer (mobile)
    </LpButton>
  </div>
  <div class="h-[28rem] w-64 overflow-hidden rounded-card border border-line">
    <LpSidebar
      v-model="active"
      v-model:open="open"
      responsive
      mobile-breakpoint="sm"
      :sections="sections"
      :loading="loading"
    >
      <template #header>
        <div class="flex items-center gap-2 px-1 py-1 font-semibold text-ink">
          <span class="grid size-8 place-items-center rounded-lg bg-brand text-ink-inverse">
            <LpIcon name="lucide:server" :size="18" />
          </span>
          LeavePulse
        </div>
      </template>
      <template #actions>
        <LpButton variant="soft" size="sm" class="w-full justify-start">
          <LpIcon name="lucide:plus" :size="16" /> New server
        </LpButton>
      </template>
      <template #footer>
        <div class="flex items-center gap-3 px-1">
          <LpAvatar size="sm" fallback="SA" />
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-ink">System Admin</p>
            <p class="truncate text-xs text-muted">admin@leavepulse.io</p>
          </div>
        </div>
        <LpButton variant="ghost" size="sm" class="mt-1 w-full justify-start">
          <LpIcon name="lucide:log-out" :size="16" /> Sign out
        </LpButton>
      </template>
    </LpSidebar>
  </div>
</div>`,
  },
  {
    id: "segmented",
    name: "Segmented",
    description:
      "Compact mutually-exclusive control with a sliding pill (reka ToggleGroup). For short option sets where Tabs is too heavy — view/density toggles. icon and/or label per option; block stretches it full-width.",
    components: { LpSegmented },
    state: () =>
      reactive({
        view: "list",
        density: "default",
        viewOpts: [
          { value: "list", icon: "lucide:list", label: "List" },
          { value: "grid", icon: "lucide:layout-grid", label: "Grid" },
          { value: "board", icon: "lucide:columns-3", label: "Board" },
        ],
        densityOpts: [
          { value: "compact", label: "Compact" },
          { value: "default", label: "Default" },
          { value: "comfortable", label: "Comfortable" },
        ],
      }),
    template: `<div class="flex flex-col items-start gap-3">
  <LpSegmented v-model="view" :options="viewOpts" />
  <LpSegmented v-model="density" :options="densityOpts" size="sm" />
  <LpSegmented v-model="view" :options="viewOpts" block class="w-80" />
</div>`,
  },
  {
    id: "textarea",
    name: "Textarea",
    description: "Multi-line input. Optional `label`/`hint`/`error` wrap it in a form field.",
    components: { LpTextarea },
    state: () => reactive({ value: "" }),
    template: `<div class="w-80">
  <LpTextarea v-model="value" label="Billing address" hint="Street, building, apt." placeholder="Multi-line…" />
</div>`,
  },
  {
    id: "stat",
    name: "Stat",
    description:
      "Metric tile: label, mono value, hint, and an optional delta/trend badge. Numeric delta auto-derives direction & sign; invertTrend flips colours for \"lower is better\" metrics (latency, errors).",
    components: { LpStat },
    template: `<div class="grid w-full grid-cols-2 gap-6">
  <LpStat online label="Servers online" value="43" hint="Responding now." />
  <LpStat label="Revenue" value="€8,420" :delta="12.4" delta-suffix="%" hint="vs last week" />
  <LpStat label="Avg latency" value="48 ms" :delta="-6" invert-trend hint="lower is better" />
  <LpStat label="Signups" value="312" delta="+18%" />
</div>`,
  },
  {
    id: "avatar",
    name: "Avatar",
    description: "User image with initials fallback, three sizes. Pass `menuItems` for a right-click account menu.",
    components: { LpAvatar },
    state: () =>
      reactive({
        accountMenu: [
          { label: "View profile", icon: "lucide:user" },
          { label: "Account settings", icon: "lucide:settings" },
          { label: "Sign out", icon: "lucide:log-out", danger: true, separatorBefore: true },
        ],
      }),
    template: `<div class="flex items-center gap-3">
  <LpAvatar size="sm" fallback="SA" />
  <LpAvatar size="md" fallback="LP" />
  <LpAvatar size="lg" alt="System Admin" :menu-items="accountMenu" />
  <span class="text-sm text-muted">right-click the last one →</span>
</div>`,
  },
  {
    id: "progress",
    name: "Progress",
    description: "Determinate bar in tonal variants.",
    components: { LpProgress },
    template: `<div class="flex w-80 flex-col gap-3">
  <LpProgress :value="35" />
  <LpProgress :value="70" tone="action" />
  <LpProgress :value="90" tone="danger" />
</div>`,
  },
  {
    id: "uptime-bar",
    name: "Uptime Bar",
    description: "Status-page uptime scale: per-slice tooltips and a computed %.",
    components: { LpUptimeBar },
    state: () =>
      reactive({
        days: Array.from({ length: 60 }, (_, i) => {
          const status =
            i === 12 ? "down" : i === 33 || i === 34 ? "degraded" : i === 50 ? "maintenance" : "operational"
          return { status, label: `Day ${i + 1} — ${status}` }
        }),
      }),
    template: `<div class="w-96 flex flex-col gap-6">
  <LpUptimeBar
    :segments="days"
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
  },
  {
    id: "stepper",
    name: "Stepper",
    description: "Multi-step progress indicator.",
    components: { LpStepper },
    state: () => reactive({ steps: [{ label: "Account" }, { label: "Profile" }, { label: "Done" }] }),
    template: `<LpStepper :steps="steps" :current="1" />`,
  },
  {
    id: "breadcrumbs",
    name: "Breadcrumbs",
    description: "Hierarchical navigation trail.",
    components: { LpBreadcrumbs },
    state: () => reactive({ items: [{ label: "Home", href: "#" }, { label: "Servers", href: "#" }, { label: "ger-01-p" }] }),
    template: `<LpBreadcrumbs :items="items" />`,
  },
  {
    id: "password",
    name: "PasswordInput",
    description: "Password field with show/hide toggle.",
    components: { LpPasswordInput },
    state: () => reactive({ value: "" }),
    template: `<div class="w-72"><LpPasswordInput v-model="value" placeholder="••••••••" /></div>`,
  },
  {
    id: "phone",
    name: "PhoneInput",
    description:
      "Phone field with a country picker (flag + dial code). Picking a country sets the +code prefix; you can also type the whole number yourself and the flag follows what you type. v-model is the full string; @change carries { country, dialCode, number }.",
    components: { LpPhoneInput },
    state: () => reactive({ value: "", detail: null }),
    template: `<div class="w-80">
  <LpPhoneInput v-model="value" default-country="UA" @change="detail = $event" />
  <p class="mt-2 text-xs text-muted">Value: {{ value || "—" }}</p>
  <p v-if="detail" class="text-xs text-muted">
    {{ detail.country ? detail.country.name : "unknown" }} · code +{{ detail.dialCode || "?" }} · national {{ detail.number || "—" }}
  </p>
</div>`,
  },
  {
    id: "address",
    name: "AddressInput",
    description:
      "Postal address form with live suggestions on the street and city fields, plus a map to drop a pin when typing won't do — the picked point is reverse-geocoded back into the fields. v-model is { line, city, postalCode, country, lat, lon }. The geocoder (`provider`), tile server (`tiles`) and the map itself (the `map` slot) are all replaceable; the picker is loaded on demand, so forms that never open the map don't pay for it.",
    components: { LpAddressInput },
    state: () => reactive({ value: { line: "", city: "", postalCode: "", country: "" } }),
    template: `<div class="w-full max-w-xl">
  <LpAddressInput v-model="value" second-line />
  <p class="mt-3 text-xs text-muted">{{ JSON.stringify(value) }}</p>
</div>`,
  },
  {
    id: "map-picker",
    name: "MapPicker",
    description:
      "The picker on its own: drag to pan, wheel or the buttons to zoom, click to drop the pin. v-model is { lat, lon }. Raster {z}/{x}/{y} tiles from any server via `tiles` — no mapping library, so nothing extra reaches the bundle.",
    components: { LpMapPicker },
    state: () => reactive({ point: { lat: 50.0875, lon: 14.4213 } }),
    template: `<div class="w-full max-w-xl">
  <LpMapPicker v-model="point" :zoom="14" height="18rem" />
  <p class="mt-2 text-xs text-muted">{{ point.lat.toFixed(5) }}, {{ point.lon.toFixed(5) }}</p>
</div>`,
  },
  {
    id: "otp",
    name: "OtpInput",
    description:
      "One-time-code (TOTP / 2FA) input — a row of cells with auto-advance, backspace, and full-code paste. v-model is the joined string; @complete fires it once every cell is filled. Digits-only by default; `length`, `mask`, `alphanumeric`, `invalid`.",
    components: { LpOtpInput },
    state: () => reactive({ code: "", done: "" }),
    template: `<div class="flex flex-col gap-3">
  <LpOtpInput v-model="code" @complete="done = $event" />
  <p class="text-xs text-muted">Code: {{ code || "—" }}</p>
  <p v-if="done" class="text-xs text-action">Completed: {{ done }}</p>
</div>`,
  },
  {
    id: "dropdown",
    name: "DropdownMenu",
    description: "Action menu with icons and danger items.",
    components: { LpDropdownMenu, LpButton },
    state: () => reactive({
      items: [
        { label: "Edit", icon: "lucide:pencil" },
        { label: "Duplicate", icon: "lucide:copy" },
        { label: "Delete", icon: "lucide:trash-2", danger: true, separatorBefore: true },
      ],
    }),
    template: `<LpDropdownMenu :items="items">
  <template #trigger><LpButton variant="outline">Actions ▾</LpButton></template>
</LpDropdownMenu>`,
  },
  {
    id: "codeblock",
    name: "CodeBlock",
    description:
      "Code with lightweight, theme-aware highlighting (zero-dep tokenizer; ts/js/json/bash/python/rust). Line numbers, wrap, copy, language label. locked=true is read-only; lockToggle adds an editable mode (v-model writes back, highlighting stays live).",
    components: { LpCodeBlock },
    state: () =>
      reactive({
        rust: 'fn main() {\\n    let count = 42; // answer\\n    println!("hello, {}", count);\\n}',
        py: 'def greet(name: str) -> str:\\n    # build the greeting\\n    return f"hello, {name}"',
        editable: '{\\n  "service": "api",\\n  "replicas": 3,\\n  "healthy": true\\n}',
        locked: true,
      }),
    template: `<div class="flex flex-col gap-4">
  <LpCodeBlock :model-value="rust" lang="rust" line-numbers title="main.rs" />
  <LpCodeBlock :model-value="py" lang="python" />
  <LpCodeBlock v-model="editable" lang="json" lock-toggle v-model:locked="locked" title="config.json" />
</div>`,
  },
  {
    id: "calendar",
    name: "Calendar · DatePicker",
    description:
      "Inline month calendar and a field+popover date picker (reka Calendar + @internationalized/date). Model is an ISO \"YYYY-MM-DD\" string; min/max bounds and an isDisabled predicate. Today is tinted, the selection is a brand pill.",
    components: { LpCalendar, LpDatePicker },
    state: () => reactive({ date: "2026-06-18", picked: "" }),
    template: `<div class="flex flex-wrap items-start gap-6">
  <LpCalendar v-model="date" min="2026-06-01" />
  <div class="flex w-64 flex-col gap-2">
    <LpDatePicker v-model="picked" clearable placeholder="Select a date" />
    <p class="text-xs text-muted">ISO value: {{ picked || "—" }}</p>
  </div>
</div>`,
  },
  {
    id: "commandpalette",
    name: "CommandPalette",
    description:
      "⌘K command palette (reka Dialog + Listbox): grouped, searchable commands with icons, shortcut hints and keyboard nav. Matches label + keywords. Binds a global ⌘K/Ctrl-K toggle by default.",
    components: { LpCommandPalette, LpButton },
    state: () =>
      reactive({
        open: false,
        commands: [
          { id: "new", label: "New server", description: "Provision a fresh node", icon: "lucide:plus", shortcut: "⌘N", group: "Actions", keywords: ["create", "add"] },
          { id: "deploy", label: "Deploy current branch", description: "Roll out to production", icon: "lucide:rocket", group: "Actions", keywords: ["ship", "release"] },
          { id: "logs", label: "View logs", description: "Tail the live log stream", icon: "lucide:scroll-text", shortcut: "⌘L", group: "Navigate" },
          { id: "metrics", label: "Open metrics", icon: "lucide:activity", group: "Navigate" },
          { id: "theme", label: "Toggle theme", icon: "lucide:palette", group: "Preferences", keywords: ["dark", "light", "appearance"] },
        ],
      }),
    template: `<div>
  <LpButton variant="outline" @click="open = true">Open palette ( ⌘K )</LpButton>
  <LpCommandPalette v-model:open="open" :commands="commands" />
</div>`,
  },
  {
    id: "contextmenu",
    name: "ContextMenu",
    description:
      "Right-click menu (reka ContextMenu): icons, shortcut hints, danger items, separators and nested submenus. Right-click (or long-press) the target. With an empty `items` it's a passthrough — the element keeps the browser's native menu — so wrappers like Table/Sidebar/Avatar/Card can pass [] to opt out per element.",
    components: { LpContextMenu },
    state: () =>
      reactive({
        items: [
          { label: "Open", icon: "lucide:external-link", shortcut: "⏎" },
          { label: "Copy", icon: "lucide:copy", shortcut: "⌘C" },
          {
            label: "Move to",
            icon: "lucide:folder-input",
            children: [
              { label: "Production", icon: "lucide:server" },
              { label: "Staging", icon: "lucide:flask-conical" },
            ],
          },
          { label: "Delete", icon: "lucide:trash-2", shortcut: "⌫", danger: true, separatorBefore: true },
        ],
      }),
    template: `<LpContextMenu :items="items">
  <div class="grid h-32 w-full place-items-center rounded-card border border-dashed border-line text-sm text-muted">
    Right-click here
  </div>
</LpContextMenu>`,
  },
  {
    id: "emptystate",
    name: "EmptyState",
    description: "Placeholder for empty lists.",
    components: { LpEmptyState, LpButton },
    template: `<LpEmptyState icon="lucide:inbox" title="No servers yet" description="Add your first server to start monitoring.">
  <LpButton variant="solid" size="sm">Add server</LpButton>
</LpEmptyState>`,
  },
  {
    id: "notificationbell",
    name: "NotificationBell",
    description:
      "Icon button with an unread badge that opens a popover feed on left-click; right-click for quick actions (Mark all read; override via `menuItems`). Each feed row has its own right-click menu (mark read/unread, open, dismiss). Data-driven: bind items / unread-count and handle mark-read / mark-unread / mark-all-read / dismiss / select — no fetching inside. Rows are rounded tiles showing icon, title, body, relative time and an unread dot.",
    components: { LpNotificationBell },
    state: () => {
      const s = reactive({
        items: [
          {
            id: "1",
            title: "Payment received",
            body: "Your payment of €12.99 was received.",
            icon: "lucide:check-circle",
            createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
            read: false,
          },
          {
            id: "2",
            title: "Service resumed",
            body: "ger-01-p is back online.",
            icon: "lucide:server",
            createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
            read: false,
          },
          {
            id: "3",
            title: "Invoice available",
            body: "Your June invoice is ready to view.",
            icon: "lucide:receipt-text",
            createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
            read: true,
          },
        ],
        markRead(id: string) {
          const n = s.items.find((x) => x.id === id)
          if (n) n.read = true
        },
        markUnread(id: string) {
          const n = s.items.find((x) => x.id === id)
          if (n) n.read = false
        },
        markAllRead() {
          for (const n of s.items) n.read = true
        },
        dismiss(id: string) {
          s.items = s.items.filter((x) => x.id !== id)
        },
      })
      return s
    },
    template: `<div class="flex items-center gap-4">
  <LpNotificationBell :items="items" @mark-read="markRead" @mark-unread="markUnread" @mark-all-read="markAllRead" @dismiss="dismiss" />
  <span class="text-sm text-muted">← click to open · right-click on a row</span>
</div>`,
  },
  {
    id: "skeleton",
    name: "Skeleton",
    description: "Loading placeholders.",
    components: { LpSkeleton },
    template: `<div class="flex w-72 flex-col gap-2">
  <LpSkeleton class="h-10 w-10" rounded="pill" />
  <LpSkeleton class="h-4 w-full" />
  <LpSkeleton class="h-4 w-2/3" />
</div>`,
  },
  {
    id: "divider",
    name: "Divider · Link",
    description: "Separator rule and inline links.",
    components: { LpDivider, LpLink },
    template: `<div class="flex w-80 flex-col gap-3">
  <LpLink href="#">Default link</LpLink>
  <LpDivider label="or" />
  <LpLink href="#" external>External link</LpLink>
</div>`,
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
  <div class="flex items-center gap-3">
    <LpInput v-model="query" icon="lucide:search" placeholder="Highlight…" class="flex-1" />
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
</div>`,
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
  },
  {
    id: "toast",
    name: "Toast",
    description:
      "Stackable notifications via the useToast() composable (a global singleton). LpToaster is mounted once at the app root; anywhere can call toast.success(...) etc. Hover pauses the countdown; toasts support a title, action buttons, a whole-toast click, and duration:0 to persist.",
    components: { LpButton },
    state: () => {
      const toast = useToast()
      return {
        info: () => toast.info("Heads up — metrics refreshed."),
        success: () => toast.success("Saved", { title: "Profile updated" }),
        warning: () => toast.warning("Connection pool is running hot (82%)."),
        error: () => toast.error("Upstream timed out", { title: "Billing failed" }),
        withAction: () =>
          toast.info("Server ger-01-p went offline.", {
            title: "Host down",
            actions: [{ label: "View", onClick: () => { toast.success("Opening host…") } }],
          }),
        persistent: () =>
          toast.warning("Deploy in progress — don't close the tab.", { duration: 0 }),
        clearAll: () => toast.clear(),
      }
    },
    template: `<div class="flex max-w-md flex-wrap gap-2">
  <LpButton size="sm" @click="info">Info</LpButton>
  <LpButton size="sm" variant="action" @click="success">Success</LpButton>
  <LpButton size="sm" variant="soft" @click="warning">Warning</LpButton>
  <LpButton size="sm" variant="danger" @click="error">Error</LpButton>
  <LpButton size="sm" variant="outline" @click="withAction">With action</LpButton>
  <LpButton size="sm" variant="outline" @click="persistent">Persistent</LpButton>
  <LpButton size="sm" variant="ghost" @click="clearAll">Clear all</LpButton>
</div>`,
  },
  {
    id: "formfield",
    name: "FormField",
    description: "Label + control + hint/error wrapper.",
    components: { LpFormField, LpInput },
    state: () => reactive({ value: "" }),
    template: `<div class="flex w-80 flex-col gap-4">
  <LpFormField label="Nickname" hint="Shown on your profile" required>
    <template #default="{ id }"><LpInput :id="id" v-model="value" placeholder="Steve" /></template>
  </LpFormField>
  <LpFormField label="Email" error="That doesn't look like an email">
    <template #default="{ id }"><LpInput :id="id" v-model="value" invalid /></template>
  </LpFormField>
</div>`,
  },
  {
    id: "modal",
    name: "Modal",
    description: "Dialog with overlay, title and footer. size=sm…xl|2xl|3xl|full (or width=\"…\"); long content scrolls inside. A body that arrives late resizes the panel smoothly instead of snapping — see the second example.",
    components: { LpModal, LpButton },
    state: () => {
      const s = reactive({
        open: false,
        lazy: false,
        loading: true,
        openLazy() {
          s.loading = true
          s.lazy = true
          setTimeout(() => {
            s.loading = false
          }, 900)
        },
      })
      return s
    },
    template: `<div class="flex flex-wrap gap-2">
  <LpButton variant="solid" @click="open = true">Open modal</LpButton>
  <LpButton variant="outline" @click="openLazy()">Open with late content</LpButton>

  <LpModal v-model:open="open" size="lg" title="Confirm action" description="A token-driven modal on reka Dialog.">
    <p>Body content. Escape or overlay-click closes it.</p>
    <template #footer>
      <LpButton variant="ghost" @click="open = false">Cancel</LpButton>
      <LpButton variant="solid" @click="open = false">Confirm</LpButton>
    </template>
  </LpModal>

  <!-- Opens around a placeholder, then grows into the loaded body. -->
  <LpModal v-model:open="lazy" size="lg" title="Server details">
    <p v-if="loading" class="text-muted">Loading…</p>
    <div v-else class="flex flex-col gap-3">
      <p>The panel eased to this height instead of jumping to it.</p>
      <p class="text-muted">Region eu-central · 8 vCPU · 32 GB RAM · 2 TB NVMe</p>
      <p class="text-muted">Uptime 71 days. Last backup 4 hours ago, verified.</p>
      <p class="text-muted">Reopen it to watch the transition again.</p>
    </div>
    <template #footer>
      <LpButton variant="ghost" @click="lazy = false">Close</LpButton>
    </template>
  </LpModal>
</div>`,
  },
  {
    id: "confirm",
    name: "ConfirmDialog",
    description: "Confirm/cancel dialog over Modal.",
    components: { LpConfirmDialog, LpButton },
    state: () => reactive({ open: false }),
    template: `<div>
  <LpButton variant="danger" @click="open = true">Delete server</LpButton>
  <LpConfirmDialog v-model:open="open" danger title="Delete server?" description="This cannot be undone." confirmLabel="Delete">
    The server and its data will be permanently removed.
  </LpConfirmDialog>
</div>`,
  },
  {
    id: "drawer",
    name: "Drawer",
    description:
      "Drag-driven panel on vaul-vue: drag-to-dismiss with inertia, snap points, a grab handle and an optional scale-background. direction=top|bottom|left|right (side=left|right still works), size=sm…xl or width=\"…\", snapPoints, dismissible, handleOnly, scaleBackground. Interactive controls inside are auto-excluded from the drag (noDragControls, on by default) so you can select text / use inputs; noDragContent makes the whole body non-draggable (handle/header only).",
    components: { LpDrawer, LpButton, LpInput },
    state: () => reactive({ side: false, sheet: false, snap: false, q: "", note: "" }),
    template: `<div class="flex flex-wrap gap-2">
  <LpButton variant="outline" @click="side = true">Side panel</LpButton>
  <LpButton variant="outline" @click="sheet = true">Bottom sheet</LpButton>
  <LpButton variant="outline" @click="snap = true">Snap points</LpButton>

  <!-- Side drawer with a form: drag the input → text selects, drawer stays put. -->
  <LpDrawer v-model:open="side" direction="right" size="lg" title="Filters" description="Try dragging the input — it selects text instead of moving the drawer">
    <div class="flex flex-col gap-3">
      <LpInput v-model="q" placeholder="Search filters…" />
      <textarea v-model="note" rows="3" class="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none" placeholder="A textarea you can drag-select in" />
      <p class="text-sm text-muted">The drawer still drags from blank space and the header.</p>
    </div>
  </LpDrawer>

  <!-- Mobile-style bottom sheet with a handle. -->
  <LpDrawer v-model:open="sheet" direction="bottom" size="sm" handle title="Bottom sheet">
    <p class="text-sm text-muted">Drag the handle down to dismiss.</p>
  </LpDrawer>

  <!-- Multi-position sheet: snaps between 30% / 60% / 95%. -->
  <LpDrawer
    v-model:open="snap"
    direction="bottom"
    :snap-points="[0.3, 0.6, 0.95]"
    handle
    handle-only
    title="Snap points"
  >
    <div class="space-y-2 text-sm text-muted">
      <p v-for="i in 30" :key="i">Scrollable row {{ i }} — drag the handle to snap.</p>
    </div>
  </LpDrawer>
</div>`,
  },
  {
    id: "popover",
    name: "Popover · Tooltip",
    description:
      "Anchored overlays. Popover takes side/align, `side-offset`, `panel-class` (width/padding/overflow) and a controllable `v-model:open`; left unbound it stays uncontrolled.",
    components: { LpPopover, LpTooltip, LpButton },
    state: () => reactive({ open: false }),
    template: `<div class="flex items-center gap-3">
  <LpTooltip content="I appear on hover">
    <LpButton variant="outline">Hover me</LpButton>
  </LpTooltip>
  <LpPopover>
    <template #trigger><LpButton variant="ghost">Open popover</LpButton></template>
    <p class="font-semibold text-ink">Popover content</p>
    <p class="mt-1 text-muted">Anchored, animated, on the popover z-layer.</p>
  </LpPopover>
  <!-- Controlled + configured: wider panel, larger offset, end-aligned. -->
  <LpPopover
    v-model:open="open"
    align="end"
    :side-offset="10"
    panel-class="w-72"
  >
    <template #trigger>
      <LpButton variant="outline">Controlled ({{ open ? 'open' : 'closed' }})</LpButton>
    </template>
    <p class="font-semibold text-ink">v-model:open</p>
    <p class="mt-1 text-muted">The trigger label tracks the open state via v-model.</p>
  </LpPopover>
</div>`,
  },
  {
    id: "scrollarea",
    name: "ScrollArea",
    description: "Drawn overlay scrollbar (themed, hover-grow). `fade` softens edges; `content-class` styles the scrollable content (gap/padding). The kit uses this for its own scroll regions (Table, Modal/Drawer body, Sidebar) so native bars never reserve viewport width. For app-level scroll: `.lp-scrollbar-none` hides a bar on any element; add `lp-scroll-hide` to <html> to drop the page's native bar site-wide; or import `@leavepulse/ui/scrollbar` to skin native bars to the kit look.",
    components: { LpScrollArea },
    template: `<LpScrollArea fade class="h-40 w-72 rounded-card border border-line" content-class="flex flex-col gap-2 p-3">
  <p v-for="i in 12" :key="i" class="rounded-md bg-surface-soft px-3 py-2 text-sm text-muted">Row {{ i }}</p>
</LpScrollArea>`,
  },
  {
    id: "numberfield",
    name: "NumberField",
    description: "Numeric input with stepper buttons, min/max/step.",
    components: { LpNumberField },
    state: () => reactive({ value: 30 }),
    template: `<div class="w-48">
  <LpNumberField v-model="value" :min="0" :max="100" :step="5" />
  <p class="mt-2 text-xs text-muted">value: {{ value }}</p>
</div>`,
  },
  {
    id: "slider",
    name: "Slider",
    description: "Single-value slider, min/max/step.",
    components: { LpSlider },
    state: () => reactive({ value: 40 }),
    template: `<div class="w-72">
  <LpSlider v-model="value" :min="0" :max="100" />
  <p class="mt-2 text-xs text-muted">value: {{ value }}</p>
</div>`,
  },
  {
    id: "alert",
    name: "Alert",
    description:
      "Inline callout with info/success/warning/danger variants, an auto icon (overridable), and an optional title.",
    components: { LpAlert },
    template: `<div class="flex flex-col gap-3">
  <LpAlert variant="info" title="Heads up">Your invoice is due in 3 days.</LpAlert>
  <LpAlert variant="success">Payment received — thank you.</LpAlert>
  <LpAlert variant="warning" title="Action needed">Verify your billing address to continue.</LpAlert>
  <LpAlert variant="danger" title="Payment failed">We couldn't charge your card.</LpAlert>
</div>`,
  },
  {
    id: "table",
    name: "Table",
    description:
      "Data-driven table: typed columns (align/width/sortable), row key, empty state, per-column scoped cell slots (`#cell-<key>`), client/server sorting via v-model:sort, row selection via v-model:selected, a per-row right-click menu via `rowMenu`, and stickyHeader.",
    components: { LpTable, LpBadge },
    state: () => {
      const s = reactive({
        sort: { key: "amount", dir: "desc" },
        selected: ["ORD-1041"],
        columns: [
          { key: "id", label: "Order", width: "30%", sortable: true },
          { key: "amount", label: "Amount", align: "right", sortable: true },
          { key: "status", label: "Status", align: "center" },
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
        // Per-row menu: returns items for the right-clicked row.
        rowMenu(row: { id: string; status: string }) {
          return [
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
          ]
        },
      })
      return s
    },
    template: `<div class="flex flex-col gap-2">
  <LpTable
    :columns="columns"
    :rows="rows"
    row-key="id"
    selectable
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
  </LpTable>
  <p class="text-xs text-muted">Sorted by {{ sort?.key ?? '—' }} {{ sort?.dir ?? '' }} · {{ selected.length }} selected · right-click a row</p>

  <!-- Fixed height + stickyHeader: scrolls via LpScrollArea, header pins to top. -->
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
</div>`,
  },
  {
    id: "pagination",
    name: "Pagination",
    description:
      "Windowed page navigator (prev/next + ellipses). v-model:page (1-based); size it via total+pageSize or pageCount. Pairs with Table.",
    components: { LpPagination },
    state: () => reactive({ page: 4 }),
    template: `<div class="flex flex-col items-center gap-3">
  <LpPagination v-model:page="page" :total="240" :page-size="10" />
  <p class="text-xs text-muted">Page {{ page }} of 24</p>
</div>`,
  },
  {
    id: "file-tree",
    name: "FileTree",
    description:
      "File/folder tree: directories-first ordering, type-derived icons, size/modified columns, per-row context menus and lazy children (a dir with no `children` emits `expand` once). `checkable` turns it into a picker — tri-state folders, cascading ticks, and a rolled-up summary of what's selected. Arrows navigate, →/← expand, Space ticks.",
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
  },
  {
    id: "theme-switcher",
    name: "ThemeSwitcher",
    description:
      "Theme picker wired to the token engine — swatch / icon / pill triggers, circular-reveal transition on change, and the choice persisted across reloads.",
    components: { LpThemeSwitcher },
    template: `<div class="flex items-center gap-6">
  <LpThemeSwitcher variant="swatch" />
  <LpThemeSwitcher variant="icon" />
  <LpThemeSwitcher variant="pill" />
</div>`,
  },
  {
    id: "toc",
    name: "TableOfContents",
    description:
      "On-this-page rail with scroll-spy: nested heading links, an indicator that slides to the section in view, and smooth-scroll on click.",
    components: { LpTableOfContents },
    state: () =>
      reactive({
        links: [
          { id: "toc-install", text: "Install" },
          {
            id: "toc-usage",
            text: "Usage",
            children: [
              { id: "toc-nuxt", text: "Nuxt module" },
              { id: "toc-vite", text: "Vite" },
            ],
          },
          { id: "toc-theming", text: "Theming" },
        ],
      }),
    template: `<div class="flex gap-8">
  <LpTableOfContents :links="links" class="w-52 shrink-0" />
  <!-- Scrollable article so the spy has something to track. -->
  <div class="h-72 flex-1 overflow-y-auto rounded-card border border-line p-4">
    <section v-for="l in [links[0], links[1], links[1].children[0], links[1].children[1], links[2]]" :key="l.id" :id="l.id" class="mb-6">
      <h3 class="mb-2 font-semibold text-ink">{{ l.text }}</h3>
      <p class="text-sm text-muted">Scroll this panel — the rail tracks the heading in view.</p>
      <p class="mt-2 text-sm text-muted">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</p>
    </section>
  </div>
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
  },
  {
    id: "lightbox",
    name: "Lightbox",
    description:
      "Full-screen image viewer: arrows or swipe to page, wheel zooms toward the cursor, drag pans, double-click toggles fit/2x, pinch on touch, rotate, download, copy. Esc or a backdrop click closes; a filmstrip tracks the set. Keyboard: ←/→, Home/End, +/−, 0, R.",
    components: { LpLightbox, LpButton },
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
  },
]
