import { reactive } from "vue"
import {
  LpBadge,
  LpButton,
  LpCodeDisplay,
  LpCopyButton,
  LpDataList,
  LpEditable,
  LpSecretField,
  LpSlider,
  LpSwitch,
  LpTruncate,
} from "../../../src"
import type { ComponentEntry } from "./shared"

// Fields and text: components built from ideas seen in other kits, written from scratch.
// Each array lands in the section it is named after (see registry.ts).

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const fieldsBasics: ComponentEntry[] = [
  {
    id: "copy-button",
    name: "CopyButton",
    description:
      "The kit's one copy button: the icon morphs into a tick and back, the tip says Copy then Copied, and a refused clipboard is a state, not an exception. Copies a string or what a (possibly async) function returns.",
    components: { LpCopyButton, LpTruncate },
    state: () => reactive({
      address: "play.leavepulse.net:25565",
      fetched: "",
      failures: 0,
      token: async () => {
        await wait(600)
        return "lp_live_9f2c41aa07be"
      },
      broken: () => {
        throw new Error("No token yet")
      },
    }),
    template: `<div class="flex w-96 flex-col gap-4">
  <div class="flex items-center gap-2 rounded-control border border-line bg-surface-soft px-3 py-2 text-sm">
    <span class="min-w-0 flex-1 truncate font-mono">{{ address }}</span>
    <LpCopyButton :value="address" />
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <LpCopyButton :value="address" variant="soft" size="md" label="Copy address" />
    <LpCopyButton :value="token" variant="outline" label="Fetch and copy" @copied="fetched = $event" />
    <LpCopyButton :value="broken" variant="muted" @error="failures++" />
  </div>
  <p class="text-xs text-muted">Fetched: {{ fetched || "—" }} · failures: {{ failures }}</p>
</div>`,
    thumb: `<div class="flex items-center gap-3">
  <div class="flex w-44 items-center gap-2 rounded-control border border-line bg-surface-soft px-3 py-2 text-sm">
    <span class="min-w-0 flex-1 truncate font-mono">play.leavepulse.net</span>
    <LpCopyButton value="play.leavepulse.net" :copied="tCopied" />
  </div>
  <LpCopyButton value="x" variant="soft" size="md" :copied="!tCopied" label="Copy" />
</div>`,
    thumbLoop: { every: 1600, frames: [{ tCopied: false }, { tCopied: true }] },
  },
  {
    id: "truncate",
    name: "Truncate",
    description:
      "Cuts text with an ellipsis (one line or several) and shows the whole of it in a tip only when something was actually cut, measured as the box resizes. Middle mode keeps both ends of ids, paths and hashes.",
    components: { LpTruncate, LpSlider },
    state: () => reactive({ width: 220 }),
    template: `<div class="flex w-full max-w-sm flex-col gap-4">
  <div class="flex items-center gap-2 text-xs text-muted">
    <span>Width</span>
    <LpSlider v-model="width" :min="80" :max="380" aria-label="Text width" class="min-w-0 flex-1" />
    <output class="w-10 text-right tabular-nums">{{ width }}px</output>
  </div>
  <div class="flex max-w-full flex-col gap-3 rounded-card border border-line p-3 text-sm" :style="{ width: width + 'px' }">
    <LpTruncate text="Survival — Frankfurt #2 (whitelist, 1.21)" />
    <LpTruncate text="/srv/minecraft/world/region/r.12.-4.mca" middle :tail="10" class="font-mono text-xs" />
    <LpTruncate text="sha256:4b2f9c0d1e7a83b56f20c9e1aa7d3f5e8b104c62" middle copyable class="font-mono text-xs" />
    <LpTruncate :lines="2" class="text-muted" text="A long description wraps onto a second line and is cut at the end of it; hover it to read the rest, but only when something was cut." />
  </div>
</div>`,
    thumb: `<div class="flex flex-col gap-2 overflow-hidden rounded-card border border-line p-3 text-sm transition-[width] duration-700" :style="{ width: tWidth + 'px' }">
  <LpTruncate text="Survival — Frankfurt #2 (whitelist)" no-tooltip />
  <LpTruncate text="/srv/minecraft/world/region/r.12.-4.mca" middle :tail="10" no-tooltip class="font-mono text-xs" />
  <LpTruncate text="sha256:4b2f9c0d1e7a83b56f20c9e1aa7d3f5e8b104c62" middle no-tooltip class="font-mono text-xs" />
</div>`,
    thumbLoop: { every: 1800, frames: [{ tWidth: 260 }, { tWidth: 170 }] },
  },
]

