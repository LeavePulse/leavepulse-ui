import { defineComponent, reactive, type Component } from "vue"
import {
  LpActionBar,
  LpThemeProvider,
  LpTooltipProvider,
  confirm,
  presets,
  useTheme,
  LpAddressInput,
  LpAlert,
  LpAutocomplete,
  LpMapPicker,
  LpMediaGallery,
  LpAvatar,
  LpBadge,
  LpBreadcrumbs,
  LpButton,
  LpCard,
  LpChart,
  LpCheckbox,
  LpConfirmDialog,
  LpShortcutsDialog,
  LpDisclosure,
  LpDivider,
  LpDrawer,
  LpCalendar,
  LpCodeBlock,
  LpColorPicker,
  LpCommandPalette,
  pushRecent,
  type RecentEntry,
  type RecentItem,
  LpKeys,
  LpPaletteFacts,
  LpPaletteHeader,
  LpPalettePreview,
  LpPaletteStats,
  LpPaletteSwatches,
  LpContextMenu,
  LpDatePicker,
  LpDropdownMenu,
  LpDropzone,
  LpEmptyState,
  LpFileTree,
  type FileNode,
  LpFormField,
  LpIcon,
  LpImageEditor,
  LpInput,
  LpLightbox,
  type LightboxItem,
  LpLink,
  LpLogViewer,
  LpModal,
  LpModalNav,
  LpNotificationBell,
  LpNumberField,
  LpTimeField,
  LpNumberFlow,
  LpOtpInput,
  LpPagination,
  LpPasswordInput,
  LpPhoneInput,
  LpPie,
  LpPopover,
  LpProgress,
  LpRadio,
  LpRollingText,
  LpRadioGroup,
  LpScrollArea,
  LpSection,
  LpSelect,
  LpShift,
  LpSwap,
  LpSkeleton,
  LpSlider,
  LpRangeSlider,
  LpVideoBackdrop,
  formatClipTime,
  LpSparkline,
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
  LpTour,
  LpHintLayer,
  LpHints,
  LpHintExample,
  contextMenuTip,
  createHintSystem,
  HINT_SIGNALS,
  localHintStorage,
  paletteTip,
  hints,
  openContextMenu,
  type TourContext,
  LpUptimeBar,
  LpDateRangePicker,
  LpRangeCalendar,
  LpTagsInput,
  pendingHotkey,
  useForm,
  useGamepadNav,
  useHotkeys,
  useToast,
} from "../../src"
// A real image, so the avatar demos show the loaded state rather than only the
// initials fallback, and so the skeleton demo can show what it stands in for.
import avatarSample from "../assets/avatar-sample.png"
import avatarSunny from "../assets/avatar-sunny.png"
import videoBackdropSample from "../assets/video-backdrop-sample.webm"
import { ConfigScope, CustomSheet, LayerKeys, RatingControl } from "./demos"

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

/*
 * Stands in for a screen with keys of its own: while it is mounted, its
 * bindings are in the live reference, and they leave with it.
 */
const EditorKeys = defineComponent({
  setup() {
    useHotkeys([
      { key: "z", code: "KeyZ", ctrl: true, help: { group: "Editor", label: "Undo" }, handler: () => {} },
      { key: "z", code: "KeyZ", ctrl: true, shift: true, help: { group: "Editor", label: "Redo" }, handler: () => {} },
      { key: "a", code: "KeyA", ctrl: true, help: { group: "Editor", label: "Select all" }, handler: () => {} },
    ])
    return () => null
  },
})

// Sequences next to a single-key binding on their own first key: "g" alone
// waits for the timeout, "g i" and "g s" run at once. The duplicate Ctrl+S
// shows the conflict marker in the live reference.
const SequenceKeys = defineComponent({
  emits: ["fired"],
  setup(_, { emit }) {
    useHotkeys([
      { sequence: [{ key: "g", code: "KeyG" }, { key: "i", code: "KeyI" }], help: { group: "Go to", label: "Inbox" }, handler: () => emit("fired", "Inbox") },
      { sequence: [{ key: "g", code: "KeyG" }, { key: "s", code: "KeyS" }], help: { group: "Go to", label: "Settings" }, handler: () => emit("fired", "Settings") },
      { key: "g", code: "KeyG", help: { group: "Go to", label: "Top of the page" }, handler: () => emit("fired", "Top") },
      { key: "s", code: "KeyS", ctrl: true, help: { group: "Editor", label: "Save draft" }, handler: () => emit("fired", "Save draft") },
    ])
    return () => null
  },
})

/*
 * Turns controller navigation on while it is mounted and says whether a pad
 * is connected; B with nothing open, and the bumpers, report what they did.
 */
const GamepadNav = defineComponent({
  emits: ["fired"],
  setup(_, { emit }) {
    const { connected } = useGamepadNav({
      onBack: () => emit("fired", "Back"),
      onPrevious: () => emit("fired", "Previous section"),
      onNext: () => emit("fired", "Next section"),
      onMenu: () => emit("fired", "Menu"),
    })
    return () => (connected.value ? "Controller connected" : "No controller: connect one and press a button")
  },
})

const PendingKeys = defineComponent({
  setup() {
    return () => (pendingHotkey.value.length ? `${pendingHotkey.value.join(" ")}…` : "")
  },
})

const SaveKeys = defineComponent({
  emits: ["fired"],
  setup(_, { emit }) {
    useHotkeys([{ key: "s", code: "KeyS", ctrl: true, help: { group: "Editor", label: "Save" }, handler: () => emit("fired", "Save") }])
    return () => null
  },
})

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
const bottomTabItems = [
  { value: "home", label: "Home", icon: "lucide:house" },
  { value: "inbox", label: "Inbox", icon: "lucide:inbox", dot: true },
  { value: "search", label: "Search", icon: "lucide:search" },
  { value: "settings", label: "Settings", icon: "lucide:settings" },
]

