import { reactive } from "vue"
import {
  LpActionBar,
  LpAvatar,
  LpBadge,
  LpBreadcrumbs,
  LpButton,
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
  LpDropdownMenu,
  LpIcon,
  LpModal,
  LpSkeleton,
  LpStepper,
  LpSwitch,
  LpTableOfContents,
  LpSidebar,
  LpTabs,
  contextMenuTip,
  hints,
  useGamepadNav,
} from "../../../src"
import avatarSample from "../../assets/avatar-sample.png"
import { type ComponentEntry, GamepadNav, tabItems, bottomTabItems } from "./shared"

export const navigation: ComponentEntry[] = [
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
    thumb: `<div class="flex w-72 flex-col gap-3">
  <LpTabs :model-value="tTab" :items="items" />
  <div class="overflow-hidden rounded-card border border-line">
    <LpTabs :model-value="tNav" :items="navItems" variant="bottom" accent label="Main" />
  </div>
</div>`,
    thumbLoop: { every: 1600, frames: [{ tTab: "a", tNav: "inbox" }, { tTab: "b", tNav: "search" }, { tTab: "a", tNav: "settings" }, { tTab: "b", tNav: "home" }] }
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
      persist="preview-sidebar"
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
    thumb: `<LpSidebar
  :model-value="tPage"
  variant="panel"
  width="13rem"
  :sections="[{ items: [
    { id: 'server', label: 'Server', icon: 'lucide:server', badge: 2 },
    { id: 'logs', label: 'Logs', icon: 'lucide:scroll-text' },
    { id: 'economy', label: 'Economy', icon: 'lucide:coins', badge: 5 },
  ] }]"
/>`,
    thumbLoop: { every: 1500, frames: [{ tPage: "server" }, { tPage: "logs" }, { tPage: "economy" }] }
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
    thumb: `<div class="w-72">
  <LpStepper :steps="steps" :current="tStep" />
</div>`,
    thumbLoop: { every: 1500, frames: [{ tStep: 1 }, { tStep: 2 }, { tStep: 0 }] }
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
    thumb: `<LpBreadcrumbs :items="tTrail" />`,
    thumbLoop: {
      every: 1800,
      frames: [
        { tTrail: [{ label: "Home", href: "#" }, { label: "Servers", href: "#" }, { label: "ger-01-p" }] },
        { tTrail: [{ label: "Home", href: "#" }, { label: "Servers", href: "#" }, { label: "ger-01-p", href: "#" }, { label: "Logs" }] },
        { tTrail: [{ label: "Home", href: "#" }, { label: "Servers" }] },
      ],
    },
  },
  {
    id: "dropdown",
    name: "DropdownMenu",
    description: "Action menu with icons and danger items. Its items are ContextMenu items drawn by the same renderer, so one array serves a row's \"…\" button and its right click alike: submenus (`children`), tick-box items (`checked`, the menu stays open) and shortcut hints (LpKeys: \"Ctrl+D\" reads ⌘D on a Mac) all show in both. `title`/`subtitle`/`titleIcon` head the menu with what it acts on. `rightClickToo` marks a \"…\" button whose items the row also opens on right-click: each use of it counts toward contextMenuTip(), which then tells the user that right-click works there.",
    components: { LpDropdownMenu, LpButton, LpContextMenu, LpIcon, LpKeys },
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
    thumb: `<div class="flex w-56 flex-col items-start gap-1.5">
  <LpButton variant="outline" size="sm">Actions ▾</LpButton>
  <div class="w-full rounded-control border border-line bg-surface-overlay p-1 shadow-panel">
    <div class="flex items-center justify-between gap-3 rounded-inner px-2.5 py-1.5 text-sm transition-colors duration-300" :class="tRow === 0 ? 'bg-brand-soft text-brand' : 'text-ink'"><span class="flex items-center gap-2"><LpIcon name="lucide:pencil" :size="15" />Edit</span><LpKeys combo="Ctrl+E" size="sm" /></div>
    <div class="flex items-center justify-between gap-3 rounded-inner px-2.5 py-1.5 text-sm transition-colors duration-300" :class="tRow === 1 ? 'bg-brand-soft text-brand' : 'text-ink'"><span class="flex items-center gap-2"><LpIcon name="lucide:copy" :size="15" />Duplicate</span><LpKeys combo="Ctrl+D" size="sm" /></div>
    <div class="my-1 h-px bg-line" />
    <div class="flex items-center justify-between gap-3 rounded-inner px-2.5 py-1.5 text-sm text-danger transition-colors duration-300" :class="tRow === 2 ? 'bg-danger-soft' : ''"><span class="flex items-center gap-2"><LpIcon name="lucide:trash-2" :size="15" />Delete</span><LpKeys combo="Del" size="sm" /></div>
  </div>
</div>`,
    thumbLoop: { every: 1500, frames: [{ tRow: 0 }, { tRow: 1 }, { tRow: 2 }, { tRow: 1 }] },
  },
  {
    id: "commandpalette",
    name: "CommandPalette",
    description:
      "⌘K command palette (reka Dialog + Listbox): grouped, searchable commands with icons (or an `image`: a picture in the icon's slot that falls back to initials or the icon when it fails), shortcut hints and keyboard nav. Matches label + keywords. Binds a global ⌘K/Ctrl-K toggle by default. A command with `children` opens a mode — a nested list, static or fetched from the query typed inside it (Backspace or the chip leaves it), or typed straight into with its `prefix` (try \"> web\"); `search` adds results from an API alongside the static ones (it is sent the positive words only, the parsed `-word` and `in:group` operators come as a third argument, and the palette still drops fetched rows they rule out: try \"deploy -secrets\"), and a hit can carry an `excerpt` (the matched passage, wrapped over `excerptLines` lines) plus `highlight` (word forms the server matched, marked alongside the typed query); `previewPane` shows the highlighted hit's `preview` in full beside the list, and folds away for rows that `hasPreview` (or the row's own `noPreview`) turns down; `href` makes a row a real link; Tab lists a row's `actions`; `groupLimit` folds long groups; a `fallback` row (\"Search the catalogue for ...\") shows only while something is typed, labelled with the typed words, and with `carryQuery` its mode opens already searching them; words match in any order, with a typo or the other keyboard layout; `recent` floats what this person actually runs to the top, including picks made inside a mode or among search results (`remember` hands over what to store, `resolveRecent` rebuilds a fetched result from its `recentData`).",
    components: { LpCommandPalette, LpButton, LpPalettePreview, LpPaletteHeader, LpPaletteFacts, LpPaletteStats, LpKeys, LpIcon },
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
    thumb: `<div class="w-72 overflow-hidden rounded-card border border-line bg-surface-raised shadow-panel">
  <div class="flex items-center gap-2 border-b border-line px-3 py-2 text-sm">
    <LpIcon name="lucide:search" :size="15" class="text-muted" />
    <span class="flex-1 text-ink">{{ tQuery }}</span>
    <LpKeys combo="Esc" size="sm" />
  </div>
  <div class="p-1">
    <p class="px-2.5 pb-0.5 pt-1 text-[11px] font-medium text-muted">Actions</p>
    <div class="flex items-center gap-2 rounded-inner px-2.5 py-1.5 text-sm transition-colors duration-300" :class="tRow === 0 ? 'bg-brand-soft text-brand' : 'text-ink'"><LpIcon name="lucide:rocket" :size="15" /><span class="flex-1">Deploy current branch</span></div>
    <div class="flex items-center gap-2 rounded-inner px-2.5 py-1.5 text-sm transition-colors duration-300" :class="tRow === 1 ? 'bg-brand-soft text-brand' : 'text-ink'"><LpIcon name="lucide:plus" :size="15" /><span class="flex-1">New server</span><LpKeys combo="Ctrl+N" size="sm" /></div>
  </div>
</div>`,
    thumbLoop: { every: 1600, frames: [{ tQuery: "dep", tRow: 0 }, { tQuery: "de", tRow: 1 }, { tQuery: "d", tRow: 0 }] },
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
    thumb: `<div class="w-72 rounded-card border border-line bg-surface-raised p-3">
  <LpPalettePreview>
    <LpPaletteHeader eyebrow="Modrinth" title="Sodium" subtitle="by CaffeineMC" :image="{ src: '', fallback: 'So' }" />
    <LpPaletteStats :items="[{ label: 'Downloads', value: tDownloads, compact: true }, { label: 'Follows', value: tFollows }]" />
  </LpPalettePreview>
</div>`,
    thumbLoop: { every: 1900, frames: [{ tDownloads: 1250000, tFollows: 8400 }, { tDownloads: 1362000, tFollows: 8437 }, { tDownloads: 1471000, tFollows: 8474 }] },
  },
  {
    id: "contextmenu",
    name: "ContextMenu",
    description:
      "Right-click menu (reka ContextMenu): icons, shortcut hints (drawn with LpKeys, so \"Ctrl+C\" reads ⌘C on an Apple keyboard), danger items, separators and nested submenus, and an optional \`title\` heading naming what the menu acts on. Right-click (or long-press) the target. With an empty `items` it's a passthrough — the element keeps the browser's native menu — so wrappers like Table/Sidebar/Avatar/Card can pass [] to opt out per element. A left click on an element with a menu counts toward contextMenuTip(); `noHint` leaves an element out of that count (a whole table with only generic items), and table rows with their own menu are what the tip lights.",
    components: { LpContextMenu, LpIcon, LpKeys },
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
    thumb: `<div class="relative h-36 w-72 rounded-card border border-dashed border-line">
  <span class="absolute left-3 top-3 text-xs text-muted">Right-click here</span>
  <div class="absolute bottom-2 right-3 w-48 rounded-control border border-line bg-surface-overlay p-1 shadow-panel">
    <div class="flex items-center gap-2 px-2.5 pb-1.5 pt-1"><span class="grid size-6 place-items-center rounded-inner bg-surface-soft text-muted"><LpIcon name="lucide:server" :size="13" /></span><span class="truncate text-sm font-medium text-ink">api-gateway</span></div>
    <div class="mb-1 h-px bg-line" />
    <div class="flex items-center justify-between gap-3 rounded-inner px-2.5 py-1.5 text-sm transition-colors duration-300" :class="tRow === 0 ? 'bg-brand-soft text-brand' : 'text-ink'"><span class="flex items-center gap-2"><LpIcon name="lucide:copy" :size="15" />Copy</span><LpKeys combo="Ctrl+C" size="sm" /></div>
    <div class="flex items-center justify-between gap-3 rounded-inner px-2.5 py-1.5 text-sm transition-colors duration-300" :class="tRow === 1 ? 'bg-brand-soft text-brand' : 'text-ink'"><span class="flex items-center gap-2"><LpIcon name="lucide:folder-input" :size="15" />Move to</span><LpIcon name="lucide:chevron-right" :size="14" class="text-muted" /></div>
  </div>
</div>`,
    thumbLoop: { every: 1500, frames: [{ tRow: 0 }, { tRow: 1 }] },
  },
  {
    id: "gamepad-nav",
    name: "Gamepad navigation",
    description:
      "useGamepadNav: a game controller drives the page. The D-pad or left stick moves focus to the nearest control in that direction (spatialNav's nextInDirection, inside the open dialog when there is one), A presses it, B closes the open dialog or calls onBack, the bumpers call onPrevious/onNext and Start onMenu, and the right stick scrolls. While a controller is in use the root carries data-input=\"gamepad\" and focus gets a thicker ring.",
    components: { GamepadNav, LpButton, LpModal, LpIcon },
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
    thumb: `<div class="flex items-center gap-4">
  <LpIcon name="lucide:gamepad-2" :size="36" class="text-muted" />
  <div class="grid grid-cols-3 gap-1.5">
    <LpButton v-for="n in 6" :key="n" size="sm" variant="soft" :class="n === tFocus ? 'ring-[3px] ring-ring ring-offset-2 ring-offset-surface' : ''">{{ n }}</LpButton>
  </div>
</div>`,
    thumbLoop: { every: 1400, frames: [{ tFocus: 5 }, { tFocus: 6 }, { tFocus: 3 }, { tFocus: 2 }] },
  },
  {
    id: "actionbar",
    name: "ActionBar",
    description:
      "A bar that rises from the bottom of the viewport to ask for ONE decision and stays until something resolves it — unsaved changes, a cookie notice, a bulk action on a selection. Not a dialog (the page stays usable behind it, no focus trap) and not a toast (it does not leave on a timer). Teleported to the body, so it pins to the viewport wherever it is declared. The last action is the primary one automatically, and several open at once stack instead of covering each other. An action takes LpButton's `action` (the button spins while it runs and a failure becomes an error toast) and `hotkey`: \"Save changes\" below is Ctrl+S while the bar is open.",
    components: { LpActionBar, LpButton, LpIcon },
    state: () => reactive({ dirty: false, cookies: false, selection: false }),
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
      { label: 'Save changes', icon: 'lucide:check', hotkey: 'Ctrl+S', action: async () => {
          await new Promise(r => setTimeout(r, 900))
          dirty = false
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
    thumb: `<div class="flex w-72 items-center gap-3 rounded-card border border-line bg-surface-overlay px-3 py-2.5 shadow-panel">
  <LpIcon name="lucide:pencil-line" :size="18" class="shrink-0 text-brand" />
  <div class="min-w-0 flex-1">
    <p class="truncate text-sm font-medium text-ink">Unsaved changes</p>
    <p class="truncate text-xs text-muted">Leaving discards them.</p>
  </div>
  <LpButton size="sm" variant="ghost">Discard</LpButton>
  <LpButton size="sm">Save</LpButton>
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
    thumb: `<div class="w-48">
  <LpTableOfContents :links="links" />
</div>`,
  },
]
