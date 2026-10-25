import { reactive } from "vue"
import {
  LpTooltipProvider,
  LpAlert,
  LpAvatar,
  LpBadge,
  LpButton,
  LpCard,
  LpDivider,
  LpCodeBlock,
  LpEmptyState,
  LpIcon,
  LpInput,
  LpLink,
  LpPopover,
  LpScrollArea,
  LpSection,
  LpShift,
  LpSkeleton,
  LpSwitch,
  LpTooltip,
} from "../../../src"
import avatarSample from "../../assets/avatar-sample.png"
import { type ComponentEntry } from "./shared"

export const basics: ComponentEntry[] = [
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
    thumb: `<div class="flex flex-col items-center gap-2">
  <div class="flex items-center gap-2">
    <LpButton variant="solid">Solid</LpButton>
    <LpButton variant="outline">Outline</LpButton>
    <LpButton variant="danger">Danger</LpButton>
  </div>
  <div class="flex items-center gap-2">
    <LpButton variant="soft" size="sm">Soft</LpButton>
    <LpButton variant="ghost" size="sm">Ghost</LpButton>
    <LpButton glow variant="solid" size="sm">Glow</LpButton>
  </div>
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
    thumb: `<div class="flex max-w-64 flex-wrap justify-center gap-2">
  <LpBadge tone="brand" dot>Online</LpBadge>
  <LpBadge tone="success" dot>Healthy</LpBadge>
  <LpBadge tone="action">Active</LpBadge>
  <LpBadge tone="danger" dot>Error</LpBadge>
  <LpBadge tone="neutral">Draft</LpBadge>
  <LpBadge tone="outline">v2.4</LpBadge>
</div>`,
  },
  {
    id: "card",
    name: "Card",
    description:
      "Surface container in raised / flat / ghost. Pass `menuItems` for a right-click menu, headed by `menuTitle` / `menuSubtitle` (items arriving late no longer remount the card's content). `loading` keeps the surface and pulses a skeleton in place of the content (a few lines by default, or the `#loading` slot written as the real layout with `.lp-skeleton-item` blocks); the swap to the content eases its height. `accent` draws a stripe down the leading edge in ANY CSS colour — for a value that arrives from data (a Discord role colour, a per-project hex) rather than from the palette; it costs no layout, so accented and plain cards line their content up.",
    components: { LpCard, LpSwitch },
    state: () =>
      reactive({
        loading: false,
        cardMenu: [
          { label: "Rename", icon: "lucide:pencil" },
          { label: "Duplicate", icon: "lucide:copy" },
          { label: "Delete", icon: "lucide:trash-2", danger: true, separatorBefore: true },
        ],
      }),
    template: `<div class="flex flex-col gap-3">
  <label class="flex items-center gap-2 text-sm text-muted"><LpSwitch v-model="loading" /> Loading</label>
  <div class="grid w-full grid-cols-3 gap-3">
    <LpCard :loading="loading">Raised</LpCard>
    <LpCard variant="flat" :loading="loading">
      Flat
      <template #loading><div class="lp-skeleton-item h-5 w-12 rounded-control" /></template>
    </LpCard>
    <LpCard variant="flat" interactive :menu-items="cardMenu" menu-title="Project card" menu-subtitle="ger-01-p">Right-click me</LpCard>
  </div>
  <div class="grid w-full grid-cols-3 gap-3">
    <LpCard accent="#5865F2">accent="#5865F2"</LpCard>
    <LpCard accent="var(--color-action)">accent="var(--color-action)"</LpCard>
    <LpCard accent="#eb459e" accent-width="6px" interactive>accent-width="6px"</LpCard>
  </div>
</div>`,
    thumb: `<div class="grid w-64 grid-cols-2 gap-3">
  <LpCard class="text-sm">Raised</LpCard>
  <LpCard variant="flat" class="text-sm">Flat</LpCard>
  <LpCard accent="#5865F2" class="col-span-2 text-sm">Accent stripe</LpCard>
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
    thumb: `<div class="flex items-center gap-3">
  <LpAvatar size="lg" :src="avatarSample" alt="THEROER" ring />
  <LpAvatar size="md" :src="avatarSample" alt="THEROER" shape="soft" />
  <LpAvatar size="md" fallback="LP" />
  <LpAvatar size="md" icon="lucide:globe" shape="soft" />
  <LpAvatar size="sm" alt="Ada Lovelace" />
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
    thumb: `<div class="w-72">
  <LpCodeBlock :model-value="py" lang="python" />
</div>`,
  },
  {
    id: "emptystate",
    name: "EmptyState",
    description: "Placeholder for empty lists.",
    components: { LpEmptyState, LpButton },
    template: `<LpEmptyState icon="lucide:inbox" title="No servers yet" description="Add your first server to start monitoring.">
  <LpButton variant="solid" size="sm">Add server</LpButton>
</LpEmptyState>`,
    thumb: `<LpEmptyState icon="lucide:inbox" title="No servers yet" description="Add your first server." class="py-2">
  <LpButton variant="solid" size="sm">Add server</LpButton>
</LpEmptyState>`,
  },
  {
    id: "skeleton",
    thumbState: false,
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
    thumb: `<LpSkeleton class="flex w-64 items-center gap-3">
  <div class="lp-skeleton-item size-10 shrink-0 rounded-pill bg-surface-soft" />
  <div class="flex min-w-0 flex-1 flex-col gap-1.5">
    <div class="lp-skeleton-item h-3.5 w-28 rounded-control bg-surface-soft" />
    <div class="lp-skeleton-item h-3 w-full rounded-control bg-surface-soft" />
    <div class="lp-skeleton-item h-3 w-2/3 rounded-control bg-surface-soft" />
  </div>
</LpSkeleton>`,
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
    thumb: `<LpCard class="w-72">
  <LpSection as="h3" level="sm" title="Billing" description="Invoices and your plan.">
    <template #actions><LpButton size="sm" variant="outline">Add card</LpButton></template>
  </LpSection>
</LpCard>`,
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
    thumb: `<div class="flex w-60 flex-col gap-2">
  <LpLink href="#">Default link</LpLink>
  <LpDivider label="or" />
  <LpLink href="#" external>External link</LpLink>
  <LpLink href="#" tone="muted">Muted link</LpLink>
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
    thumb: `<div class="flex flex-col items-center gap-1.5">
  <div class="rounded-control border border-line bg-surface-overlay px-2.5 py-1.5 text-xs text-ink shadow-panel">Delete instance</div>
  <LpButton variant="outline" square aria-label="Delete instance"><LpIcon name="lucide:trash-2" :size="16" /></LpButton>
</div>`,
  },
  {
    id: "popover",
    name: "Popover",
    description:
      "Anchored overlays. Popover takes side/align, `side-offset`, `panel-class` (width/padding/overflow, merged so `w-72 p-0` replaces the default width and padding) and a controllable `v-model:open`; left unbound it stays uncontrolled.",
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
    panel-class="w-72 p-5"
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
    thumb: `<div class="flex flex-col items-center gap-1.5">
  <LpButton variant="outline" size="sm">Open popover</LpButton>
  <div class="w-56 rounded-control border border-line bg-surface-overlay p-3 text-sm shadow-panel">
    <p class="font-semibold text-ink">Popover content</p>
    <p class="mt-1 text-xs text-muted">Anchored to its trigger.</p>
  </div>
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
    thumb: `<LpScrollArea fade class="h-32 w-56 rounded-card border border-line" content-class="flex flex-col gap-1.5 p-2">
  <p v-for="i in 8" :key="i" class="m-0 rounded-md bg-surface-soft px-3 py-1.5 text-xs text-muted">Row {{ i }}</p>
</LpScrollArea>`,
  },
  {
    id: "alert",
    name: "Alert",
    description:
      "Inline callout with info/success/warning/danger variants, an auto icon (overridable), and an optional title. The difference between them that you cannot see is what a screen reader does: only `danger` interrupts it (role=\"alert\"), the rest are read when the reader reaches them, so a page that opens with an info banner does not shout it. An alert that appears later, like \"Settings saved\" below, takes `live=\"polite\"` to be announced once the reader is free; `live=\"assertive\"` interrupts, `false` stays quiet. The line under each example spells out what the reader does. A `class` is merged into the variant's own, so `p-3` or `rounded-control` replaces the default rather than racing it.",
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
    thumb: `<div class="flex w-72 flex-col gap-2">
  <LpAlert variant="info" title="Heads up">Invoice due in 3 days.</LpAlert>
  <LpAlert variant="success">Payment received.</LpAlert>
</div>`,
  },
]