export const fieldsForms: ComponentEntry[] = [
  {
    id: "secret-field",
    name: "SecretField",
    description:
      "An API key, token or recovery code: masked by default, revealed with a blur-in, copyable while hidden, optionally hiding itself again after N seconds (or when the tab goes to the background), with a regenerate action. The input form is LpPasswordInput.",
    components: { LpSecretField },
    state: () => {
      const state = reactive({
        token: "lp_live_7Hq2xR9vKm4TzW8nB3cYpL6d",
        secret: "whsec_02c9f1",
        revealed: false,
        rotate: async () => {
          await wait(700)
          state.token = `lp_live_${Math.random().toString(36).slice(2, 14)}${Math.random().toString(36).slice(2, 14)}`
        },
      })
      return state
    },
    template: `<div class="flex w-96 flex-col gap-4">
  <LpSecretField label="Bot token" :value="token" :auto-hide="8" :regenerate="rotate" v-model:revealed="revealed" hint="Hides itself after 8 seconds." />
  <LpSecretField label="Webhook secret" v-model="secret" input />
  <LpSecretField value="4F7K-9QX2-PL3M-ZT8W" wrap size="sm" :revealable="false" />
  <LpSecretField label="Recovery email token" placeholder="Not generated yet" />
  <p class="text-xs text-muted">revealed: {{ revealed }}</p>
</div>`,
    thumb: `<div class="flex w-72 flex-col gap-2">
  <LpSecretField value="lp_live_7Hq2xR9vKm4TzW8nB3cYpL6d" :revealed="tShown" :auto-hide="tShown ? 2 : undefined" />
  <LpSecretField value="whsec_02c9f1aa" size="sm" :revealed="!tShown" />
</div>`,
    thumbLoop: { every: 2000, frames: [{ tShown: false }, { tShown: true }] },
  },
  {
    id: "editable",
    name: "Editable",
    description:
      "Text edited where it stands: click, Enter or F2 to edit, Enter or leaving commits, Escape cancels. Saving is optimistic; a failed save reopens the field with what was typed and the error under it.",
    components: { LpEditable, LpBadge },
    state: () => {
      let calls = 0
      return reactive({
        name: "Survival — Frankfurt",
        motd: "Welcome! Be nice.\nNo griefing.",
        tag: "",
        save: async (value: string) => {
          await wait(600)
          calls++
          if (calls % 3 === 0) throw new Error("The server didn't answer, try again")
          return value
        },
        validate: (value: string) => (value.length > 32 ? "Up to 32 characters" : true),
      })
    },
    template: `<div class="flex w-96 flex-col gap-4">
  <div class="flex items-center gap-2">
    <LpEditable v-model="name" label="Server name" :save="save" :validate="validate" size="lg" class="font-semibold" required />
    <LpBadge tone="success" size="sm" dot>Online</LpBadge>
  </div>
  <LpEditable v-model="motd" label="Message of the day" multiline :save="save" class="text-muted" />
  <LpEditable v-model="tag" label="Tag" placeholder="Add a tag" size="sm" />
  <LpEditable model-value="Read-only text" readonly />
  <p class="text-xs text-muted">Every third save fails. Name: {{ name }}</p>
</div>`,
    thumb: `<div class="flex w-64 flex-col gap-2">
  <div class="flex items-center gap-2">
    <LpEditable :model-value="tName" label="Server name" size="lg" class="font-semibold" />
    <LpBadge tone="success" size="sm" dot>Online</LpBadge>
  </div>
  <LpEditable model-value="Welcome! Be nice." class="text-muted" />
  <LpEditable model-value="" placeholder="Add a tag" size="sm" />
</div>`,
    thumbLoop: { every: 1800, frames: [{ tName: "Survival" }, { tName: "Creative" }, { tName: "Skyblock" }] },
  },
  {
    id: "code-display",
    name: "CodeDisplay",
    description:
      "A short code shown to be read or typed elsewhere: big grouped monospace characters, copy without separators, optional masking, a countdown to expiry and an \"I've saved this\" confirmation. Not an input (OtpInput) and not source (CodeBlock).",
    components: { LpCodeDisplay, LpButton },
    state: () => {
      const fresh = () => String(Math.floor(100000 + Math.random() * 900000))
      const state = reactive({
        code: fresh(),
        expires: Date.now() + 30_000,
        issued: Date.now(),
        saved: false,
        refresh: () => {
          state.code = fresh()
          state.issued = Date.now()
          state.expires = Date.now() + 30_000
        },
      })
      return state
    },
    template: `<div class="flex flex-col gap-6">
  <div class="flex flex-col gap-2">
    <span class="text-xs text-muted">Sign-in code</span>
    <LpCodeDisplay :code="code" :expires-at="expires" :issued-at="issued" @expired="refresh" />
    <LpButton variant="soft" size="sm" class="self-start" @click="refresh">New code</LpButton>
  </div>
  <div class="flex flex-col gap-2">
    <span class="text-xs text-muted">Recovery key</span>
    <LpCodeDisplay code="K7QF29XMPL4D8WNA" separator="-" masked ack v-model:saved="saved" size="sm" />
    <LpButton :disabled="!saved" size="sm" class="self-start">Continue</LpButton>
  </div>
</div>`,
    thumb: `<div class="flex flex-col gap-3">
  <LpCodeDisplay :code="tCode" :copyable="false" />
  <LpCodeDisplay code="K7QF29XMPL4D" separator="-" masked :revealed="tShown" size="sm" :copyable="false" />
</div>`,
    thumbLoop: {
      every: 2000,
      frames: [
        { tCode: "482913", tShown: false },
        { tCode: "907364", tShown: true },
      ],
    },
  },
]

