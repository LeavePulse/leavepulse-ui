import { reactive, type Component } from "vue"
import {
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
  LpPasswordInput,
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
  LpTabs,
  LpTextarea,
  LpTooltip,
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
    description: "Variants, sizes (xs–lg), block, and square (icon-only).",
    components: { LpButton },
    template: `<div class="flex flex-col gap-3">
  <div class="flex flex-wrap items-center gap-2">
    <LpButton variant="solid">Solid</LpButton>
    <LpButton variant="action">Action</LpButton>
    <LpButton variant="outline">Outline</LpButton>
    <LpButton variant="ghost">Ghost</LpButton>
    <LpButton variant="muted">Muted</LpButton>
    <LpButton variant="danger">Danger</LpButton>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <LpButton size="xs">xs</LpButton>
    <LpButton size="sm">sm</LpButton>
    <LpButton size="md">md</LpButton>
    <LpButton size="lg">lg</LpButton>
    <LpButton square variant="outline">+</LpButton>
  </div>
</div>`,
  },
  {
    id: "input",
    name: "Input",
    description: "Text field with sizes, invalid state, and leading/trailing slots.",
    components: { LpInput, LpIcon },
    state: () => reactive({ value: "" }),
    template: `<div class="flex w-72 flex-col gap-2">
  <LpInput v-model="value" placeholder="Type here…" />
  <LpInput v-model="value" placeholder="Search…">
    <template #leading><LpIcon name="lucide:search" :size="15" /></template>
  </LpInput>
  <LpInput v-model="value" invalid placeholder="Invalid" />
</div>`,
  },
  {
    id: "select",
    name: "Select",
    description: "Searchable / multiple select on reka-ui. Option values may be string OR number.",
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
    }),
    template: `<div class="flex w-72 flex-col gap-3">
  <LpSelect v-model="value" :options="options" searchable clearable placeholder="Pick a region" />
  <LpSelect v-model="pageSize" :options="sizes" />
  <p class="text-xs text-muted">numeric value: {{ pageSize }} ({{ typeof pageSize }})</p>
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
    template: `<div class="flex gap-2">
  <LpBadge tone="neutral" dot>Neutral</LpBadge>
  <LpBadge tone="brand" dot>Online</LpBadge>
  <LpBadge tone="action">Active</LpBadge>
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
    description: "Multi-line input.",
    components: { LpTextarea },
    state: () => reactive({ value: "" }),
    template: `<div class="w-80">
  <LpTextarea v-model="value" placeholder="Multi-line…" />
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
    template: `<div class="flex w-80 flex-col gap-3">
  <LpDisclosure label="Customize text" icon="lucide:sliders-horizontal" scroll-into-view>
    <LpInput v-model="value" placeholder="Details template…" />
    <p class="text-xs text-muted">Body content animates open and fades in.</p>
  </LpDisclosure>
  <LpDisclosure v-model:open="open" default-open>
    <template #trigger>Advanced (custom #trigger) — {{ open ? "open" : "closed" }}</template>
    <p class="text-sm text-muted">Controlled via v-model:open, starts open.</p>
  </LpDisclosure>
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
]
