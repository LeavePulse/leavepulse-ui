import { reactive, type Component } from "vue"
import {
  LpAlert,
  LpAutocomplete,
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
  LpDropdownMenu,
  LpEmptyState,
  LpFormField,
  LpIcon,
  LpInput,
  LpLink,
  LpModal,
  LpNumberField,
  LpOtpInput,
  LpPasswordInput,
  LpPhoneInput,
  LpPopover,
  LpProgress,
  LpRadioGroup,
  LpScrollArea,
  LpSelect,
  LpSkeleton,
  LpSlider,
  LpStat,
  LpStepper,
  LpSwitch,
  LpTable,
  LpTabs,
  LpTextarea,
  LpTooltip,
  LpUptimeBar,
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
    description: "Boolean and choice controls.",
    components: { LpSwitch, LpCheckbox, LpRadioGroup },
    state: () => reactive({ on: true, checked: true, plan: "pro", radioOpts }),
    template: `<div class="flex items-start gap-8">
  <LpSwitch v-model="on" />
  <LpCheckbox v-model="checked" label="Remember me" />
  <LpRadioGroup v-model="plan" :options="radioOpts" />
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
    description: "Surface container in raised / flat / ghost.",
    components: { LpCard },
    template: `<div class="grid w-full grid-cols-3 gap-3">
  <LpCard>Raised</LpCard>
  <LpCard variant="flat">Flat</LpCard>
  <LpCard variant="flat" interactive>Interactive</LpCard>
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
    description: "Metric tile: label, mono value, hint.",
    components: { LpStat },
    template: `<div class="grid w-full grid-cols-2 gap-6">
  <LpStat online label="Servers online" value="43" hint="Responding now." />
  <LpStat label="Total playtime" value="19,802 h" hint="Across integrations." />
</div>`,
  },
  {
    id: "avatar",
    name: "Avatar",
    description: "User image with initials fallback, three sizes.",
    components: { LpAvatar },
    template: `<div class="flex items-center gap-3">
  <LpAvatar size="sm" fallback="SA" />
  <LpAvatar size="md" fallback="LP" />
  <LpAvatar size="lg" alt="System Admin" />
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
    template: `<div class="w-96">
  <LpUptimeBar
    :segments="days"
    title="api.leavepulse.io"
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
    id: "emptystate",
    name: "EmptyState",
    description: "Placeholder for empty lists.",
    components: { LpEmptyState, LpButton },
    template: `<LpEmptyState icon="lucide:inbox" title="No servers yet" description="Add your first server to start monitoring.">
  <LpButton variant="solid" size="sm">Add server</LpButton>
</LpEmptyState>`,
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
    description: "Dialog with overlay, title and footer. size=sm…xl|2xl|3xl|full (or width=\"…\"); long content scrolls inside.",
    components: { LpModal, LpButton },
    state: () => reactive({ open: false }),
    template: `<div>
  <LpButton variant="solid" @click="open = true">Open modal</LpButton>
  <LpModal v-model:open="open" size="lg" title="Confirm action" description="A token-driven modal on reka Dialog.">
    <p>Body content. Escape or overlay-click closes it.</p>
    <template #footer>
      <LpButton variant="ghost" @click="open = false">Cancel</LpButton>
      <LpButton variant="solid" @click="open = false">Confirm</LpButton>
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
    description: "Side panel sliding from an edge. side=left|right, size=sm…xl (or width=\"…\").",
    components: { LpDrawer, LpButton },
    state: () => reactive({ open: false }),
    template: `<div>
  <LpButton variant="outline" @click="open = true">Open drawer</LpButton>
  <LpDrawer v-model:open="open" size="lg" title="Filters" description="Refine the list">
    <p class="text-sm text-muted">Drawer body — put filter controls here.</p>
  </LpDrawer>
</div>`,
  },
  {
    id: "popover",
    name: "Popover · Tooltip",
    description: "Anchored overlays.",
    components: { LpPopover, LpTooltip, LpButton },
    template: `<div class="flex items-center gap-3">
  <LpTooltip content="I appear on hover">
    <LpButton variant="outline">Hover me</LpButton>
  </LpTooltip>
  <LpPopover>
    <template #trigger><LpButton variant="ghost">Open popover</LpButton></template>
    <p class="font-semibold text-ink">Popover content</p>
    <p class="mt-1 text-muted">Anchored, animated, on the popover z-layer.</p>
  </LpPopover>
</div>`,
  },
  {
    id: "scrollarea",
    name: "ScrollArea",
    description: "Drawn overlay scrollbar (themed, hover-grow). `fade` softens edges; `content-class` styles the scrollable content (gap/padding).",
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
      "Data-driven table: typed columns (align/width), row key, empty state, and per-column scoped cell slots (`#cell-<key>`).",
    components: { LpTable, LpBadge },
    state: () =>
      reactive({
        columns: [
          { key: "id", label: "Order", width: "30%" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "status", label: "Status", align: "center" },
        ],
        rows: [
          { id: "ORD-1042", amount: "€12.00", status: "paid" },
          { id: "ORD-1041", amount: "€12.00", status: "pending" },
          { id: "ORD-1040", amount: "€24.00", status: "failed" },
        ],
      }),
    template: `<LpTable :columns="columns" :rows="rows" row-key="id">
  <template #cell-status="{ value }">
    <LpBadge :tone="value === 'paid' ? 'success' : value === 'pending' ? 'neutral' : 'danger'">
      {{ value }}
    </LpBadge>
  </template>
</LpTable>`,
  },
]
