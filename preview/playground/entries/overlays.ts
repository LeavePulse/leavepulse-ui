import { reactive } from "vue"
import {
  confirm,
  LpBadge,
  LpButton,
  LpConfirmDialog,
  LpShortcutsDialog,
  LpDrawer,
  LpIcon,
  LpInput,
  LpKeys,
  LpModal,
  LpModalNav,
  LpNotificationBell,
  LpSwitch,
  LpSegmented,
  LpSidebar,
  useHotkeys,
  useToast,
} from "../../../src"
import { CustomSheet, LayerKeys } from "../demos"
import { type ComponentEntry, EditorKeys, SequenceKeys, PendingKeys, SaveKeys } from "./shared"

export const overlays: ComponentEntry[] = [
  {
    id: "notificationbell",
    name: "NotificationBell",
    description:
      "Icon button with an unread badge that opens a popover feed on left-click; right-click for quick actions (Mark all read; override via `menuItems`). Each feed row has its own right-click menu (mark read/unread, open, dismiss). Data-driven: bind items / unread-count and handle mark-read / mark-unread / mark-all-read / dismiss / select — no fetching inside. Rows are rounded tiles showing icon, title, body, relative time and an unread dot. `tone` per item tints the icon by category (billing, security, …) while it is unread; a read row always goes muted.",
    components: { LpNotificationBell, LpIcon, LpBadge },
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
    thumb: `<div class="flex items-start gap-2">
  <div class="relative grid size-8 place-items-center rounded-control text-ink">
    <LpIcon name="lucide:bell" :size="18" />
    <LpBadge tone="danger" class="absolute -right-1 -top-1 min-w-4 justify-center px-1 py-0 text-[10px] leading-4">2</LpBadge>
  </div>
  <div class="w-60 rounded-control border border-line bg-surface-overlay shadow-panel">
    <div class="flex items-center justify-between px-3 py-2"><span class="text-sm font-semibold text-ink">Notifications</span><span class="text-xs font-medium text-brand">Mark all read</span></div>
    <div class="flex flex-col gap-0.5 px-2 pb-2">
      <div class="flex items-start gap-2.5 rounded-control bg-brand-soft/35 px-2 py-1.5">
        <span class="grid size-7 shrink-0 place-items-center rounded-control bg-action-soft text-action"><LpIcon name="lucide:check-circle" :size="15" /></span>
        <span class="min-w-0 flex-1"><span class="flex items-center gap-1.5"><span class="truncate text-sm font-medium text-ink">Payment received</span><span class="size-1.5 shrink-0 rounded-full bg-brand" /></span><span class="block text-[11px] text-muted/70">2 min ago</span></span>
      </div>
      <div class="flex items-start gap-2.5 rounded-control px-2 py-1.5">
        <span class="grid size-7 shrink-0 place-items-center rounded-control bg-surface-soft text-muted"><LpIcon name="lucide:receipt-text" :size="15" /></span>
        <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium text-muted-strong">Invoice available</span><span class="block text-[11px] text-muted/70">2 days ago</span></span>
      </div>
    </div>
  </div>
</div>`,
  },
  {
    id: "toast",
    thumbState: false,
    name: "Toast",
    description:
      "Stackable notifications via the useToast() composable (a global singleton). LpToaster is mounted once at the app root; anywhere can call toast.success(...) etc. Hover pauses the countdown; toasts support a title, action buttons, a whole-toast click, and duration:0 to persist. `toast.promise(task, { loading, success, error })` shows one toast that follows a promise, and a `key` makes a toast replace the one on screen with the same key instead of stacking. An Error can be passed straight to `error()`/`warning()`; its `details` (or `details` in options, or the `cause` behind a hand-written message) are not shown but ride along to the copy button, so a copied error carries the request, status and ids a bug report needs. A failed `toast.promise` keeps the error's details the same way, and details are also found through a native `Error.cause` chain.",
    components: { LpButton, LpIcon },
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
    thumb: `<div class="flex w-64 flex-col gap-2">
  <div class="relative flex items-start gap-3 overflow-hidden rounded-card border border-line bg-surface-raised shadow-panel p-3">
    <LpIcon name="lucide:check-circle" :size="16" class="mt-0.5 shrink-0 text-action" />
    <div class="flex min-w-0 flex-1 flex-col gap-0.5"><span class="text-sm font-semibold text-ink">Profile updated</span><span class="text-xs text-muted">Saved</span></div>
    <LpIcon name="lucide:x" :size="14" class="text-muted" />
    <span class="absolute inset-x-0 bottom-0 h-0.5 w-2/3 bg-action" />
  </div>
  <div class="flex items-start gap-3 rounded-card border border-line bg-surface-raised shadow-panel p-3">
    <LpIcon name="lucide:circle-x" :size="16" class="mt-0.5 shrink-0 text-danger" />
    <div class="flex min-w-0 flex-1 flex-col gap-0.5"><span class="text-sm font-semibold text-ink">Billing failed</span><span class="text-xs text-muted">Upstream timed out</span></div>
    <LpIcon name="lucide:x" :size="14" class="text-muted" />
  </div>
</div>`,
  },
  {
    id: "modal",
    name: "Modal",
    description: "Dialog with overlay, title and footer. size=sm…xl|2xl|3xl|full (or width=\"…\"); long content scrolls inside. A body that arrives late resizes the panel smoothly instead of snapping — see the second example. `guard` asks before closing when something would be lost (`:guard=\"form.dirty\"`, or a function for the app's own question), and also warns on leaving the page; the footer and body slots get a `close` that goes through the guard, for the app's own Cancel button (Drawer has the same); `:dismissible=\"false\"` keeps Escape and the scrim from closing a step the user must finish on purpose. `glass` trades the solid panel for frosted glass over a lighter scrim (also on Drawer, CommandPalette and the dialogs built on Modal) — see the third. Without a title, `aria-label` names the dialog (Drawer and Popover take it too). A custom overlay joins the same stack with `useModalLayer()`, and page-level hotkeys stay quiet while a modal covers them unless they set `overLayers` — see the bottom of the example. Unset, it follows `provideGlass()` from an ancestor, so an app that wants every overlay frosted says it once at its root; an explicit `:glass=\"false\"` still wins.",
    components: { LpModal, LpButton, CustomSheet, LayerKeys, LpIcon },
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
    <template #footer="{ close }">
      <LpButton variant="ghost" @click="close">Cancel</LpButton>
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
    thumb: `<div class="w-72 rounded-card border border-line bg-surface-raised shadow-panel">
  <div class="flex items-start justify-between gap-4 p-4 pb-2">
    <div class="flex flex-col gap-0.5"><span class="text-base font-semibold text-ink">Confirm action</span><span class="text-xs text-muted">A token-driven modal.</span></div>
    <LpIcon name="lucide:x" :size="16" class="text-muted" />
  </div>
  <p class="m-0 px-4 text-sm text-ink/90">Escape or a click outside closes it.</p>
  <div class="flex justify-end gap-2 p-4 pt-3">
    <LpButton size="sm" variant="ghost">Cancel</LpButton>
    <LpButton size="sm" variant="solid">Confirm</LpButton>
  </div>
</div>`,
  },
  {
    id: "modal-nav",
    name: "ModalNav",
    description: "A dialog whose sections stand beside it: settings, a profile, a wizard you can skip around in. Takes LpSidebar's `items` or grouped `sections`; `navSide` moves the rail to the other side. Below `mobileBreakpoint` (default lg) it folds into a drawer the header's button opens. The `actions` slot (also on LpModal) puts controls for the whole dialog, such as a period, beside the close button.",
    components: { LpModalNav, LpButton, LpSegmented, LpIcon },
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
    thumb: `<div class="flex items-start gap-2">
  <div class="flex w-24 flex-col gap-0.5 rounded-card border border-line bg-surface-raised p-1 text-xs shadow-panel">
    <span class="flex items-center gap-1.5 rounded-inner bg-brand-soft px-2 py-1.5 text-brand"><LpIcon name="lucide:activity" :size="13" />Activity</span>
    <span class="flex items-center gap-1.5 px-2 py-1.5 text-ink"><LpIcon name="lucide:mic" :size="13" />Voice</span>
    <span class="flex items-center gap-1.5 px-2 py-1.5 text-ink"><LpIcon name="lucide:star" :size="13" />Reviews</span>
  </div>
  <div class="w-44 rounded-card border border-line bg-surface-raised shadow-panel p-3">
    <div class="flex items-start justify-between gap-2"><span class="text-sm font-semibold text-ink">Staff member</span><LpIcon name="lucide:x" :size="14" class="text-muted" /></div>
    <p class="mt-1.5 text-xs text-muted">Sections stay in view while you read one.</p>
    <div class="mt-3 flex justify-end"><LpButton size="sm" variant="ghost">Close</LpButton></div>
  </div>
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
    thumb: `<div class="w-64 rounded-card border border-line bg-surface-raised shadow-panel p-4">
  <p class="m-0 text-base font-semibold text-ink">Delete server?</p>
  <p class="m-0 mt-1 text-sm text-muted">This cannot be undone.</p>
  <div class="mt-4 flex justify-end gap-2">
    <LpButton size="sm" variant="ghost">Cancel</LpButton>
    <LpButton size="sm" variant="danger">Delete</LpButton>
  </div>
</div>`,
  },
  {
    id: "shortcuts-dialog",
    name: "ShortcutsDialog",
    description:
      "Keyboard reference, conventionally on F1: `hotkey=\"F1\"` binds it (and lists it). `groups` is the written list: keys that are not bindings (arrows in a list) and the ones worth knowing before their screen opens. `live` adds every mounted useHotkeys binding that carries `help`, so a screen documents its own keys while it is open: mount the editor below and its section appears. Same-titled groups merge and a combo is listed once. Combos split on \"+\" into one <kbd> each, and Ctrl/Alt print as ⌘/⌥ on Apple keyboards.",
    components: { LpShortcutsDialog, LpButton, LpSwitch, EditorKeys, SequenceKeys, SaveKeys, PendingKeys, LpKeys },
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
    thumb: `<div class="w-64 rounded-card border border-line bg-surface-raised shadow-panel p-4">
  <p class="m-0 text-sm font-semibold text-ink">Keyboard shortcuts</p>
  <p class="m-0 mt-2 text-[11px] font-medium uppercase tracking-wide text-muted">Navigation</p>
  <div class="mt-1.5 flex flex-col gap-1.5 text-sm text-ink">
    <div class="flex items-center justify-between"><span>Command palette</span><LpKeys combo="Ctrl+K" size="sm" /></div>
    <div class="flex items-center justify-between"><span>Search</span><LpKeys combo="Ctrl+F" size="sm" /></div>
    <div class="flex items-center justify-between"><span>Back</span><LpKeys combo="Alt+←" size="sm" /></div>
  </div>
</div>`,
  },
  {
    id: "drawer",
    name: "Drawer",
    description:
      "Drag-driven panel on vaul-vue: drag-to-dismiss with inertia, snap points, a grab handle and an optional scale-background. direction=top|bottom|left|right (side=left|right still works), size=sm…xl or width=\"…\", snapPoints, dismissible, handleOnly, scaleBackground. Interactive controls inside are auto-excluded from the drag (noDragControls, on by default) so you can select text / use inputs; noDragContent makes the whole body non-draggable (handle/header only). `resizable` with `persist` remembers the width the user dragged to across visits (in the kit's storage, see usePersisted); `guard` asks before closing when something would be lost, and while it is set the drawer closes by its button, the scrim or Escape, not by a swipe.",
    components: { LpDrawer, LpButton, LpInput, LpIcon },
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
    thumb: `<div class="relative h-36 w-72 overflow-hidden rounded-card border border-line bg-surface-soft">
  <div class="absolute inset-0 bg-black/30" />
  <div class="absolute inset-y-0 right-0 flex w-44 flex-col gap-2 border-l border-line bg-surface-raised p-3 shadow-panel">
    <div class="flex items-center justify-between"><span class="text-sm font-semibold text-ink">Filters</span><LpIcon name="lucide:x" :size="14" class="text-muted" /></div>
    <LpInput size="sm" placeholder="Search filters…" />
    <div class="h-2 w-3/4 rounded-pill bg-surface-soft" />
    <div class="h-2 w-1/2 rounded-pill bg-surface-soft" />
  </div>
</div>`,
  },
]