export const registry: ComponentEntry[] = [
  {
    id: "button",
    name: "Button",
    description:
      "Variants, sizes (xs–lg), block, square (icon-only), glow, and `as` (render as a link). `action` runs the work the click starts: the button shows its spinner until it settles and a failure becomes an error toast (or the `error` event, if the app listens). `hotkey` binds a key that presses the button: it shows in the tooltip and the key reference (F1), works on non-Latin layouts, and feeds `hotkeyTip()` for people who keep clicking instead.",
    components: { LpButton },
    state: () =>
      reactive({
        saved: 0,
        save: () => new Promise((resolve) => setTimeout(resolve, 1200)),
        fail: () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(Object.assign(new Error("Server said no"), { details: "PUT /api/demo -> 500\nrequest_id: 9c1d" })), 900),
          ),
      }),
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
  <div class="flex flex-wrap items-center gap-2">
    <LpButton :action="save" hotkey="Ctrl+S" @done="saved++">Save</LpButton>
    <LpButton variant="danger" :action="fail">Fails</LpButton>
    <span class="text-xs text-muted">Saved {{ saved }} times · Ctrl+S presses Save</span>
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
      "Free-text field that suggests as you type but never forces a choice — the typed text is the model. Unlike Select, you can submit a value that isn't in the list. Supports client filtering, server-side suggestions, and the same pattern/restrict as Input. Options can carry an image; `selected` shows what an id-like value stands for (picture, name, muted hint) inside the field instead of the raw value.",
    components: { LpAutocomplete },
    state: () => {
      const people = [
        { value: "1090027634693525664", label: "Sunny", description: "@sunnyxoo.", image: avatarSunny },
        { value: "770091071811092481", label: "THÉROËR", description: "@theroer", image: avatarSample },
      ]
      return reactive({
        value: "",
        frameworks: ["Vue", "React", "Svelte", "Solid", "Angular", "Qwik", "Preact"],
        person: people[0]!.value,
        people,
        get picked() {
          const p = people.find((o) => o.value === this.person)
          return p ? { label: p.label, hint: p.description, image: p.image } : null
        },
      })
    },
    template: `<div class="flex w-72 flex-col gap-3">
  <LpAutocomplete
    v-model="value"
    :options="frameworks"
    icon="lucide:search"
    clearable
    placeholder="Type a framework…"
  />
  <p class="text-xs text-muted">Value: {{ value || "—" }} (free text, not limited to the list)</p>
  <LpAutocomplete
    v-model="person"
    :options="people"
    :selected="picked"
    icon="lucide:search"
    :min-chars="0"
    clearable
    placeholder="Name or ID"
  />
  <p class="text-xs text-muted">The model is an id; the field shows who it is. Focus to search again by name.</p>
</div>`,
  },
  {
    id: "select",
    name: "Select",
    description:
      "Searchable / multiple select on reka-ui. Option values may be string OR number; options can carry an `image` or `icon` and be `disabled`. The trigger shows the pick with its picture and a muted hint; `multiple` shows chips that collapse to \"+N\" when the row is full, and `@change` carries the value just toggled. Server-side search via v-model:searchTerm + :loading: a pick stays named after it drops out of the results (remembered for the session, or told through `selected`). Placeholder and list texts come from the `select` labels.",
    components: { LpSelect },
    state: () => reactive({
      people: [
        { value: "1090027634693525664", label: "Sunny", description: "@sunnyxoo.", image: avatarSunny },
        { value: "770091071811092481", label: "THÉROËR", description: "@theroer", image: avatarSample },
        { value: "3", label: "Ada", description: "@ada", icon: "lucide:user" },
        { value: "4", label: "Grace", description: "@grace", icon: "lucide:user" },
        { value: "5", label: "Linus", description: "@linus", icon: "lucide:user", disabled: true },
      ],
      person: "1090027634693525664",
      team: ["1090027634693525664", "770091071811092481", "3"],
      toggled: "",
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
      get remoteOptions() {
        const q = this.remoteTerm.trim().toLowerCase()
        return q ? selectOpts.filter((o) => o.label.toLowerCase().includes(q)) : selectOpts
      },
    }),
    template: `<div class="flex w-72 flex-col gap-3">
  <LpSelect v-model="person" :options="people" searchable />
  <LpSelect v-model="team" :options="people" multiple clearable @change="toggled = $event" />
  <p class="text-xs text-muted">last toggled: {{ toggled || "\u2014" }}</p>
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
  <p class="text-xs text-muted">searchTerm: "{{ remoteTerm }}" (pick, then search for something else: the pick keeps its name)</p>
</div>`,
  },
  {
    id: "switch",
    name: "Switch · Checkbox · Radio",
    description:
      "Boolean and choice controls. LpSwitch and LpCheckbox take a `label` (LpSwitch also a `description`, and `label-position=\"start\"` for a settings row with the switch at the right edge). LpRadioGroup takes `:options` (each may carry a `description` line, an `icon`, or be `disabled`), or LpRadio children when a row needs custom content.",
    components: { LpSwitch, LpCheckbox, LpRadioGroup, LpRadio },
    state: () => reactive({
      on: true,
      checked: true,
      notify: false,
      plan: "pro",
      tier: "pro",
      radioOpts,
      billing: "monthly",
      billingOpts: [
        { value: "monthly", label: "Monthly", description: "Billed every month, cancel any time." },
        { value: "yearly", label: "Yearly", description: "Two months free." },
        { value: "lifetime", label: "Lifetime", description: "Sold out.", disabled: true },
      ],
    }),
    template: `<div class="flex flex-col gap-6">
  <div class="flex flex-wrap items-start gap-8">
    <LpSwitch v-model="on" />
    <LpSwitch v-model="on" label="Dark mode" />
    <LpCheckbox v-model="checked" label="Remember me" />
    <LpRadioGroup v-model="plan" :options="radioOpts" />
    <LpRadioGroup v-model="billing" :options="billingOpts" class="max-w-56" />
  </div>

  <!-- Settings row: text on the left, switch at the right edge. -->
  <LpSwitch
    v-model="notify"
    label-position="start"
    label="Email notifications"
    description="A digest of new comments, once a day."
    class="max-w-sm"
  />

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
    description:
      "Surface container in raised / flat / ghost. Pass `menuItems` for a right-click menu. `accent` draws a stripe down the leading edge in ANY CSS colour — for a value that arrives from data (a Discord role colour, a per-project hex) rather than from the palette; it costs no layout, so accented and plain cards line their content up.",
    components: { LpCard },
    state: () =>
      reactive({
        cardMenu: [
          { label: "Rename", icon: "lucide:pencil" },
          { label: "Duplicate", icon: "lucide:copy" },
          { label: "Delete", icon: "lucide:trash-2", danger: true, separatorBefore: true },
        ],
      }),
    template: `<div class="flex flex-col gap-3">
  <div class="grid w-full grid-cols-3 gap-3">
    <LpCard>Raised</LpCard>
    <LpCard variant="flat">Flat</LpCard>
    <LpCard variant="flat" interactive :menu-items="cardMenu">Right-click me</LpCard>
  </div>
  <div class="grid w-full grid-cols-3 gap-3">
    <LpCard accent="#5865F2">accent="#5865F2"</LpCard>
    <LpCard accent="var(--color-action)">accent="var(--color-action)"</LpCard>
    <LpCard accent="#eb459e" accent-width="6px" interactive>accent-width="6px"</LpCard>
  </div>
</div>`,
  },
  {
    id: "tabs",
    name: "Tabs",
    description:
      "Sliding indicator + animated panels. variant=\"plain\" drops the bar chrome for nav rows. A row wider than its container scrolls sideways and keeps the active tab in view (the narrow box below). variant=\"bottom\" is a phone's bottom navigation — equal-share tabs, icon over label, a sliding bar along the top edge and safe-area padding; an item's `dot` flags a tab that wants a look, and `label` names the tab list. By default the marker glides under the hovered tab; `:hover-follow=\"false\"` (the row under the full-width one) pins it to the selected one for a dense header the pointer keeps crossing, and hover then only tints the tab. An item can carry a `badge` count (rolls when it changes), be `disabled` (skipped by arrows and hover), and take a right-click `menu` headed by its label. Without v-model the tabs pick the first enabled item when `items` arrive late or the current one disappears (the row with \"Reload items\").",
    components: { LpTabs, LpButton },
    state: () => {
      const loaded = () => [
        {
          value: "open",
          label: "Open",
          icon: "lucide:circle-dot",
          badge: 12,
          menu: [
            { label: "Mark all read", icon: "lucide:check-check" },
            { label: "Copy link", icon: "lucide:link", shortcut: "Ctrl+L" },
          ],
        },
        { value: "review", label: "In review", icon: "lucide:eye", badge: 3 },
        { value: "archived", label: "Archived", icon: "lucide:archive", disabled: true },
      ]
      const s = reactive({
        tab: "a",
        items: tabItems,
        nav: "home",
        navItems: bottomTabItems,
        late: [] as ReturnType<typeof loaded>,
        reload() {
          s.late = []
          setTimeout(() => (s.late = loaded()), 700)
        },
        bump() {
          const first = s.late[0]
          if (first) first.badge = (first.badge ?? 0) + 1
        },
      })
      s.reload()
      return s
    },
    template: `<div class="flex flex-col gap-3">
  <div class="flex flex-wrap items-center gap-2">
    <LpTabs :items="late" />
    <LpButton size="sm" variant="ghost" @click="reload">Reload items</LpButton>
    <LpButton size="sm" variant="ghost" @click="bump">+1 open</LpButton>
  </div>
  <LpTabs v-model="tab" :items="items" />
  <div class="w-[180px] rounded-control border border-dashed border-line p-2">
    <LpTabs v-model="tab" :items="items" />
  </div>
  <LpTabs v-model="tab" :items="items" block />
  <LpTabs v-model="tab" :items="items" :hover-follow="false" />
  <LpTabs v-model="tab" :items="items" variant="plain" />
  <LpTabs v-model="tab" :items="items" variant="plain" accent />
  <div class="flex h-48 w-[360px] max-w-full flex-col overflow-hidden rounded-card border border-line">
    <div class="flex-1 p-3 text-sm text-muted">Page: {{ nav }}</div>
    <LpTabs v-model="nav" :items="navItems" variant="bottom" accent label="Main" />
  </div>
</div>`,
  },
  {
    id: "sidebar",
    name: "Sidebar",
    description:
      "App-shell side navigation: icon + label items, labelled sections, badge counts, a sliding brand pill for the active item, a loading skeleton, and header/footer/actions slots (logo, user chip, logout). v-model binds the active id; pass isActive for router prefix-matching. Items can carry a `menu` for a right-click context menu, headed by the item's label and icon (`menuTitle` overrides, \"\" drops it). `hoverFollow` makes the pill glide under the hovered item as in Tabs; it is off by default, since a tall nav the pointer keeps crossing would flicker (on in the panel example). The loading skeleton is an LpSkeleton layout. Set `responsive` + v-model:open to swap the rail for a swipe-to-close drawer on phones (the burger button below opens it). `variant=\"panel\"` boxes it as a card for a nav that sits inside a page (a settings index, a table picker) rather than along the shell edge. `searchable` puts a filter above the items — matching label and any `keywords`, dropping sections that match nothing, and opening folded groups while a query is on (try `invoice`). Mirrors the cabinet/profile sidebars in the apps. An item with `to` renders the configured link component (\"Button docs\" in the panel example navigates through the preview's router).",
    components: { LpSidebar, LpAvatar, LpBadge, LpButton, LpIcon, LpSwitch },
    state: () =>
      reactive({
        active: "overview",
        section: "server",
        loading: false,
        open: false,
        pageSections: [
          {
            items: [
              { id: "server", label: "Server", icon: "lucide:server", badge: 2 },
              { id: "logs", label: "Logs", icon: "lucide:scroll-text" },
              { id: "economy", label: "Economy", icon: "lucide:coins", badge: 5 },
              { id: "docs", label: "Button docs", icon: "lucide:book-open", to: "/component/button" },
            ],
          },
        ],
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
              { id: "billing", label: "Billing", icon: "lucide:credit-card", keywords: ["invoice", "payment"] },
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
      searchable
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

  <!-- variant="panel": the same nav inside a page, boxed on all four sides and
       rounded, sitting next to the content it drives. -->
  <div class="flex h-64 gap-4">
    <LpSidebar v-model="section" variant="panel" width="14rem" :sections="pageSections" hover-follow class="shrink-0" />
    <div class="flex-1 rounded-card border border-line bg-surface-soft p-4 text-sm text-muted">
      Settings for <span class="text-ink">{{ section }}</span>
    </div>
  </div>
</div>`,
  },
  {
    id: "segmented",
    name: "Segmented",
    description:
      "Compact mutually-exclusive control with a sliding pill (reka ToggleGroup). For short option sets where Tabs is too heavy — view/density toggles. icon and/or label per option, a `dot` to ask for attention, `disabled` per option; block stretches it full-width; size sm, md or lg. The pill follows the hovered segment and springs back (`:hover-follow=\"false\"` pins it); a mouse pick hands the arrow keys back to the page.",
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
        inboxOpts: [
          { value: "all", label: "All" },
          { value: "unread", label: "Unread", dot: true },
          { value: "archived", label: "Archived", disabled: true },
        ],
        inbox: "all",
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
  <LpSegmented v-model="inbox" :options="inboxOpts" size="lg" />
  <LpSegmented v-model="inbox" :options="inboxOpts" :hover-follow="false" />
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
    template: `<div class="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
  <LpStat online label="Servers online" value="43" hint="Responding now." />
  <LpStat label="Revenue" value="€8,420" :delta="12.4" delta-suffix="%" hint="vs last week" />
  <LpStat label="Avg latency" value="48 ms" :delta="-6" invert-trend hint="lower is better" />
  <LpStat label="Signups" value="312" delta="+18%" />
</div>`,
  },
  {
    id: "avatar",
    name: "Avatar",
    description: "User image with initials fallback, three sizes. `shape` switches between people (circle) and things (soft/square); `ring` adds a hairline. `icon` replaces the initials for things with no name worth abbreviating. Pass `menuItems` for a right-click account menu, headed by `alt` and the picture (`menuTitle`/`menuSubtitle` override). The avatar is wrapped the same way with or without items, so a menu that arrives after the first render does not remount it (the one marked \"late menu\").",
    components: { LpAvatar },
    state: () => {
      const s = reactive({
        avatarSample,
        accountMenu: [
          { label: "View profile", icon: "lucide:user" },
          { label: "Account settings", icon: "lucide:settings" },
          { label: "Sign out", icon: "lucide:log-out", danger: true, separatorBefore: true },
        ],
        lateMenu: [] as object[],
        loadMenu() {
          if (s.lateMenu.length) return
          setTimeout(() => (s.lateMenu = s.accountMenu), 600)
        },
      })
      return s
    },
    template: `<div class="flex flex-wrap items-center gap-3">
  <LpAvatar size="sm" :src="avatarSample" alt="THEROER" />
  <LpAvatar size="md" :src="avatarSample" alt="THEROER" />
  <LpAvatar size="lg" :src="avatarSample" alt="THEROER" ring />
  <LpAvatar size="md" :src="avatarSample" alt="THEROER" shape="soft" />
  <LpAvatar size="md" :src="avatarSample" alt="THEROER" shape="square" />
  <!-- No src: the initials carry it. -->
  <LpAvatar size="md" fallback="LP" />
  <LpAvatar size="md" icon="lucide:globe" shape="soft" />
  <LpAvatar size="lg" alt="System Admin" :menu-items="accountMenu" menu-subtitle="admin@leavepulse.io" />
  <LpAvatar size="lg" :src="avatarSample" alt="THEROER" :menu-items="lateMenu" @mouseenter="loadMenu" />
  <span class="text-sm text-muted">right-click the last two (the last: late menu, loaded on hover) →</span>
</div>`,
  },
  {
    id: "progress",
    name: "Progress",
    description:
      "One value as a bar or a ring — same data, same tones. `variant=\"ring\"` for KPI dials, where a percentage should read at a glance.",
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
  },
  {
    id: "pie",
    name: "Pie / Donut",
    description:
      "Shares of a whole. Takes any number of slices: the tail folds into \"Other\" (which keeps its total and a count) so twenty categories stay readable without losing data. Hover lifts a slice; click pins a selection — Ctrl toggles, Shift takes a range, dragging across gathers, right-click opens a menu. The legend works from the keyboard, and `data-table` (on Services) adds a visually hidden table for screen readers.",
    components: { LpPie },
    state: () =>
      reactive({
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
  <div class="flex flex-wrap gap-10 max-sm:justify-center">
    <LpPie
      :slices="disk"
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
  },
  {
    id: "sparkline",
    name: "Sparkline",
    description:
      "A trend with no axes — sized for a table cell or a stat tile. Measures nothing and holds no state, so a page can carry dozens.",
    components: { LpSparkline, LpStat, LpBadge },
    state: () =>
      reactive({
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
  <!-- In a stat tile: the delta says how much, the shape says how. -->
  <div class="flex flex-wrap gap-10 max-sm:justify-center">
    <LpStat label="Revenue" :value="61200" prefix="€" compact :delta="12.5" delta-suffix="%">
      <template #trend>
        <LpSparkline :data="revenue" area show-last :width="96" />
      </template>
    </LpStat>
    <LpStat label="Errors" value="0" :delta="-100" delta-suffix="%" invert-trend>
      <template #trend>
        <LpSparkline :data="errors" tone="danger" :width="96" />
      </template>
    </LpStat>
  </div>

  <!-- In a list: one row per machine, the trend inline with the number. -->
  <div class="flex flex-col divide-y divide-line rounded-card border border-line">
    <div v-for="h in hosts" :key="h.name" class="flex items-center gap-4 px-4 py-2.5">
      <span class="w-24 shrink-0 truncate sm:w-32 font-mono text-sm text-ink">{{ h.name }}</span>
      <span class="w-14 shrink-0 text-right font-mono text-sm tabular-nums text-muted-strong">{{ h.now }}</span>
      <LpSparkline :data="h.load" :tone="h.tone" show-last />
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
    id: "chart",
    name: "Chart",
    description:
      "Line, area and bar off one data shape. Hover snaps a crosshair to the nearest point and reads every series at once; the legend toggles series. `thresholds` draws reference lines or bands (`to`), `markers` pins events to an x position. The plot is keyboard reachable (arrows, Home, End, Enter), reads out a generated summary, and `data-table` adds a visually hidden table of the values.",
    components: { LpChart, LpButton },
    state: () =>
      reactive({
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
  <LpChart
    type="area"
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
    :series="latency"
    :labels="months"
    title="Response time"
    unit=" ms"
    show-points
    :height="200"
  />

  <LpChart
    type="bar"
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
  },
  {
    id: "stepper",
    name: "Stepper",
    description: "Multi-step progress indicator. `current` takes an index or a step key; pass `completed` when a flow finishes steps out of order. Moving on fills the connector and turns the number into a tick.",
    components: { LpStepper, LpButton },
    state: () =>
      reactive({
        step: 1,
        steps: [
          { key: "account", label: "Account" },
          { key: "profile", label: "Profile", icon: "lucide:user" },
          { key: "done", label: "Done" },
        ],
      }),
    template: `<div class="flex w-full flex-col gap-6">
  <LpStepper :steps="steps" :current="step" />
  <div class="flex gap-2">
    <LpButton size="sm" variant="outline" :disabled="step === 0" @click="step--">Back</LpButton>
    <LpButton size="sm" :disabled="step === steps.length" @click="step++">Next</LpButton>
  </div>
  <LpStepper :steps="steps" current="profile" :completed="['account', 'done']" />
</div>`,
  },
  {
    id: "breadcrumbs",
    name: "Breadcrumbs",
    description:
      "Hierarchical navigation trail, an ordered list with the last crumb marked as the current page. A crumb with `to` (or an app-relative `href`) renders the link component from `provideLpConfig`, so it navigates client-side: here that is the preview's own router, standing in for RouterLink or NuxtLink.",
    components: { LpBreadcrumbs },
    state: () =>
      reactive({
        items: [{ label: "Home", href: "#" }, { label: "Servers", href: "#" }, { label: "ger-01-p" }],
        routed: [{ label: "Components", to: "/" }, { label: "Button", to: "/component/button" }, { label: "Breadcrumbs" }],
      }),
    template: `<div class="flex flex-col gap-3">
  <LpBreadcrumbs :items="items" />
  <LpBreadcrumbs :items="routed" />
</div>`,
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
    id: "input-mask",
    name: "Input mask",
    description:
      "`mask` on LpInput formats as you type and keeps the caret where it was: `0` is a digit, `a` a letter, `A` a letter shown upper-case, `*` either, and a backslash makes the next character literal. A list picks the first mask the value fits, a function derives it from what was typed so far, and `mask-tokens` adds your own. Backspace skips over separators. v-model holds the formatted text; `@update:raw` the characters alone. The same engine is `useInputMask()` for your own input. The phone here picks its mask from the country code typed so far (+380, +1, +7, anything else grouped by three); for a full international field with a country list, use LpPhoneInput.",
    components: { LpInput },
    state: () => reactive({ phone: "", card: "", hex: "", raw: "" }),
    template: `<div class="flex w-80 flex-col gap-4">
  <LpInput
    v-model="phone"
    label="Phone"
    :mask="(raw) => raw.startsWith('380') ? '+000 (00) 000-00-00' : raw.startsWith('1') ? '+0 (000) 000-0000' : raw.startsWith('7') ? '+0 (000) 000-00-00' : '+000 000 000 0000'"
    inputmode="tel"
    placeholder="+380 (50) 123-45-67"
    @update:raw="raw = $event"
  />
  <LpInput v-model="card" label="Card" :mask="(raw) => /^3[47]/.test(raw) ? '0000 000000 00000' : '0000 0000 0000 0000'" inputmode="numeric" placeholder="4111 1111 1111 1111" />
  <LpInput v-model="hex" label="Colour" mask="#HHHHHH" :mask-tokens="{ H: /[0-9a-f]/i }" placeholder="#3b82f6" />
  <p class="text-xs text-muted">Phone raw: {{ raw || "\u2014" }}</p>
</div>`,
  },
  {
    id: "tags-input",
    name: "TagsInput",
    description:
      "Free-form list of short values. A comma, a newline or Enter turns the text into a tag, a paste of several is split, Backspace in an empty field selects the last tag and removes it on the next press, and the arrow keys walk the tags. A tag refused by `validate`, `max` or the duplicate policy (`reject` keeps it typed, `ignore` drops it, `allow` keeps the repeat) gets a note that floats under the field without moving anything below, and the tag it repeats pulses. Works inside LpFormField like any kit control. `display` draws a tag as what it stands for (picture, name, muted hint) while the model keeps the values; `options` suggest while typing (↑/↓ walk them, Enter picks; Enter without walking still adds the typed text), `loading` and `@search` fetch them server-side. `size` is sm, md or lg.",
    components: { LpTagsInput, LpFormField },
    state: () => {
      const people = [
        { value: "1090027634693525664", label: "Sunny", description: "@sunnyxoo.", image: avatarSunny },
        { value: "770091071811092481", label: "THÉROËR", description: "@theroer", image: avatarSample },
      ]
      return reactive({
        emails: ["ada@example.com"],
        labels: [] as string[],
        ids: ["770091071811092481"],
        people,
        who: (tag: string) => {
          const p = people.find((o) => o.value === tag)
          return p ? { label: p.label, hint: p.description, image: p.image } : null
        },
      })
    },
    template: `<div class="flex w-96 flex-col gap-4">
  <LpTagsInput
    v-model="emails"
    label="Invite"
    hint="Up to 5 addresses; paste a list to add many"
    placeholder="name@example.com"
    :max="5"
    :normalize="(t) => t.toLowerCase()"
    :validate="(t) => /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(t) ? undefined : t + ' is not an email address'"
  />
  <LpFormField label="Labels" hint="A repeat is dropped with a passing note">
    <LpTagsInput v-model="labels" duplicates="ignore" placeholder="Add a label" size="sm" />
  </LpFormField>
  <LpFormField label="Moderators" hint="Type a name or paste an id">
    <LpTagsInput v-model="ids" :options="people" :display="who" placeholder="Name or ID" />
  </LpFormField>
</div>`,
  },
  {
    id: "use-form",
    name: "useForm",
    description:
      "Form state without the boilerplate: values, touched, `dirty` against what was loaded, sync and async rules per field plus form-level checks, server errors through `setErrors`, and `handleSubmit`, which touches every field, validates and refuses to run twice. Errors show once a field was blurred or a submit was tried. `form.field(name)` returns the props a kit control needs, and `dirty` plugs straight into useFormDraft.",
    components: { LpInput, LpTagsInput, LpButton, LpBadge },
    state: () => {
      const taken = ["admin", "root"]
      const form = useForm({
        initial: { name: "", username: "", tags: [] as string[] },
        rules: {
          name: (v: string) => (v.trim() ? undefined : "Enter a name"),
          username: async (v: string) => {
            if (!v) return "Pick a username"
            await new Promise((r) => setTimeout(r, 300))
            return taken.includes(v) ? "That username is taken" : undefined
          },
        },
        validate: (v) => (v.tags.length > 3 ? { tags: "At most three tags" } : undefined),
      })
      const s: any = reactive({ form, saved: "" })
      s.submit = form.handleSubmit(async (values) => {
        await new Promise((r) => setTimeout(r, 600))
        s.saved = JSON.stringify(values)
      })
      return s
    },
    template: `<form class="flex w-80 flex-col gap-4" novalidate @submit="submit">
  <LpInput v-bind="form.field('name')" label="Name" />
  <LpInput v-bind="form.field('username')" label="Username" hint="Try admin" />
  <LpTagsInput v-bind="form.field('tags')" label="Tags" placeholder="Add a tag" />
  <div class="flex items-center gap-2">
    <LpButton type="submit" :loading="form.submitting">Save</LpButton>
    <LpButton type="button" variant="ghost" :disabled="!form.dirty" @click="form.reset()">Reset</LpButton>
    <LpBadge :tone="form.dirty ? 'warning' : 'neutral'">{{ form.dirty ? "Unsaved" : "Saved" }}</LpBadge>
  </div>
  <p v-if="saved" class="text-xs text-muted">Submitted {{ saved }}</p>
</form>`,
  },
  {
    id: "phone",
    name: "PhoneInput",
    description:
      "Phone field with a country picker (flag + dial code). Numbers are formatted as you type (+380 50 123 4567, +1 555 123 4567, +33 1 23 45 67 89) and the flag follows the code you type. Digits past the longest number the country allows are dropped with a note under the field, and a number that cannot be right is marked when you leave the field, with the reason. v-model is the formatted text; @change carries { country, dialCode, number, e164, possible, valid } — store `e164`. The formatter (libphonenumber-js) loads with the first phone field. With no placeholder the field shows an example number for its country.",
    components: { LpPhoneInput, LpFormField },
    state: () => reactive({ value: "", work: "", detail: null as null | { e164: string; valid: boolean; possible: boolean; country?: { name: string } } }),
    template: `<div class="flex w-80 flex-col gap-4">
  <div>
    <LpFormField label="Phone" hint="Type, paste or pick a country">
      <LpPhoneInput v-model="value" default-country="UA" @change="detail = $event" />
    </LpFormField>
    <p class="mt-2 text-xs text-muted">Shown: {{ value || "\u2014" }}</p>
    <p v-if="detail" class="text-xs text-muted">
      {{ detail.country ? detail.country.name : "unknown" }} · e164 {{ detail.e164 || "\u2014" }} ·
      <span :class="detail.valid ? 'text-action' : ''">{{ detail.valid ? "valid" : detail.possible ? "possible" : "incomplete" }}</span>
    </p>
  </div>
  <LpFormField label="Work phone" hint="Inside a field the notes float over the hint">
    <LpPhoneInput v-model="work" default-country="US" />
  </LpFormField>
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
      "One-time-code (TOTP / 2FA) input — a row of cells with auto-advance, backspace (a phone's on-screen one too), and full-code paste. v-model is the joined string; @complete fires it once every cell is filled. Digits-only by default; `length`, `mask`, `alphanumeric`, `invalid`. Alphanumeric codes are capitalised as typed and open a phone's keyboard in capitals (`:uppercase=\"false\"` for a case-sensitive code); `group` draws a separator every N cells. The cells shrink with a narrow container instead of overflowing it (the 300px box).",
    components: { LpOtpInput },
    state: () => reactive({ code: "", done: "", backup: "" }),
    template: `<div class="flex flex-col gap-3">
  <LpOtpInput v-model="code" :group="3" @complete="done = $event" />
  <p class="text-xs text-muted">Code: {{ code || "—" }}</p>
  <p v-if="done" class="text-xs text-action">Completed: {{ done }}</p>
  <div class="w-[300px] rounded-control border border-dashed border-line p-2">
    <LpOtpInput v-model="backup" :length="8" :group="4" alphanumeric />
  </div>
  <p class="text-xs text-muted">Backup code: {{ backup || "—" }}</p>
</div>`,
  },
  {
    id: "colorpicker",
    name: "ColorPicker",
    description:
      "Colour field + popover: a saturation/brightness area over a hue rail, an optional alpha rail, a hex/CSS text field and preset swatches. v-model is a CSS colour STRING — `format` picks hex/rgb/hsl on the way out, and all three are parsed on the way in. @change fires on release (commit-vs-preview), and the area and rails are arrow-key operable. Right-click either the field or the panel to copy as hex/rgb/hsl, switch which format it shows via `Show as`, or paste a colour in — pasting takes hex, rgb() and hsl() in any CSS form, plus loose shapes like `255 0 0` or `rgb 17 34 51`; `recent` remembers what you settle on and offers it back above the presets. Every string it renders — menu items, the Recent heading, the accessible names on the area and rails — goes through `labels` for i18n.",
    components: { LpColorPicker },
    state: () => reactive({ brand: "#3b82f6", tint: "rgba(236, 72, 153, 0.6)" }),
    template: `<div class="flex flex-col gap-4">
  <div class="w-56">
    <LpColorPicker v-model="brand" recent />
    <p class="mt-2 text-xs text-muted">value: {{ brand }} — right-click to copy</p>
  </div>
  <div class="w-56">
    <LpColorPicker v-model="tint" alpha format="rgb" />
    <p class="mt-2 text-xs text-muted">with alpha: {{ tint }}</p>
  </div>
  <div class="flex items-center gap-3">
    <span class="size-10 rounded-card border border-line" :style="{ backgroundColor: brand }" />
    <span class="size-10 rounded-card border border-line" :style="{ backgroundColor: tint }" />
    <span class="text-xs text-muted">live preview</span>
  </div>
</div>`,
  },
  {
    id: "dropdown",
    name: "DropdownMenu",
    description: "Action menu with icons and danger items. Its items are ContextMenu items drawn by the same renderer, so one array serves a row's \"…\" button and its right click alike: submenus (`children`), tick-box items (`checked`, the menu stays open) and shortcut hints (LpKeys: \"Ctrl+D\" reads ⌘D on a Mac) all show in both. `title`/`subtitle`/`titleIcon` head the menu with what it acts on. `rightClickToo` marks a \"…\" button whose items the row also opens on right-click: each use of it counts toward contextMenuTip(), which then tells the user that right-click works there.",
    components: { LpDropdownMenu, LpButton, LpContextMenu },
    state: () => reactive({
      items: [
        { label: "Edit", icon: "lucide:pencil", shortcut: "Ctrl+E" },
        { label: "Duplicate", icon: "lucide:copy", shortcut: "Ctrl+D" },
        {
          label: "Move to",
          icon: "lucide:folder-input",
          children: [
            { label: "Archive", icon: "lucide:archive" },
            { label: "Shared", icon: "lucide:users" },
          ],
        },
        { label: "Delete", icon: "lucide:trash-2", shortcut: "Del", danger: true, separatorBefore: true },
      ],
      pinned: true,
      // A tick-box item on top of the shared ones: it stays open on select.
      get rowItems(): object[] {
        return [
          { label: "Pinned", checked: this.pinned, onSelect: () => (this.pinned = !this.pinned) },
          ...this.items,
        ]
      },
    }),
    template: `<div class="flex flex-col items-start gap-4">
  <LpDropdownMenu :items="items" title="Quarterly report.pdf" subtitle="2.4 MB" title-icon="lucide:file-text">
    <template #trigger><LpButton variant="outline">Actions ▾</LpButton></template>
  </LpDropdownMenu>
  <LpContextMenu :items="rowItems" title="Row">
    <div class="flex w-72 items-center justify-between rounded-control border border-line px-3 py-2 text-sm">
      <span>Row (right-click works too)</span>
      <LpDropdownMenu :items="rowItems" title="Row" right-click-too>
        <template #trigger><LpButton size="sm" variant="ghost" aria-label="Row actions">…</LpButton></template>
      </LpDropdownMenu>
    </div>
  </LpContextMenu>
</div>`,
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
    state: () => reactive({ date: "2026-06-18", picked: "", moment: "" }),
    template: `<div class="flex flex-wrap items-start gap-6">
  <LpCalendar v-model="date" min="2026-06-01" />
  <div class="flex w-64 flex-col gap-2">
    <LpDatePicker v-model="picked" clearable placeholder="Select a date" />
    <p class="text-xs text-muted">ISO value: {{ picked || "—" }}</p>
    <LpDatePicker v-model="moment" time clearable placeholder="Date and time" />
    <p class="text-xs text-muted">with time: {{ moment || "—" }}</p>
  </div>
</div>`,
  },
  {
    id: "date-range",
    name: "DateRangePicker",
    description:
      "Range field + popover (reka RangeCalendar). Model is `{ start, end }` of ISO days, both inclusive; presets on the side (Today, Last 7/30 days, this and last month, or your own `{ label, range }`), two months where there is room and one on a phone. A preset outside min/max is clipped to it, or disabled when nothing of it is left. Like selecting text on a phone, a range can be pressed out by dragging across the days (a finger holds for a moment first, so a swipe still scrolls), and either end of a finished range can be grabbed and pulled; Shift+arrows move the focused end. The popover stays open after a pick, so the ends can still be adjusted before clicking away.",
    components: { LpDateRangePicker, LpRangeCalendar, LpFormField },
    state: () => reactive({ range: undefined, inline: { start: "2026-06-08", end: "2026-06-14" } }),
    template: `<div class="flex flex-wrap items-start gap-6">
  <div class="flex w-72 flex-col gap-2">
    <LpFormField label="Report period" hint="Inclusive on both ends">
      <LpDateRangePicker v-model="range" clearable />
    </LpFormField>
    <p class="text-xs text-muted">value: {{ range ? range.start + " .. " + range.end : "none" }}</p>
  </div>
  <LpRangeCalendar v-model="inline" />
</div>`,
  },
  {
    id: "commandpalette",
    name: "CommandPalette",
    description:
      "⌘K command palette (reka Dialog + Listbox): grouped, searchable commands with icons (or an `image`: a picture in the icon's slot that falls back to initials or the icon when it fails), shortcut hints and keyboard nav. Matches label + keywords. Binds a global ⌘K/Ctrl-K toggle by default. A command with `children` opens a mode — a nested list, static or fetched from the query typed inside it (Backspace or the chip leaves it), or typed straight into with its `prefix` (try \"> web\"); `search` adds results from an API alongside the static ones (it is sent the positive words only, the parsed `-word` and `in:group` operators come as a third argument, and the palette still drops fetched rows they rule out: try \"deploy -secrets\"), and a hit can carry an `excerpt` (the matched passage, wrapped over `excerptLines` lines) plus `highlight` (word forms the server matched, marked alongside the typed query); `previewPane` shows the highlighted hit's `preview` in full beside the list, and folds away for rows that `hasPreview` (or the row's own `noPreview`) turns down; `href` makes a row a real link; Tab lists a row's `actions`; `groupLimit` folds long groups; a `fallback` row (\"Search the catalogue for ...\") shows only while something is typed, labelled with the typed words, and with `carryQuery` its mode opens already searching them; words match in any order, with a typo or the other keyboard layout; `recent` floats what this person actually runs to the top, including picks made inside a mode or among search results (`remember` hands over what to store, `resolveRecent` rebuilds a fetched result from its `recentData`).",
    components: { LpCommandPalette, LpButton, LpPalettePreview, LpPaletteHeader, LpPaletteFacts, LpPaletteStats, LpKeys },
    state: () => {
      const s: any = reactive({
        open: false,
        recent: ["metrics"],
        commands: [
          { id: "new", label: "New server", description: "Provision a fresh node", icon: "lucide:plus", shortcut: "⌘N", group: "Actions", keywords: ["create", "add"] },
          { id: "deploy", label: "Deploy current branch", description: "Roll out to production", icon: "lucide:rocket", group: "Actions", keywords: ["ship", "release"] },
          {
            id: "restart",
            label: "Restart service…",
            description: "Pick one of the running services",
            icon: "lucide:refresh-cw",
            group: "Actions",
            childPlaceholder: "Which service?",
            // Typing ">" at the start of the box opens this list directly,
            // and "> wor" lands in it already filtered to worker.
            prefix: ">",
            children: [
              { id: "restart:api", label: "api", icon: "lucide:server" },
              { id: "restart:worker", label: "worker", icon: "lucide:server" },
              { id: "restart:web", label: "web", icon: "lucide:server" },
            ],
          },
          // Listed only while something is typed, for any words, at the end
          // of the list: Enter opens the catalogue already searching them.
          {
            id: "catalogue",
            label: 'Search the package catalogue for "{query}"',
            modeLabel: "Packages",
            icon: "lucide:package-search",
            group: "Elsewhere",
            fallback: true,
            carryQuery: true,
            childPlaceholder: "Search packages…",
            children: async (q: string, signal: AbortSignal) => {
              await new Promise((r) => setTimeout(r, 300))
              if (signal.aborted) return []
              const all = ["vue-router", "vitest", "vite-plugin-pwa", "pinia", "date-fns", "zod", "valibot", "unocss", "nuxt", "tanstack-query"]
              const text = q.toLowerCase()
              return all.filter((name) => name.includes(text)).map((name) => s.pkg(name))
            },
          },
          { id: "logs", label: "View logs", description: "Tail the live log stream", icon: "lucide:scroll-text", shortcut: "⌘L", group: "Navigate" },
          { id: "metrics", label: "Open metrics", icon: "lucide:activity", group: "Navigate" },
          { id: "theme", label: "Toggle theme", icon: "lucide:palette", group: "Preferences", keywords: ["dark", "light", "appearance"], keepOpen: true },
        ],
        // Stands in for an API: everything remote behaves like this from the
        // palette's side — a query in, commands out, late answers discarded.
        // It ignores its abort signal, as a Tauri invoke must: the palette
        // drops an answer that lands after the query moved on regardless.
        people: async (q: string) => {
          await new Promise((r) => setTimeout(r, 250))
          return ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson", "Edsger Dijkstra", "Barbara Liskov", "Donald Knuth"]
            .filter((n) => n.toLowerCase().includes(q.toLowerCase()))
            .map((n) => s.person(n))
        },
        // One builder for a fetched person, used by the search and again by
        // resolveRecent, which gets back the `recentData` stored with a pick.
        person: (n: string) => ({
          id: `user:${n}`,
          recentData: { name: n },
          label: n,
          description: "Open profile",
          icon: "lucide:user",
          // A picture in the icon's place. Some point nowhere, to show the
          // initials holding the slot when a picture fails.
          image: { src: n.length % 3 === 2 ? "/missing-avatar.png" : avatarSample, fallback: n.split(" ").map((w) => w[0]).join(""), shape: "circle" },
          group: "People",
          // Tab on a person lists these instead of opening the profile.
          actions: [
            { id: `user:${n}:message`, label: "Send a message", icon: "lucide:message-circle" },
            { id: `user:${n}:mention`, label: "Copy @mention", icon: "lucide:at-sign" },
          ],
        }),
        // A package fetched by the catalogue mode. `recentData` comes back to
        // resolveRecent, which is how a picked package returns under Recent.
        pkg: (name: string) => ({
          id: `pkg:${name}`,
          label: name,
          description: `${name.length * 1170} weekly downloads`,
          icon: "lucide:package",
          recentData: { pkg: name },
        }),
        resolveFetched: (entry: RecentEntry) => {
          const data = entry.data as { name?: string; pkg?: string } | undefined
          if (data?.name) return s.person(data.name)
          if (data?.pkg) return s.pkg(data.pkg)
          return null
        },
        // A docs search answers with the passage it matched, not just a title:
        // `excerpt` wraps over a few lines, `highlight` marks the word forms the
        // server matched ("deploys", "deployed") next to the typed query. Each
        // hit is a link (`href`), so Ctrl-click or Ctrl+Enter opens a new tab.
        docs: async (q: string) => {
          // Type "offline" to see a provider that throws.
          if (q.toLowerCase() === "offline") throw new Error("offline")
          const found = await s.people(q)
          const pages = [
            {
              id: "docs:rollback",
              href: "#rollback",
              label: "Rolling back a deploy",
              description: "Guides › Deploys",
              excerpt:
                "A rollback redeploys the previous release instead of reverting commits, so it takes seconds and needs no build. It is the first move when a deploy breaks production; fix forward once the incident is over. Rollbacks keep the database as it is: a release that ran a migration needs the migration's down step first.",
              highlight: ["deploy", "deploys", "deployed"],
              preview:
                "A rollback redeploys the previous release instead of reverting commits, so it takes seconds and needs no build. It is the first move when a deploy breaks production; fix forward once the incident is over.\n\nRollbacks keep the database as it is: a release that ran a migration needs the migration's down step first, or the old code meets a schema it does not know.\n\nTo roll back, open the service, pick the release under History and choose Redeploy. The previous build is kept for thirty days; older ones need a fresh build from their commit.",
            },
            {
              id: "docs:secrets",
              href: "#secrets",
              label: "Secrets",
              description: "Reference › Configuration",
              excerpt:
                "Secrets are injected at start, never baked into the image. Changing one restarts the services that read it; the rest keep running. A deployed secret is never shown again in the dashboard, only replaced.",
              highlight: ["deployed"],
              preview:
                "Secrets are injected at start, never baked into the image. Changing one restarts the services that read it; the rest keep running.\n\nA deployed secret is never shown again in the dashboard, only replaced. Keep the source of truth in your password manager, not in the dashboard.",
            },
          ]
          const text = q.toLowerCase()
          const docs = pages
            .filter((p) => [p.label, p.excerpt, ...p.highlight].some((t) => t.toLowerCase().includes(text)))
            .map((p) => ({ ...p, icon: "lucide:file-text", group: "Docs" }))
          return [...found, ...docs]
        },
        // Recency is the app's to keep — here in memory, in a real app in
        // storage. The palette hands over what to store with `remember`: a
        // bare id for a root command, an entry for a service picked inside
        // "Restart service" or a person a search found, so those come back
        // under Recent too.
        onRemember: (item: RecentItem) => {
          s.recent = pushRecent(s.recent, item, 5)
        },
      })
      return s
    },
    template: `<div>
  <LpButton variant="outline" @click="open = true">Open palette ( ⌘K )</LpButton>
  <LpCommandPalette
    v-model:open="open"
    :commands="commands"
    :search="docs"
    :recent="recent"
    :group-limit="3"
    preview-pane
    :has-preview="(c) => c.id.startsWith('user:') || !!c.preview"
    glass
    :resolve-recent="resolveFetched"
    @remember="onRemember"
  >
    <!-- People get a pane built from the preview blocks. Docs hits render
         nothing here, so the pane falls back to their own preview text;
         every other row folds the pane away (hasPreview). -->
    <template #preview="{ command, highlight }">
      <LpPalettePreview v-if="command.id.startsWith('user:')">
        <LpPaletteHeader eyebrow="Person" :title="highlight(command.label)" :image="command.image" subtitle="Engineering" />
        <LpPaletteStats :items="[{ label: 'Commits', value: 1280, compact: true }, { label: 'Reviews', value: 342 }]" />
        <LpPaletteFacts
          title="Now"
          :items="[
            { icon: 'lucide:map-pin', label: 'Office', value: 'Remote' },
            { icon: 'lucide:at-sign', label: 'Handle', value: command.label.split(' ')[0].toLowerCase(), mono: true },
          ]"
        />
        <LpKeys combo="Tab" label="message or mention" />
      </LpPalettePreview>
    </template>
  </LpCommandPalette>
</div>`,
  },
  {
    id: "palettepreview",
    name: "PalettePreview",
    description:
      "Blocks for CommandPalette's `#preview` slot, so an app's previews match the kit and each other without restyling the same eyebrow, title and rows. `LpPalettePreview` spaces its children and brings them in one after another; `LpPaletteHeader` is the eyebrow, title, subtitle and lead with a picture (falls back like Avatar) or an icon; `LpPaletteFacts` lists label and value rows with an icon or colour dot, `current` marking the one in effect; `LpPaletteStats` shows figures as tiles that count (NumberFlow) or roll (RollingText) when they change; `LpPaletteSwatches` shows a theme's colours on its own surface; `LpKeys` draws a combo as keycaps. Inside the palette, the slot's `highlight(text)` marks the typed words (positive terms only) and the blocks take its result wherever they take text. They work outside the palette too. Press the button to see values change in place.",
    components: { LpPalettePreview, LpPaletteHeader, LpPaletteFacts, LpPaletteStats, LpPaletteSwatches, LpKeys, LpButton, LpBadge },
    state: () => {
      const s: any = reactive({
        downloads: 1250000,
        follows: 8400,
        version: "2.4.1",
        enabled: true,
        bump: () => {
          s.downloads += 13500
          s.follows += 37
          s.version = s.version === "2.4.1" ? "2.5.0" : "2.4.1"
          s.enabled = !s.enabled
        },
      })
      return s
    },
    template: `<div class="flex flex-col gap-4">
  <div class="w-full max-w-sm rounded-card border border-line bg-surface-raised p-5">
    <LpPalettePreview>
      <LpPaletteHeader
        eyebrow="Modrinth"
        title="Sodium"
        subtitle="by CaffeineMC"
        :image="{ src: '/missing-icon.png', fallback: 'So' }"
        lead="A modern rendering engine that greatly improves frame rates and stutter."
      >
        <LpBadge tone="neutral">Optimization</LpBadge>
        <LpBadge :tone="enabled ? 'success' : 'warning'" dot>{{ enabled ? "Enabled" : "Disabled" }}</LpBadge>
      </LpPaletteHeader>
      <LpPaletteStats :items="[{ label: 'Downloads', value: downloads, compact: true }, { label: 'Follows', value: follows }]" />
      <LpPaletteFacts
        title="Details"
        :items="[
          { icon: 'lucide:tag', label: 'Latest', value: version, mono: true },
          { icon: 'lucide:box', label: 'Instance', value: 'Survival', current: true },
          { color: '#5865f2', label: 'Accent', value: '#5865F2', mono: true },
        ]"
      />
      <LpPaletteSwatches label="Onyx" background="#0b0d10" :colors="['#151a20', '#eef2f5', '#8a96a3', '#00bcff', '#39e58c', '#f0b35a']" />
      <LpKeys combo="Ctrl+Shift+M" label="from anywhere" />
      <LpKeys combo="G I" label="go to instances" size="sm" />
    </LpPalettePreview>
  </div>
  <LpButton variant="outline" class="w-fit" @click="bump">Change the values</LpButton>
</div>`,
  },
  {
    id: "contextmenu",
    name: "ContextMenu",
    description:
      "Right-click menu (reka ContextMenu): icons, shortcut hints (drawn with LpKeys, so \"Ctrl+C\" reads ⌘C on an Apple keyboard), danger items, separators and nested submenus, and an optional \`title\` heading naming what the menu acts on. Right-click (or long-press) the target. With an empty `items` it's a passthrough — the element keeps the browser's native menu — so wrappers like Table/Sidebar/Avatar/Card can pass [] to opt out per element. A left click on an element with a menu counts toward contextMenuTip(); `noHint` leaves an element out of that count (a whole table with only generic items), and table rows with their own menu are what the tip lights.",
    components: { LpContextMenu },
    state: () =>
      reactive({
        items: [
          { label: "Open", icon: "lucide:external-link", shortcut: "⏎" },
          { label: "Copy", icon: "lucide:copy", shortcut: "Ctrl+C" },
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
    template: `<LpContextMenu :items="items" title="api-gateway" subtitle="Production \u00b7 3 replicas" title-icon="lucide:server">
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
      "Icon button with an unread badge that opens a popover feed on left-click; right-click for quick actions (Mark all read; override via `menuItems`). Each feed row has its own right-click menu (mark read/unread, open, dismiss). Data-driven: bind items / unread-count and handle mark-read / mark-unread / mark-all-read / dismiss / select — no fetching inside. Rows are rounded tiles showing icon, title, body, relative time and an unread dot. `tone` per item tints the icon by category (billing, security, …) while it is unread; a read row always goes muted.",
    components: { LpNotificationBell },
    state: () => {
      const s = reactive({
        items: [
          {
            id: "1",
            title: "Payment received",
            body: "Your payment of €12.99 was received.",
            icon: "lucide:check-circle",
            tone: "action",
            createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
            read: false,
          },
          {
            id: "2",
            title: "Certificate expiring",
            body: "leavepulse.dev renews in 3 days.",
            icon: "lucide:shield-alert",
            tone: "danger",
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
        clear() {
          s.items = []
        },
      })
      return s
    },
    template: `<div class="flex items-center gap-4">
  <LpNotificationBell :items="items" @mark-read="markRead" @mark-unread="markUnread" @mark-all-read="markAllRead" @dismiss="dismiss" @clear="clear" />
  <span class="text-sm text-muted">← click to open · right-click on a row</span>
</div>`,
  },
  {
    id: "skeleton",
    name: "Skeleton",
    description:
      "Loading placeholders, in two shapes. Bare, it is one pulsing block sized by your classes. Given content it becomes a WRAPPER and lends its pulse to any `.lp-skeleton-item` inside, at any depth, so a skeleton can be the real markup with its content swapped for divs, keeping the same flex, gaps and responsive classes instead of being rebuilt as a stack of bars.",
    components: { LpSkeleton, LpCard, LpAvatar, LpButton },
    state: () => {
      const s = reactive({
        avatarSample,
        loading: true,
        reload() {
          s.loading = true
          // Long enough to watch the placeholder, short enough to keep toggling.
          setTimeout(() => { s.loading = false }, 1600)
        },
      })
      setTimeout(() => { s.loading = false }, 1200)
      return s
    },
    template: `<div class="flex w-80 flex-col gap-8">
  <!-- Bare: one block per placeholder. -->
  <div class="flex flex-col gap-2">
    <LpSkeleton class="h-10 w-10" rounded="pill" />
    <LpSkeleton class="h-4 w-full" />
    <LpSkeleton class="h-4 w-2/3" />
  </div>

  <!-- Wrapper: the layout IS the skeleton. Reload and watch: the placeholder
       and the real content are the same LpCard with the same flex and gaps, so
       the card keeps its size and nothing below it jumps as the data lands. -->
  <div class="flex flex-col gap-3">
    <LpButton size="sm" variant="outline" :disabled="loading" @click="reload">
      {{ loading ? 'Loading…' : 'Reload' }}
    </LpButton>

    <LpCard variant="flat" padded>
      <LpSkeleton v-if="loading" class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <div class="lp-skeleton-item size-10 shrink-0 rounded-pill bg-surface-soft" />
          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <div class="lp-skeleton-item h-3.5 w-28 rounded-control bg-surface-soft" />
            <div class="lp-skeleton-item h-3 w-40 rounded-control bg-surface-soft" />
          </div>
          <div class="lp-skeleton-item h-8 w-20 shrink-0 rounded-control bg-surface-soft" />
        </div>
        <div class="flex flex-col gap-2">
          <div class="lp-skeleton-item h-3 w-full rounded-control bg-surface-soft" />
          <div class="lp-skeleton-item h-3 w-5/6 rounded-control bg-surface-soft" />
        </div>
      </LpSkeleton>

      <div v-else class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <LpAvatar size="md" :src="avatarSample" alt="THEROER" />
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-medium text-ink">THEROER</span>
            <span class="truncate text-xs text-muted">theroer · owner</span>
          </div>
          <LpButton size="sm" variant="outline">Follow</LpButton>
        </div>
        <p class="m-0 text-sm leading-relaxed text-muted">
          Builds the control plane, the kit, and the launcher.
        </p>
      </div>
    </LpCard>
  </div>
</div>`,
  },
  {
    id: "section",
    name: "Section",
    description:
      "A section heading: a title, an optional line under it, actions on the right. It draws NO container. The cards below are LpCard, and the heading is only the top line inside each. That is deliberate: these headings sit inside cards in one app, inside glass panels in another, and straight on the page in a third, so owning a border would fight two of the three. `level` is the visual size and is independent of `as`, the heading element.",
    components: { LpSection, LpCard, LpButton, LpBadge, LpInput, LpLink },
    template: `<div class="flex w-[32rem] flex-col gap-4">
  <!-- Same container every time (LpCard), so what changes between these is
       the heading alone. -->
  <LpCard>
    <LpSection
      as="h2"
      level="lg"
      title="Billing"
      description="Invoices for app-vps-1.lp.internal.leavepulse.example.com, payment methods and your current plan."
    >
      <template #actions>
        <LpButton size="sm" variant="ghost">Export</LpButton>
        <LpButton size="sm" variant="outline">Add card</LpButton>
      </template>
    </LpSection>
  </LpCard>

  <LpCard>
    <LpSection as="h3" title="Recent invoices" class="mb-4">
      <template #meta><LpBadge tone="neutral">12</LpBadge></template>
      <template #actions>
        <LpInput size="sm" placeholder="Filter\u2026" class="w-40" />
      </template>
    </LpSection>
    <p class="m-0 text-sm text-muted">Twelve invoices, none overdue.</p>
  </LpCard>

  <!-- title and description as SLOTS, for what a plain string cannot carry:
       a name with its id after it, a description with a link in it. Same
       place, same typography as the prop form above. -->
  <LpCard>
    <LpSection icon="lucide:server" level="sm" as="h3">
      <template #title>
        ger-01-p <span class="font-mono text-xs text-muted">216879598879719424</span>
      </template>
      <template #description>
        Six hosts, five online. <LpLink href="#">See the fleet</LpLink>.
      </template>
    </LpSection>
  </LpCard>

  <!-- And with no container at all, which is how a page-level heading is used. -->
  <LpSection as="h2" level="xl" title="On the page, unwrapped" />
</div>`,
  },
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
  },
  {
    id: "divider",
    name: "Divider · Link",
    description:
      "Separator rule and inline links. The `reveal` variant sweeps an underline in from the left. `revealOn: group` hands that trigger to an ancestor marked `group`, for a link inside a row or card that is itself the click target: the row lights up and the name sweeps with it, rather than waiting for the pointer to cross the text exactly.",
    components: { LpDivider, LpLink },
    template: `<div class="flex w-80 flex-col gap-3">
  <LpLink href="#">Default link</LpLink>
  <LpLink href="#" tone="ink">Ink link</LpLink>
  <LpLink href="#" tone="muted">Muted link</LpLink>
  <LpLink href="#" tone="soft">Soft link</LpLink>
  <LpDivider label="or" />
  <LpLink href="#" external>External link</LpLink>
  <LpLink href="#" variant="reveal">Reveal underline</LpLink>

  <LpDivider label="in a row" />
  <!-- Hover anywhere on either row: the bar sweeps from the row, not from the
       few characters of the name. -->
  <a
    v-for="r in ['app-vps-1', 'data-vps']"
    :key="r"
    href="#"
    class="group flex items-center justify-between gap-3 rounded-control px-3 py-2 transition-colors hover:bg-surface-soft"
  >
    <LpLink :as="'span'" variant="reveal" reveal-on="group" tone="ink">{{ r }}</LpLink>
    <span class="text-xs text-muted">running</span>
  </a>
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
  <LpLogViewer :lines="lines" toolbar :max-lines="12" line-numbers height="14rem" />
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
      "Stackable notifications via the useToast() composable (a global singleton). LpToaster is mounted once at the app root; anywhere can call toast.success(...) etc. Hover pauses the countdown; toasts support a title, action buttons, a whole-toast click, and duration:0 to persist. `toast.promise(task, { loading, success, error })` shows one toast that follows a promise, and a `key` makes a toast replace the one on screen with the same key instead of stacking. An Error can be passed straight to `error()`/`warning()`; its `details` (or `details` in options, or the `cause` behind a hand-written message) are not shown but ride along to the copy button, so a copied error carries the request, status and ids a bug report needs. A failed `toast.promise` keeps the error's details the same way, and details are also found through a native `Error.cause` chain.",
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
        promised: () =>
          toast.promise(
            new Promise((resolve, reject) => setTimeout(() => (Math.random() < 0.7 ? resolve(42) : reject(new Error("timeout"))), 1500)),
            {
              loading: "Deploying ger-01-p...",
              success: (n) => `Deployed in ${n} s`,
              error: (e) => `Deploy failed: ${(e as Error).message}`,
            },
          ),
        progress: (() => {
          let step = 0
          return () => {
            step = (step % 4) + 1
            toast.info(`Syncing backups: ${step} of 4`, { key: "backup-sync", title: "Keyed toast" })
          }
        })(),
        apiError: () => {
          const error = Object.assign(new Error("Bad parameter: subject_id"), {
            details: "GET /api/journal/feed?subject_id=Sel -> 400\nrequest_id: 3f2a9c\nsubject_id (query): invalid literal for int()",
          })
          toast.error(error)
        },
        withCause: () => {
          const error = Object.assign(new Error("timeout"), { details: "PUT /api/settings -> 504\nrequest_id: 81bd02" })
          toast.error(`Not saved: ${error.message}`, { cause: error })
        },
        failedPromise: () =>
          toast
            .promise(
              new Promise((_, reject) =>
                setTimeout(() => reject(Object.assign(new Error("502"), { details: "POST /api/deploy -> 502\nrequest_id: c41e07" })), 1200),
              ),
              { loading: "Deploying ger-01-p...", success: "Deployed", error: "Deploy failed" },
            )
            .catch(() => {}),
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
  <LpButton size="sm" variant="outline" @click="promised">toast.promise</LpButton>
  <LpButton size="sm" variant="outline" @click="progress">Keyed (click again)</LpButton>
  <LpButton size="sm" variant="danger" @click="apiError">Error with details</LpButton>
  <LpButton size="sm" variant="danger" @click="withCause">Error with a cause</LpButton>
  <LpButton size="sm" variant="danger" @click="failedPromise">Failing promise (copy keeps details)</LpButton>
</div>`,
  },
  {
    id: "formfield",
    name: "FormField",
    description:
      "Label + control + hint/error wrapper. The field hands its control the label's id, the id of the hint or error line and its invalid/required/disabled state, so kit controls need no wiring. A control of your own reads the same context with `useField()`, as the rating below does. For a passing remark rather than a validation error, `notify(text, { tone, duration })` (on the field's ref, or on `useField()` from a control inside) floats a note under the control and fades the hint out under it, so nothing below moves; `useFieldNotice()` with `LpFieldNotice` does the same for a control outside any field.",
    components: { LpFormField, LpInput, LpButton, RatingControl },
    state: () => reactive({ value: "", rating: 0 }),
    template: `<div class="flex w-80 flex-col gap-4">
  <LpFormField label="Nickname" hint="Shown on your profile" required>
    <template #default="{ id }"><LpInput :id="id" v-model="value" placeholder="Steve" /></template>
  </LpFormField>
  <LpFormField label="Email" error="That doesn't look like an email">
    <template #default="{ id }"><LpInput :id="id" v-model="value" invalid /></template>
  </LpFormField>
  <LpFormField label="Bare kit control" hint="No slot props: the field context wires it">
    <LpInput v-model="value" />
  </LpFormField>
  <LpFormField label="Your own control" :error="rating === 0 ? 'Pick a rating' : undefined" required>
    <RatingControl v-model="rating" />
  </LpFormField>
  <LpFormField ref="slug" label="Slug" hint="Part of the page address">
    <div class="flex gap-2">
      <LpInput v-model="value" placeholder="my-page" class="min-w-0 flex-1" />
      <LpButton size="sm" variant="outline" @click="$refs.slug.notify('Copied to the clipboard')">Copy</LpButton>
      <LpButton size="sm" variant="outline" @click="$refs.slug.notify('That slug is taken', { tone: 'danger' })">Check</LpButton>
    </div>
  </LpFormField>
</div>`,
  },
  {
    id: "modal",
    name: "Modal",
    description: "Dialog with overlay, title and footer. size=sm…xl|2xl|3xl|full (or width=\"…\"); long content scrolls inside. A body that arrives late resizes the panel smoothly instead of snapping — see the second example. `guard` asks before closing when something would be lost (`:guard=\"form.dirty\"`, or a function for the app's own question), and also warns on leaving the page; `:dismissible=\"false\"` keeps Escape and the scrim from closing a step the user must finish on purpose. `glass` trades the solid panel for frosted glass over a lighter scrim (also on Drawer, CommandPalette and the dialogs built on Modal) — see the third. Without a title, `aria-label` names the dialog (Drawer and Popover take it too). A custom overlay joins the same stack with `useModalLayer()`, and page-level hotkeys stay quiet while a modal covers them unless they set `overLayers` — see the bottom of the example. Unset, it follows `provideGlass()` from an ancestor, so an app that wants every overlay frosted says it once at its root; an explicit `:glass=\"false\"` still wins.",
    components: { LpModal, LpButton, CustomSheet, LayerKeys },
    state: () => {
      const s = reactive({
        open: false,
        nested: false,
        frosted: false,
        frostedNested: false,
        bare: false,
        sheet: false,
        fromSheet: false,
        lazy: false,
        guarded: false,
        draft: "",
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
  <LpButton variant="outline" @click="frosted = true">Open glass</LpButton>
  <LpButton variant="outline" @click="draft = ''; guarded = true">Open with a guard</LpButton>

  <LpModal v-model:open="guarded" title="Edit note" :guard="draft.trim() !== ''">
    <textarea v-model="draft" rows="3" class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none" placeholder="Type something, then press Escape" />
    <template #footer>
      <LpButton variant="solid" @click="draft = ''; guarded = false">Save</LpButton>
    </template>
  </LpModal>

  <LpModal v-model:open="open" size="lg" title="Confirm action" description="A token-driven modal on reka Dialog.">
    <p>Body content. Escape or overlay-click closes it.</p>
    <template #footer>
      <LpButton variant="outline" @click="nested = true">Open nested</LpButton>
      <LpButton variant="ghost" @click="open = false">Cancel</LpButton>
      <LpButton variant="solid" @click="open = false">Confirm</LpButton>
    </template>
  </LpModal>

  <LpModal v-model:open="nested" size="sm" title="Nested modal">
    <p>Only this layer dims the first modal; the page keeps its original blur.</p>
  </LpModal>

  <LpModal v-model:open="frosted" size="lg" title="Glass" description="The page shows through, blurred." glass>
    <p>Same modal, frosted. A look rather than a behaviour, so it stays opt-in.</p>
    <template #footer>
      <LpButton variant="outline" @click="frostedNested = true">Open nested</LpButton>
      <LpButton variant="solid" @click="frosted = false">Close</LpButton>
    </template>
  </LpModal>

  <LpModal v-model:open="frostedNested" size="sm" title="Nested glass" glass>
    <p>Frosted too, a little denser: the text of the dialog below blurs instead of reading through.</p>
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

  <LpButton variant="outline" @click="bare = true">No title (aria-label)</LpButton>
  <LpModal v-model:open="bare" size="sm" aria-label="Image preview">
    <p class="text-muted">No visible title: aria-label names the dialog instead.</p>
  </LpModal>

  <!-- Not a kit component: it joins the shared stack through useModalLayer. -->
  <LpButton variant="outline" @click="sheet = true">Custom overlay</LpButton>
  <CustomSheet v-model:open="sheet">
    <p class="font-semibold text-ink">A sheet of your own</p>
    <p class="text-sm text-muted">It claims a layer with useModalLayer. The kit modal opened from here lands above it, scrim included, and Escape closes the top one first.</p>
    <div class="flex gap-2">
      <LpButton variant="solid" @click="fromSheet = true">Open a kit modal</LpButton>
      <LpButton variant="ghost" @click="sheet = false">Close</LpButton>
    </div>
  </CustomSheet>
  <LpModal v-model:open="fromSheet" size="sm" title="Above the custom sheet">
    <p class="text-muted">Opened from a non-kit overlay, stacked on top of it.</p>
  </LpModal>

  <div class="mt-4 w-full border-t border-line pt-4">
    <LayerKeys />
  </div>
</div>`,
  },
  {
    id: "modal-nav",
    name: "ModalNav",
    description: "A dialog whose sections stand beside it: settings, a profile, a wizard you can skip around in. Takes LpSidebar's `items` or grouped `sections`; `navSide` moves the rail to the other side. Below `mobileBreakpoint` (default lg) it folds into a drawer the header's button opens. The `actions` slot (also on LpModal) puts controls for the whole dialog, such as a period, beside the close button.",
    components: { LpModalNav, LpButton, LpSegmented },
    state: () => {
      const s = reactive({
        open: false,
        glass: false,
        section: "activity",
        period: "week",
        periods: [
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ],
        sections: [
          {
            title: "Work",
            icon: "lucide:briefcase",
            collapsible: true,
            items: [
              { id: "activity", label: "Activity", icon: "lucide:activity", badge: 103 },
              { id: "voice", label: "Voice", icon: "lucide:mic", badge: 4 },
              { id: "reviews", label: "Reviews", icon: "lucide:star", badge: 16 },
            ],
          },
          {
            title: "Person",
            icon: "lucide:user",
            collapsible: true,
            items: [
              { id: "economy", label: "Economy", icon: "lucide:coins" },
              { id: "social", label: "Social", icon: "lucide:heart" },
            ],
          },
        ],
      })
      return s
    },
    template: `<div>
  <div class="flex flex-wrap gap-2">
    <LpButton variant="solid" @click="glass = false; open = true">Open</LpButton>
    <LpButton variant="outline" @click="glass = true; open = true">Open glass</LpButton>
  </div>

  <LpModalNav
    v-model:open="open"
    v-model="section"
    :sections="sections"
    :glass="glass"
    title="Staff member"
    description="Sections stay in view while you read one."
  >
    <template #actions>
      <LpSegmented v-model="period" :options="periods" size="sm" aria-label="Period" />
    </template>
    <p>Section: <strong>{{ section }}</strong>, period: <strong>{{ period }}</strong>.</p>
    <p class="text-muted">The list stands outside the dialog, in the same centring row — it takes none of the body's width. Narrow the window past lg and it folds into a drawer.</p>
    <template #footer>
      <LpButton variant="ghost" @click="open = false">Close</LpButton>
    </template>
  </LpModalNav>
</div>`,
  },
  {
    id: "confirm",
    name: "ConfirmDialog",
    description:
      "Confirm/cancel dialog over Modal. Pass `action` and the dialog runs it: the button shows a loading state, a rejection keeps the dialog open with the error's message, and it closes only on success. For a one-off question there is `confirm()`: `if (await confirm({ title }))` with one LpConfirmHost mounted next to LpToaster.",
    components: { LpConfirmDialog, LpButton },
    state: () => {
      const s = reactive({
        open: false,
        withAction: false,
        answer: "not asked yet",
        fail: true,
        restart() {
          return new Promise<void>((resolve, reject) =>
            setTimeout(() => {
              const failing = s.fail
              s.fail = !s.fail
              failing ? reject(new Error("The host did not answer. Try again.")) : resolve()
            }, 1200),
          )
        },
        async ask() {
          const ok = await confirm({
            title: "Discard changes?",
            description: "Your edits to this server will be lost.",
            confirmLabel: "Discard",
            danger: true,
          })
          s.answer = ok ? "discarded" : "kept"
        },
        async askWithAction() {
          const ok = await confirm({ title: "Rotate the API key?", confirmLabel: "Rotate", action: () => s.restart() })
          s.answer = ok ? "rotated" : "cancelled"
        },
      })
      return s
    },
    template: `<div class="flex flex-col items-start gap-3">
  <div class="flex flex-wrap gap-2">
    <LpButton variant="danger" @click="open = true">Delete server</LpButton>
    <LpButton variant="outline" @click="withAction = true">Restart (with action)</LpButton>
    <LpButton variant="outline" @click="ask">await confirm()</LpButton>
    <LpButton variant="outline" @click="askWithAction">confirm() with action</LpButton>
  </div>
  <p class="text-xs text-muted">Answer: {{ answer }} · the first run of an action fails, the next one succeeds</p>
  <LpConfirmDialog v-model:open="open" danger title="Delete server?" description="This cannot be undone." confirmLabel="Delete">
    The server and its data will be permanently removed.
  </LpConfirmDialog>
  <LpConfirmDialog v-model:open="withAction" title="Restart ger-01-p?" confirmLabel="Restart" :action="restart">
    Players are disconnected for about a minute.
  </LpConfirmDialog>
</div>`,
  },
  {
    id: "gamepad-nav",
    name: "Gamepad navigation",
    description:
      "useGamepadNav: a game controller drives the page. The D-pad or left stick moves focus to the nearest control in that direction (spatialNav's nextInDirection, inside the open dialog when there is one), A presses it, B closes the open dialog or calls onBack, the bumpers call onPrevious/onNext and Start onMenu, and the right stick scrolls. While a controller is in use the root carries data-input=\"gamepad\" and focus gets a thicker ring.",
    components: { GamepadNav, LpButton, LpModal },
    state: () => reactive({ open: false, last: "" }),
    template: `<div class="flex flex-col items-center gap-4">
  <p class="text-sm text-muted"><GamepadNav @fired="(what) => (last = what)" /></p>
  <div class="grid grid-cols-3 gap-2">
    <LpButton v-for="n in 9" :key="n" variant="soft" @click="last = 'Button ' + n">Button {{ n }}</LpButton>
  </div>
  <LpButton variant="action" @click="open = true">Open a dialog</LpButton>
  <p class="text-sm text-muted">Last: {{ last || "nothing yet" }}</p>
  <LpModal v-model:open="open" title="A dialog" size="sm">
    <div class="flex gap-2">
      <LpButton variant="soft" @click="last = 'Dialog: first'">First</LpButton>
      <LpButton variant="soft" @click="last = 'Dialog: second'">Second</LpButton>
    </div>
  </LpModal>
</div>`,
  },
  {
    id: "shortcuts-dialog",
    name: "ShortcutsDialog",
    description:
      "Keyboard reference, conventionally on F1: `hotkey=\"F1\"` binds it (and lists it). `groups` is the written list: keys that are not bindings (arrows in a list) and the ones worth knowing before their screen opens. `live` adds every mounted useHotkeys binding that carries `help`, so a screen documents its own keys while it is open: mount the editor below and its section appears. Same-titled groups merge and a combo is listed once. Combos split on \"+\" into one <kbd> each, and Ctrl/Alt print as ⌘/⌥ on Apple keyboards.",
    components: { LpShortcutsDialog, LpButton, LpSwitch, EditorKeys, SequenceKeys, SaveKeys, PendingKeys },
    state: () =>
      reactive({
        open: false,
        editor: false,
        sequences: false,
        clash: false,
        fired: "",
        groups: [
          {
            title: "Navigation",
            entries: [
              { combo: "Ctrl+K", label: "Command palette" },
              { combo: "Ctrl+F", label: "Search" },
              { combo: "Alt+←", label: "Back" },
              { combo: "Alt+→", label: "Forward" },
            ],
          },
          {
            title: "View",
            entries: [
              { combo: "Ctrl++", label: "Zoom in" },
              { combo: "Ctrl+-", label: "Zoom out" },
              { combo: "←→↑↓", label: "Move selection" },
            ],
          },
        ],
      }),
    template: `<div>
  <div class="flex flex-wrap items-center gap-4">
    <LpButton variant="outline" @click="open = true">Show shortcuts</LpButton>
    <LpSwitch v-model="editor" label="Editor mounted" />
    <LpSwitch v-model="sequences" label="Sequences (g i, g s)" />
    <LpSwitch v-model="clash" label="Second Ctrl+S" />
  </div>
  <p class="mt-3 text-sm text-muted">Pending: <PendingKeys /> · Last: {{ fired || "none" }}</p>
  <EditorKeys v-if="editor" />
  <SequenceKeys v-if="sequences" @fired="(v) => (fired = v)" />
  <SaveKeys v-if="clash" @fired="(v) => (fired = v)" />
  <LpShortcutsDialog v-model:open="open" :groups="groups" live hotkey="F1" description="Everything the keyboard can do here." />
</div>`,
  },
  {
    id: "drawer",
    name: "Drawer",
    description:
      "Drag-driven panel on vaul-vue: drag-to-dismiss with inertia, snap points, a grab handle and an optional scale-background. direction=top|bottom|left|right (side=left|right still works), size=sm…xl or width=\"…\", snapPoints, dismissible, handleOnly, scaleBackground. Interactive controls inside are auto-excluded from the drag (noDragControls, on by default) so you can select text / use inputs; noDragContent makes the whole body non-draggable (handle/header only). `resizable` with `persist` remembers the width the user dragged to across visits (in the kit's storage, see usePersisted); `guard` asks before closing when something would be lost, and while it is set the drawer closes by its button, the scrim or Escape, not by a swipe.",
    components: { LpDrawer, LpButton, LpInput },
    state: () => reactive({ side: false, sheet: false, snap: false, bare: false, q: "", note: "" }),
    template: `<div class="flex flex-wrap gap-2">
  <LpButton variant="outline" @click="side = true">Side panel</LpButton>
  <LpButton variant="outline" @click="sheet = true">Bottom sheet</LpButton>
  <LpButton variant="outline" @click="snap = true">Snap points</LpButton>

  <!-- Side drawer with a form: drag the input → text selects, drawer stays put. -->
  <LpDrawer v-model:open="side" direction="right" size="lg" resizable persist="preview-filters" :guard="note.trim() !== ''" title="Filters" description="Try dragging the input — it selects text instead of moving the drawer. Drag the left edge to resize: the width is remembered. Type a note and try to close.">
    <div class="flex flex-col gap-3">
      <LpInput v-model="q" placeholder="Search filters…" />
      <textarea v-model="note" rows="3" class="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none" placeholder="A textarea you can drag-select in" />
      <p class="text-sm text-muted">The drawer still drags from blank space and the header.</p>
    </div>
  </LpDrawer>

  <!-- Headerless: aria-label names it for screen readers. -->
  <LpButton variant="outline" @click="bare = true">No header</LpButton>
  <LpDrawer v-model:open="bare" direction="left" size="sm" aria-label="Quick actions">
    <p class="text-sm text-muted">No title bar: aria-label names this drawer.</p>
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
    id: "tour",
    name: "Tour",
    description:
      "A guided walk over the real interface. Each step lights its target through the scrim and explains it in a card beside it; arrow keys and Enter step through, Escape closes. A target is a `v-hint` id, a selector or an element, and a step whose target is not on the page is skipped, so a tour built from the hinted controls only ever shows what this user can see. A `try` step waits for the user to press the control themselves (with an optional \"do it for me\"), and `enter` can open what the target lives in, registering its undo with `onLeave` (this step) or `onEnd` (the rest of the tour) so the page is left as it was found. On a phone the card becomes a sheet at the bottom.",
    components: { LpTour, LpButton, LpContextMenu },
    state: () =>
      reactive({
        open: false,
        step: 0,
        log: "",
        steps: [
          { title: "A quick look around", text: "Three controls, one minute. Arrow keys work too." },
          { target: "demo.search", title: "Search", text: "Finds people, roles and channels.", keys: "Ctrl+K" },
          { target: "demo.export", title: "Export", text: "Downloads what the table shows, filters included.", try: true, perform: () => {} },
          { target: "demo.missing", title: "Not on this page", text: "Skipped: the target is not rendered for this user." },
          {
            target: () => document.querySelector("[role=menu]"),
            title: "Row menu",
            text: "Right-click any row for its actions. The tour opened this one for you and closes it when you move on.",
            side: "right",
            enter: ({ onLeave }: TourContext) => {
              const row = hints.element("demo.row")
              if (!row) return
              onLeave(openContextMenu(row))
            },
          },
        ],
      }),
    template: `<div class="flex w-full max-w-md flex-col gap-3">
  <div class="flex flex-wrap gap-2">
    <LpButton v-hint="'demo.search'" variant="outline" size="sm">Search</LpButton>
    <LpButton v-hint="'demo.export'" variant="outline" size="sm" @click="log = 'Exported'">Export</LpButton>
  </div>
  <LpContextMenu :items="[{ label: 'Open card' }, { label: 'Copy ID' }]">
    <div v-hint="'demo.row'" class="rounded-control border border-line px-3 py-2 text-sm">Row: right-click me</div>
  </LpContextMenu>
  <div class="flex items-center gap-3">
    <LpButton size="sm" @click="step = 0; open = true">Start the tour</LpButton>
    <span class="text-xs text-muted">{{ log }}</span>
  </div>
  <LpTour v-model:open="open" v-model:step="step" :steps="steps" @finish="log = 'Finished'" @dismiss="(at) => log = 'Closed on step ' + (at + 1)" />
</div>`,
  },
  {
    id: "hints",
    name: "Hints",
    description:
      "The whole onboarding in one component: hand <LpHints> a system made by createHintSystem (features tied to `v-hint` elements, the current page, a storage) and it offers a first-visit tour, shows quiet \"new\" dots, announces what changed and nudges toward unused features, spending one attention budget: at most one interruption per session, never over a dialog, while typing or right after navigation. State only climbs (seen, explained, used), so what someone uses is never explained again. A page met for the first time is baselined, so existing users do not get every control lit at rollout. Errors inside switch the layer off instead of breaking the page. Storage defaults to localStorage; pass your own to keep it per person on a server. Tips cover habits rather than features: contextMenuTip() speaks up for someone who keeps opening \"…\" menus marked `rightClickToo` but never right-clicks, paletteTip() for someone who walks the menu and never opens the palette; kit components report that usage themselves (HINT_SIGNALS). The command palette also lights up its Tab key for a user who never opened an item's actions. A feature that is absent right now (nothing flagged, nobody left) gets a sample the way LpSkeleton gets a layout: wrap the app's own markup with made-up data in <LpHintExample hint=\"id\">; it shows only while a tour step or \"what changed\" reaches that id with the real thing absent, eases in, is inert and tagged \"Example\", and leaves with the step. Nothing to add to the registry.",
    components: { LpHints, LpButton, LpContextMenu, LpHintExample },
    state: () => {
      const storage = localHintStorage("lp-preview-hints")
      const features = {
        "demo.inbox": { page: "demo", order: 1, title: "Inbox", text: "Everything waiting for you." },
        "demo.compose": { page: "demo", order: 2, title: "Compose", text: "Start a new message.", try: true },
        "demo.archive": { page: "demo", order: 3, title: "Archive", text: "Done items live here.", rev: 1 },
        "demo.flagged": {
          page: "demo", order: 4, conditional: true, title: "Flagged", text: "A message someone marked for you shows up here.",
        },
      }
      return reactive({
        system: createHintSystem({
          features,
          pages: { demo: { title: "this demo" } },
          news: [{ id: "archive-v2", date: "2026-10-25", page: "demo", feature: "demo.archive", text: "Archive now keeps a year." }],
          storage,
          page: () => "demo",
          sessionKey: "lp-preview-hints:session",
          timing: { settle: 600, offerAgain: 0 },
          tips: [contextMenuTip(), paletteTip()],
        }),
        reset() {
          localStorage.removeItem("lp-preview-hints")
          sessionStorage.removeItem("lp-preview-hints:session")
          location.reload()
        },
        habit(signal: string, times: number) {
          for (let i = 0; i < times; i++) hints.use(signal)
          sessionStorage.removeItem("lp-preview-hints:session")
        },
        signals: HINT_SIGNALS,
      })
    },
    template: `<div class="flex flex-col items-start gap-3">
  <div class="flex flex-wrap gap-2">
    <LpButton v-hint="'demo.inbox'" variant="outline" size="sm">Inbox</LpButton>
    <LpButton v-hint="'demo.compose'" variant="outline" size="sm">Compose</LpButton>
    <LpButton v-hint="'demo.archive'" variant="outline" size="sm">Archive</LpButton>
  </div>
  <LpHintExample hint="demo.flagged">
    <div class="w-72 rounded-control border border-line px-3 py-2 text-sm">Flagged: "Can you check the invoice?"</div>
  </LpHintExample>
  <LpContextMenu :items="[{ label: 'Reply', icon: 'lucide:reply' }, { label: 'Archive', icon: 'lucide:archive' }]">
    <div class="w-72 rounded-control border border-line px-3 py-2 text-sm">A message row: it has a right-click menu</div>
  </LpContextMenu>
  <div class="flex gap-2">
    <LpButton size="sm" @click="system.startTour('demo')">Take the tour</LpButton>
    <LpButton size="sm" variant="ghost" @click="reset">Reset as a new user</LpButton>
  </div>
  <p class="text-xs text-muted">Habit tips appear on their own after the usage below; these buttons fake it so you can see one now (dismiss the tour offer first, one interruption per session).</p>
  <div class="flex flex-wrap gap-2">
    <LpButton size="sm" variant="outline" @click="habit(signals.menuButton, 5)">Pretend I keep using "…" and never right-click</LpButton>
    <LpButton size="sm" variant="outline" @click="habit(signals.navigate, 15)">Pretend I walk the menu and never open the palette</LpButton>
  </div>
  <LpHints :system="system" />
</div>`,
  },
  {
    id: "hint-layer",
    name: "HintLayer",
    description:
      "Quiet \"new\" dots over `v-hint` controls: something changed here, or the user just gained access to it. Nothing pops up by itself; the note opens when the pointer or focus reaches the control, and `read` fires when the user dismisses it or simply uses the control. At most `limit` dots show at once, most important first. The app decides what counts as new from the registry's `seen` and `used` events.",
    components: { LpHintLayer, LpButton },
    state: () =>
      reactive({
        fresh: ["demo.activity", "demo.remind"],
        notes: {
          "demo.activity": { title: "Activity column", text: "Weekly quota progress for each person." },
          "demo.remind": { title: "Remind everyone", text: "Messages everyone who has not set their hours." },
        },
      }),
    template: `<div class="flex flex-col items-start gap-3">
  <div class="flex flex-wrap gap-3">
    <LpButton v-hint="'demo.activity'" variant="outline" size="sm">Activity</LpButton>
    <LpButton v-hint="'demo.remind'" variant="outline" size="sm">Remind everyone</LpButton>
  </div>
  <LpButton size="sm" variant="ghost" @click="fresh = ['demo.activity', 'demo.remind']">Mark as new again</LpButton>
  <LpHintLayer :fresh="fresh" :notes="notes" @read="(id) => fresh = fresh.filter((x) => x !== id)" />
</div>`,
  },
  {
    id: "tooltip",
    name: "Tooltip",
    description:
      "Themed replacement for the native `title` attribute, which the OS draws (so it looks different on every platform), delays about a second, cannot wrap, and is read inconsistently by screen readers. Opens on keyboard focus as well as hover and closes on Escape. Use `label` when the tip IS the control's name — an icon button — and it becomes the accessible name; leave it off when the control already has a name and the tip only adds to it. `side`, `delay` and `side-offset` tune placement and timing. Wrap a group in LpTooltipProvider and neighbouring tips open without a second delay.",
    components: { LpTooltip, LpTooltipProvider, LpButton, LpIcon },
    state: () => reactive({}),
    template: `<div class="flex flex-wrap items-center gap-3">
  <!-- Names the button: it has no visible text of its own. -->
  <LpTooltip content="Delete instance" label>
    <LpButton variant="ghost"><LpIcon name="lucide:trash-2" :size="16" /></LpButton>
  </LpTooltip>

  <!-- Describes a button that already has a name. -->
  <LpTooltip content="Copies the whole folder — this can take a while">
    <LpButton variant="outline">Duplicate</LpButton>
  </LpTooltip>

  <LpTooltip content="Appears below instead" side="bottom">
    <LpButton variant="ghost">Side</LpButton>
  </LpTooltip>

  <LpTooltip content="No waiting" :delay="0">
    <LpButton variant="ghost">Instant</LpButton>
  </LpTooltip>

  <LpTooltip content="A longer explanation that wraps onto several lines instead of running off the edge of the screen the way a native title would.">
    <LpButton variant="ghost">Long text</LpButton>
  </LpTooltip>

  <!-- One provider for a toolbar: after the first tip, moving to a neighbour opens its tip at once. -->
  <LpTooltipProvider :delay="400">
    <div class="flex gap-1 rounded-control border border-line p-1">
      <LpTooltip content="Bold" label><LpButton variant="ghost" size="sm"><LpIcon name="lucide:bold" :size="16" /></LpButton></LpTooltip>
      <LpTooltip content="Italic" label><LpButton variant="ghost" size="sm"><LpIcon name="lucide:italic" :size="16" /></LpButton></LpTooltip>
      <LpTooltip content="Underline" label><LpButton variant="ghost" size="sm"><LpIcon name="lucide:underline" :size="16" /></LpButton></LpTooltip>
    </div>
  </LpTooltipProvider>
</div>`,
  },
  {
    id: "popover",
    name: "Popover",
    description:
      "Anchored overlays. Popover takes side/align, `side-offset`, `panel-class` (width/padding/overflow) and a controllable `v-model:open`; left unbound it stays uncontrolled.",
    components: { LpPopover, LpButton },
    state: () => reactive({ open: false }),
    template: `<div class="flex flex-wrap items-center gap-3">
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
  <!-- No heading inside: aria-label names the dialog for screen readers. -->
  <LpPopover aria-label="Quick filters">
    <template #trigger><LpButton variant="ghost">Unlabelled panel</LpButton></template>
    <p class="text-muted">Announced as "Quick filters".</p>
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
    description: "Numeric input with stepper buttons, min/max/step, optional unit.",
    components: { LpNumberField },
    state: () => reactive({ value: 30, watts: 10, millis: 380 }),
    template: `<div class="w-48 space-y-3">
  <LpNumberField v-model="value" :min="0" :max="100" :step="5" />
  <LpNumberField v-model="watts" :min="0" unit="W" />
  <LpNumberField v-model="millis" :min="0" unit="mA" />
  <p class="text-xs text-muted">value: {{ value }}</p>
</div>`,
  },
  {
    id: "timefield",
    name: "TimeField",
    description: "Time of day as hour and minute segments (reka TimeField): type or step with the arrow keys. Model is \"HH:mm\", like a native time input, but the clock is fixed by `hourCycle` (24 by default) instead of the browser locale, and it is themed like the other fields.",
    components: { LpTimeField },
    state: () => reactive({ at: "18:30", twelve: "" }),
    template: `<div class="flex w-56 flex-col gap-3">
  <LpTimeField v-model="at" />
  <LpTimeField v-model="twelve" :hour-cycle="12" locale="en-US" />
  <p class="text-xs text-muted">value: {{ at || "—" }} · {{ twelve || "—" }}</p>
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
    id: "range-slider",
    name: "RangeSlider",
    description:
      "Two thumbs on one track for a range rather than a value: a price from-to, a stretch of a clip, a span of years. The thumbs cannot cross, minGap keeps them apart, and format puts a label over a thumb while it is hovered, focused or dragged.",
    components: { LpRangeSlider },
    state: () => reactive({ price: [20, 80] as [number, number], clip: [2, 9] as [number, number], formatClipTime }),
    template: `<div class="flex w-80 flex-col gap-6 pt-6">
  <div>
    <LpRangeSlider v-model="price" :min="0" :max="100" :aria-labels="['Lowest price', 'Highest price']" :format="(v) => '$' + v" />
    <p class="mt-2 text-xs text-muted">price: {{ price[0] }} to {{ price[1] }}</p>
  </div>
  <div>
    <LpRangeSlider v-model="clip" :min="0" :max="12" :step="0.1" :min-gap="0.5" :format="(v) => formatClipTime(v, true)" />
    <p class="mt-2 text-xs text-muted">loop: {{ formatClipTime(clip[0], true) }} to {{ formatClipTime(clip[1], true) }}</p>
  </div>
</div>`,
  },
  {
    id: "video-backdrop",
    name: "VideoBackdrop",
    description:
      "A muted looping video behind something, filling the positioned box it sits in. Loops a stretch of the clip (start, end), blends the seam so a clip whose last frame does not match its first loops without a jump (crossfade), plays faster or slower (rate) and darkens under text (dim). Pauses on paused, in a hidden tab and under reduced motion, where it shows the stretch's first frame. The sample clip jumps from its last frame to its first: set crossfade to 0 to see the cut it hides.",
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
  },
  {
    id: "actionbar",
    name: "ActionBar",
    description:
      "A bar that rises from the bottom of the viewport to ask for ONE decision and stays until something resolves it — unsaved changes, a cookie notice, a bulk action on a selection. Not a dialog (the page stays usable behind it, no focus trap) and not a toast (it does not leave on a timer). Teleported to the body, so it pins to the viewport wherever it is declared. The last action is the primary one automatically, and several open at once stack instead of covering each other.",
    components: { LpActionBar, LpButton },
    state: () => reactive({ dirty: false, cookies: false, selection: false, saving: false }),
    template: `<div class="flex flex-wrap gap-2">
  <LpButton variant="outline" size="sm" @click="dirty = true">Unsaved changes</LpButton>
  <LpButton variant="outline" size="sm" @click="cookies = true">Cookie notice (full width)</LpButton>
  <LpButton variant="outline" size="sm" @click="selection = true">Bulk action (danger)</LpButton>

  <LpActionBar
    v-model:open="dirty"
    icon="lucide:pencil-line"
    title="You have unsaved changes"
    description="Leaving this page will discard them."
    :actions="[
      { label: 'Discard', onClick: () => { dirty = false } },
      { label: 'Save changes', icon: 'lucide:check', loading: saving, onClick: async () => {
          saving = true
          await new Promise(r => setTimeout(r, 900))
          saving = false; dirty = false
        } },
    ]"
  />

  <LpActionBar
    v-model:open="cookies"
    width="full"
    icon="lucide:cookie"
    title="We use cookies"
    description="Only what the site needs to work, plus analytics if you allow them."
    dismissible
    :actions="[
      { label: 'Essential only', onClick: () => { cookies = false } },
      { label: 'Allow all', onClick: () => { cookies = false } },
    ]"
  />

  <LpActionBar
    v-model:open="selection"
    variant="danger"
    icon="lucide:trash-2"
    title="3 rows selected"
    :actions="[
      { label: 'Cancel', onClick: () => { selection = false } },
      { label: 'Delete rows', icon: 'lucide:trash-2', onClick: () => { selection = false } },
    ]"
  />
</div>`,
  },
  {
    id: "alert",
    name: "Alert",
    description:
      "Inline callout with info/success/warning/danger variants, an auto icon (overridable), and an optional title. The difference between them that you cannot see is what a screen reader does: only `danger` interrupts it (role=\"alert\"), the rest are read when the reader reaches them, so a page that opens with an info banner does not shout it. An alert that appears later, like \"Settings saved\" below, takes `live=\"polite\"` to be announced once the reader is free; `live=\"assertive\"` interrupts, `false` stays quiet. The line under each example spells out what the reader does.",
    components: { LpAlert, LpButton, LpShift },
    state: () => {
      const s = reactive({ saved: false, collecting: false, collected: false })
      return Object.assign(s, {
        collect() {
          s.collecting = true
          s.collected = false
          setTimeout(() => {
            s.collecting = false
            s.collected = true
          }, 1500)
        },
      })
    },
    template: `<div class="flex w-full max-w-lg flex-col gap-3">
  <LpAlert variant="info" title="Heads up">Your invoice is due in 3 days.</LpAlert>
  <p class="-mt-1.5 text-xs text-muted">Screen reader: read in place, no interruption.</p>
  <LpAlert variant="success">Payment received — thank you.</LpAlert>
  <LpAlert variant="warning" title="Action needed">Verify your billing address to continue.</LpAlert>
  <LpAlert variant="danger" title="Payment failed">We couldn't charge your card.</LpAlert>
  <p class="-mt-1.5 text-xs text-muted">Screen reader: interrupts and reads it at once (role="alert").</p>
  <LpAlert busy>Collecting data from every source…</LpAlert>
  <p class="-mt-1.5 text-xs text-muted">busy: the icon spins and the alert is announced politely.</p>
  <LpAlert v-if="collecting || collected" :busy="collecting" :variant="collected ? 'success' : 'info'">{{ collected ? "Collected from 6 sources." : "Collecting from 6 sources…" }}</LpAlert>
  <p v-if="collecting || collected" class="-mt-1.5 text-xs text-muted">Once busy ends the alert stays a polite region, so the result replacing "Collecting…" is announced too.</p>
  <LpButton variant="outline" size="sm" class="self-start" :loading="collecting" @click="collect">Collect, then show the result</LpButton>
  <LpShift>
    <Transition enter-from-class="opacity-0 -translate-y-1" leave-to-class="opacity-0 -translate-y-1" enter-active-class="transition duration-200" leave-active-class="transition duration-150">
      <div v-if="saved" class="flex flex-col gap-1.5">
        <LpAlert variant="success" live="polite">Settings saved.</LpAlert>
        <p class="text-xs text-muted">Screen reader: announces "Settings saved" when it finishes what it is reading (live="polite").</p>
      </div>
    </Transition>
  </LpShift>
  <LpButton variant="outline" size="sm" class="self-start" @click="saved = !saved">{{ saved ? "Hide" : "Save settings" }}</LpButton>
</div>`,
  },
  {
    id: "table",
    name: "Table",
    description:
      "Data-driven table: typed columns (align/width/sortable), row key, empty state, per-column scoped cell slots (`#cell-<key>`), client/server sorting via v-model:sort, row selection via v-model:selected (press a row's tick and drag down the column to tick a run; Ctrl+A ticks all, Escape clears), a per-row right-click menu via `rowMenu`, stickyHeader, and a server-backed mode via `load` (paging, sort and header filters done by the server, debounced and abortable). A column's `sortValue` maps a row to what it sorts by, and `compare` takes over the ordering entirely. A `filterable` column gets a funnel in its header: a searchable list of its values with counts, `Only` on each value, All / None / Invert, and after a search the matches as a whole; filters in force show as chips above the table with the row count. `selectable=\"hold\"` hides the tick column until a long press on a row selects it (keep holding and drag to select more), after which clicks toggle rows and Escape clears; the `#bulk` slot holds actions for the selection. `density`, `summary` and `persist` (sort, filters and hidden columns remembered across visits) round it off. A column's `hideBelow` leaves it out while the table is narrower than that (Status below 520px here).",
    components: { LpTable, LpBadge, LpButton, LpIcon },
    state: () => {
      const s = reactive({
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
  <p class="mt-2 text-xs font-medium text-muted">Many values — open the funnel on Status or Owner. To select: hover a row and click the box at its left edge, or press and hold a row, then keep holding and drag over others; once rows are selected a click adds or removes one, Escape clears:</p>
  <LpTable
    :columns="issueColumns"
    :rows="issues"
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
      "Theme picker wired to the token engine — swatch / icon / pill triggers, circular-reveal transition on change, and the choice persisted across reloads. `system` adds a \"System\" entry that follows the OS colour scheme with a light/dark pair (`useTheme().setSystem({ light, dark })` does the same in code). LpThemeProvider paints one subtree in another theme, derived tokens included. Selected text follows the theme too once the app imports the opt-in `@leavepulse/ui/selection.css` (this preview does: select any text here and switch themes); without it the browser paints selection in the OS accent, which on Linux comes from the GTK theme.",
    components: { LpThemeSwitcher, LpThemeProvider, LpButton, LpBadge },
    state: () => {
      const theme = useTheme()
      return {
        theme,
        light: presets.light,
        rose: presets.rose,
        nord: presets.nord,
        scoped: presets.rose,
        followSystem: () => theme.setSystem({ light: presets.light, dark: presets.dark }),
      }
    },
    template: `<div class="flex w-full max-w-2xl flex-col gap-6">
  <div class="flex flex-wrap items-center gap-6">
    <LpThemeSwitcher variant="swatch" />
    <LpThemeSwitcher variant="icon" />
    <LpThemeSwitcher variant="pill" :system="{ light: 'Light', dark: 'Dark' }" />
    <LpButton size="sm" variant="outline" @click="followSystem">Follow the OS</LpButton>
    <span class="text-xs text-muted">{{ theme.system ? 'Following the OS' : 'Fixed theme' }}</span>
  </div>
  <div class="grid gap-4 sm:grid-cols-2">
    <LpThemeProvider :theme="light" class="flex flex-col gap-3 rounded-card border border-line p-4">
      <p class="text-sm font-medium">Always Light</p>
      <p class="text-xs text-muted">This panel keeps its theme whatever the page uses.</p>
      <div class="flex gap-2"><LpButton size="sm" variant="action">Save</LpButton><LpBadge tone="success">online</LpBadge></div>
    </LpThemeProvider>
    <LpThemeProvider :theme="scoped" transition class="flex flex-col gap-3 rounded-card border border-line p-4">
      <p class="text-sm font-medium">{{ scoped.name }}, switchable</p>
      <p class="text-xs text-muted">With transition, a new theme reveals from the button that changed it.</p>
      <div class="flex gap-2">
        <LpButton size="sm" variant="action" @click="scoped = scoped.name === rose.name ? nord : rose">Switch theme</LpButton>
        <LpBadge tone="danger">failed</LpBadge>
      </div>
    </LpThemeProvider>
  </div>
</div>`,
  },
  {
    id: "toc",
    name: "TableOfContents",
    description:
      "On-this-page rail with scroll-spy: nested heading links, an indicator that slides to the section in view, and smooth-scroll on click. The indicator follows the hovered link as in Tabs; `:hover-follow=\"false\"` pins it to the section in view (the toggle).",
    components: { LpTableOfContents, LpSwitch },
    state: () =>
      reactive({
        follow: true,
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
  <div class="flex w-52 shrink-0 flex-col gap-3">
    <label class="flex items-center gap-2 text-xs text-muted"><LpSwitch v-model="follow" /> Follow hover</label>
    <LpTableOfContents :links="links" :hover-follow="follow" />
  </div>
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
  },
  {
    id: "lightbox",
    name: "Lightbox",
    description:
      "Full-screen image viewer: arrows or swipe to page, wheel zooms toward the cursor over the picture and pages through the set off it, drag pans, double-click toggles fit/2x, pinch on touch, rotate, download, copy. Esc or a backdrop click closes; a filmstrip tracks the set. Keyboard: ←/→, Home/End, +/−, 0, R.",
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
  {
    id: "dropzone",
    name: "Dropzone",
    description:
      "Drop files, click to browse, or paste from the clipboard — three routes to the same intent, because a zone that takes only one of them is the one people call broken. `accept` filters a drop the same way it filters a browse, so the two cannot disagree. `links` adds an address by the same routes: drag a picture in from another tab (a browser gives its address, not a file), paste a copied link, or press \"or a link\" and type it where the zone was; Enter adds, Escape goes back. Only http(s) is taken, and it arrives as the `link` event; whether it serves a picture is the app's call.",
    components: { LpDropzone, LpSelect },
    state: () => reactive({ taken: [] as string[], refused: [] as string[], link: "", tone: "sunken" }),
    template: `<div class="flex w-full max-w-md flex-col gap-3">
  <LpSelect
    v-model="tone"
    :options="[
      { value: 'sunken', label: 'sunken — darker than the card' },
      { value: 'flush', label: 'flush — same as the card' },
      { value: 'soft', label: 'soft — lighter than the card' },
    ]"
  />
  <LpDropzone
    accept="image/*"
    multiple
    paste-target
    :tone="tone"
    :max-bytes="8 * 1024 * 1024"
    links
    title="Drop photographs here"
    hint="or click to browse · Ctrl+V pastes a screenshot · 8 MB each"
    @files="(f) => ((taken = f.map((x) => x.name + ' — ' + (x.size / 1024).toFixed(0) + ' KB')), (link = ''))"
    @rejected="(r) => (refused = r.map((x) => x.file.name + ' (' + x.cause + ')'))"
    @link="(url) => ((link = url), (taken = []))"
  />
  <p v-if="taken.length" class="text-xs text-muted">Taken: {{ taken.join(', ') }}</p>
  <div v-if="link" class="flex items-center gap-2 text-xs text-muted">
    <img :src="link" alt="" class="size-10 shrink-0 rounded-control bg-surface-soft object-cover" />
    <span class="min-w-0 truncate">Link: {{ link }}</span>
  </div>
  <p v-if="refused.length" class="text-xs text-danger">Refused: {{ refused.join(', ') }}</p>
</div>`,
  },
  {
    id: "imageeditor",
    name: "ImageEditor",
    description:
      "Straighten and crop on the way to an upload: quarter turns, wheel/pinch zoom, drag to pan. `export()` returns the visible region as a Blob, or null when nothing was changed — an untouched picture uploads byte-for-byte rather than a generation worse.",
    components: { LpImageEditor, LpButton, LpSelect },
    state: () => {
      // A deliberately sideways photograph, the case this exists for.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600" viewBox="0 0 900 1600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#1f2937"/><stop offset="1" stop-color="#0b1220"/></linearGradient></defs>
<rect width="900" height="1600" fill="url(#g)"/>
<rect x="120" y="560" width="660" height="440" rx="18" fill="#e5e7eb"/>
<text x="450" y="760" text-anchor="middle" font-family="Inter,system-ui,sans-serif"
 font-size="64" font-weight="700" fill="#111827">MLF-A001</text>
<text x="450" y="840" text-anchor="middle" font-family="Inter,system-ui,sans-serif"
 font-size="44" fill="#374151">24V ⎓ 0.38A</text>
<text x="450" y="1520" text-anchor="middle" font-family="Inter,system-ui,sans-serif"
 font-size="34" fill="rgba(255,255,255,.5)">900 × 1600 — portrait</text>
</svg>`
      const file = new File([svg], "plate.svg", { type: "image/svg+xml" })
      const state = reactive({
        file,
        aspect: "free",
        type: "image/jpeg",
        result: "",
        editor: null as { export: () => Promise<Blob | null> } | null,
        async save() {
          const blob = await state.editor?.export()
          state.result = blob
            ? `${blob.type}, ${(blob.size / 1024).toFixed(1)} KB written`
            : "unchanged — the original is uploaded as it arrived"
        },
      })
      return state
    },
    template: `<div class="flex flex-col gap-3" style="max-width: 22rem">
  <LpSelect
    v-model="aspect"
    :options="[
      { value: 'free', label: 'free' },
      { value: 'square', label: 'square' },
      { value: '4:3', label: '4:3' },
      { value: '3:4', label: '3:4' },
      { value: '16:9', label: '16:9' },
    ]"
  />
  <LpSelect
    v-model="type"
    :options="[
      { value: 'image/jpeg', label: 'JPEG' },
      { value: 'image/png', label: 'PNG' },
      { value: 'image/webp', label: 'WebP' },
      { value: 'source', label: 'source (SVG → PNG)' },
    ]"
  />
  <LpImageEditor :ref="(el) => (editor = el)" :file="file" :aspect="aspect" :type="type" />
  <LpButton size="sm" @click="save">Export</LpButton>
  <p v-if="result" class="text-xs text-muted">{{ result }}</p>
</div>`,
  },
]