export const fieldsData: ComponentEntry[] = [
  {
    id: "data-list",
    name: "DataList",
    description:
      "Label and value pairs as a real description list: side by side when the list itself is wide enough, stacked when it is not (a container query), values that change roll, copy buttons on hover, a placeholder for empty values.",
    components: { LpDataList, LpSlider, LpSwitch, LpButton },
    state: () => {
      const state = reactive({
        width: 420,
        online: 12,
        divided: true,
        bump: () => (state.online = Math.max(0, state.online + Math.round(Math.random() * 8 - 4))),
      })
      return state
    },
    template: `<div class="flex w-full max-w-md flex-col gap-4">
  <div class="flex flex-wrap items-center gap-3">
    <div class="flex min-w-40 flex-1 items-center gap-2 text-xs text-muted">
      <span>Width</span>
      <LpSlider v-model="width" :min="220" :max="448" aria-label="Card width" class="min-w-0 flex-1" />
      <output class="w-10 text-right tabular-nums">{{ width }}px</output>
    </div>
    <LpSwitch v-model="divided" label="Dividers" />
    <LpButton size="xs" variant="outline" @click="bump()">Players ±</LpButton>
  </div>
  <div class="max-w-full rounded-card border border-line bg-surface px-4 py-1" :style="{ width: width + 'px' }">
    <LpDataList
      :divided="divided"
      :items="[
        { label: 'Address', value: 'play.leavepulse.net:25565', mono: true, copyable: true },
        { label: 'Region', value: 'Frankfurt (eu-central)' },
        { label: 'Players', value: online + ' / 40' },
        { label: 'Version', value: '1.21.4', mono: true, hint: 'Clients on older versions are refused.' },
        { label: 'Server id', value: 'srv_01HZX4Q8M2', mono: true, copyable: true },
        { label: 'Backup', value: null },
      ]"
    />
  </div>
</div>`,
    thumb: `<div class="w-72 rounded-card border border-line bg-surface px-3 py-0.5">
  <LpDataList
    size="sm"
    divided
    layout="horizontal"
    :items="[
      { label: 'Address', value: 'play.leavepulse.net', mono: true },
      { label: 'Region', value: 'Frankfurt' },
      { label: 'Players', value: tPlayers },
      { label: 'Backup', value: null },
    ]"
  />
</div>`,
    thumbLoop: { every: 1600, frames: [{ tPlayers: "12 / 40" }, { tPlayers: "15 / 40" }, { tPlayers: "9 / 40" }] },
  },
]

export const fieldsOverlays: ComponentEntry[] = []
export const fieldsMotion: ComponentEntry[] = []
