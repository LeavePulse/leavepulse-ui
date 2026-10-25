import { reactive } from "vue"
import {
  presets,
  LpAddressInput,
  LpAutocomplete,
  LpMapPicker,
  LpBadge,
  LpButton,
  LpCheckbox,
  LpCalendar,
  LpColorPicker,
  LpDatePicker,
  LpDropzone,
  LpFormField,
  LpIcon,
  LpImageEditor,
  LpInput,
  LpNumberField,
  LpRepeater,
  LpTimeField,
  LpOtpInput,
  LpPasswordInput,
  LpPhoneInput,
  LpRadio,
  LpRadioGroup,
  LpSelect,
  LpSlider,
  LpRangeSlider,
  formatClipTime,
  LpSwitch,
  LpSegmented,
  LpTextarea,
  LpDateRangePicker,
  LpRangeCalendar,
  LpTagsInput,
  useForm,
} from "../../../src"
import avatarSample from "../../assets/avatar-sample.png"
import avatarSunny from "../../assets/avatar-sunny.png"
import { RatingControl } from "../demos"
import { type ComponentEntry, selectOpts, radioOpts } from "./shared"

export const forms: ComponentEntry[] = [
  {
    id: "repeater",
    name: "Repeater",
    description: "Repeatable form rows with stable identity, add/remove controls and a slot for each row. Ports and volumes use the same list shell; their fields and validation stay in the application. itemKey preserves identity across immutable reloads; without one, unsaved rows keep their identity without adding keys to your data.",
    components: { LpRepeater, LpInput, LpSelect, LpFormField, LpButton },
    state: () => reactive({
      ports: [{ container: "443", host: "8443", bind: "", proto: "tcp" }],
      volumes: [{ name: "data", mount: "/var/lib/app" }],
      emptyPort: () => ({ container: "", host: "", bind: "", proto: "tcp" }),
      emptyVolume: () => ({ name: "", mount: "" }),
      locked: false,
    }),
    template: `<div class="flex w-full max-w-2xl flex-col gap-6">
  <LpRepeater v-model="ports" :create-item="emptyPort" label="Ports" :disabled="locked">
    <template #default="{ item, disabled }">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <LpInput v-model="item.container" label="Container" inputmode="numeric" :disabled="disabled" />
        <LpInput v-model="item.host" label="Host" inputmode="numeric" :disabled="disabled" />
        <LpInput v-model="item.bind" label="Bind address" :disabled="disabled" />
        <LpFormField label="Protocol"><LpSelect v-model="item.proto" :options="[{value:'tcp',label:'TCP'},{value:'udp',label:'UDP'}]" :disabled="disabled" /></LpFormField>
      </div>
    </template>
  </LpRepeater>
  <LpRepeater v-model="volumes" :create-item="emptyVolume" label="Volumes" :disabled="locked">
    <template #default="{ item, disabled }">
      <div class="grid grid-cols-2 gap-2">
        <LpInput v-model="item.name" label="Name" :disabled="disabled" />
        <LpInput v-model="item.mount" label="Mount path" :disabled="disabled" />
      </div>
    </template>
  </LpRepeater>
  <LpButton variant="outline" @click="locked = !locked">{{ locked ? 'Unlock' : 'Lock' }} lists</LpButton>
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
    thumb: `<div class="flex w-64 flex-col gap-2">
  <LpInput model-value="ada@example.com" label="Email" icon="lucide:mail" />
  <LpInput model-value="admin" error="Already taken" />
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
    thumb: `<div class="flex w-64 flex-col gap-1.5">
  <LpAutocomplete :model-value="tQuery" :options="frameworks" icon="lucide:search" />
  <div class="flex flex-col rounded-control border border-line bg-surface-overlay p-1 text-sm shadow-panel">
    <span v-for="(f, i) in ['Svelte', 'Solid']" :key="f" class="rounded-inner px-2.5 py-1 transition-colors duration-300" :class="i === tRow ? 'bg-brand-soft text-brand' : 'text-ink'">{{ f }}</span>
  </div>
</div>`,
    thumbLoop: { every: 1800, frames: [{ tQuery: "Sv", tRow: 0 }, { tQuery: "So", tRow: 1 }, { tQuery: "S", tRow: 0 }] },
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
    thumb: `<div class="flex w-64 flex-col gap-2">
  <LpSelect :model-value="tPerson" :options="people" />
  <LpSelect :model-value="tTeam" :options="people" multiple />
</div>`,
    thumbLoop: {
      every: 2000,
      frames: [
        { tPerson: "1090027634693525664", tTeam: ["1090027634693525664", "770091071811092481", "3"] },
        { tPerson: "770091071811092481", tTeam: ["1090027634693525664", "770091071811092481"] },
        { tPerson: "4", tTeam: ["770091071811092481", "3", "4"] },
      ],
    },
  },
  {
    id: "switch",
    name: "Switch · Checkbox · Radio",
    description:
      "Boolean and choice controls. LpSwitch and LpCheckbox take a `label` and a `description` (a secondary line the control is described by); LpSwitch also `label-position=\"start\"` for a settings row with the switch at the right edge. LpRadioGroup takes `:options` (each may carry a `description` line, an `icon`, or be `disabled`), or LpRadio children when a row needs custom content. A switch with `action` saves its own state: it flips at once, spins in its thumb while the work runs, and flips back with an error toast if it fails (the last row fails every other time).",
    components: { LpSwitch, LpCheckbox, LpRadioGroup, LpRadio },
    state: () => {
      let saves = 0
      const sync = () => {
        const fail = ++saves % 2 === 0
        return new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error("Could not save the setting")) : resolve(true)), 900))
      }
      return reactive({
      synced: false,
      sync,
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
    })
    },
    template: `<div class="flex flex-col gap-6">
  <div class="flex flex-wrap items-start gap-8">
    <LpSwitch v-model="on" />
    <LpSwitch v-model="on" label="Dark mode" />
    <LpCheckbox v-model="checked" label="Remember me" />
    <LpCheckbox v-model="checked" label="Keep me signed in" description="On this device, for 30 days." class="max-w-56" />
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
  <LpCheckbox v-model="synced" :action="(v) => sync()" label="Same, as a checkbox" description="Ticks at once, spins while saving, unticks on failure." class="max-w-sm" />
  <LpSwitch
    v-model="synced"
    :action="(v) => sync()"
    label-position="start"
    label="Sync across devices"
    description="Saved on the server; every other save fails."
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
    thumb: `<div class="flex flex-col gap-3">
  <LpSwitch :model-value="tOn" label="Dark mode" />
  <LpCheckbox :model-value="!tOn" label="Remember me" />
  <LpRadioGroup :model-value="tOn ? 'pro' : 'free'" :options="radioOpts" />
</div>`,
    thumbLoop: { every: 1600, frames: [{ tOn: true }, { tOn: false }] }
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
    thumb: `<div class="flex flex-col items-center gap-3">
  <LpSegmented :model-value="tView" :options="viewOpts" />
  <LpSegmented :model-value="tDensity" :options="densityOpts" size="sm" />
</div>`,
    thumbLoop: { every: 1700, frames: [{ tView: "grid", tDensity: "default" }, { tView: "board", tDensity: "comfortable" }, { tView: "list", tDensity: "compact" }] }
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
    thumb: `<div class="w-64">
  <LpTextarea model-value="12 Long Street, apt. 4" label="Billing address" :rows="2" />
</div>`,
  },
  {
    id: "password",
    name: "PasswordInput",
    description:
      "Password field with show/hide toggle. `size` (sm/md/lg) as on LpInput; the toggle's names go through `labels` (scope \"passwordInput\").",
    components: { LpPasswordInput },
    state: () => reactive({ value: "" }),
    template: `<div class="flex w-72 flex-col gap-2">
  <LpPasswordInput v-model="value" size="sm" placeholder="sm" />
  <LpPasswordInput v-model="value" placeholder="md (default)" />
  <LpPasswordInput v-model="value" size="lg" placeholder="lg" />
</div>`,
    thumb: `<div class="w-64">
  <LpPasswordInput model-value="correct-horse" />
</div>`,
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
    thumb: `<div class="flex w-64 flex-col gap-2">
  <LpInput :model-value="tPhone" label="Phone" />
  <LpInput :model-value="tCard" label="Card" />
</div>`,
    thumbLoop: {
      every: 1500,
      frames: [
        { tPhone: "+380 (50) 123-45-67", tCard: "4111 1111 1111 1111" },
        { tPhone: "+380 (5", tCard: "4111 11" },
        { tPhone: "+380 (50) 123-4", tCard: "4111 1111 1111" },
      ],
    },
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
    thumb: `<div class="w-72">
  <LpTagsInput :model-value="tTags" placeholder="Add more" />
</div>`,
    thumbLoop: {
      every: 1800,
      frames: [
        { tTags: ["ada@example.com", "grace@example.com", "linus@example.com"] },
        { tTags: ["ada@example.com", "grace@example.com", "linus@example.com", "ken@x.io"] },
      ],
    },
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
    thumb: `<div class="flex w-64 flex-col gap-2">
  <LpInput :model-value="tName" label="Username" :error="tName === 'admin' ? 'That username is taken' : undefined" :hint="tName === 'admin' ? undefined : 'Available'" />
  <div class="flex items-center gap-2">
    <LpButton size="sm">Save</LpButton>
    <LpButton size="sm" variant="ghost">Reset</LpButton>
    <LpBadge :tone="tSaved ? 'neutral' : 'warning'">{{ tSaved ? "Saved" : "Unsaved" }}</LpBadge>
  </div>
</div>`,
    thumbLoop: { every: 1900, frames: [{ tName: "admin", tSaved: false }, { tName: "ada", tSaved: false }, { tName: "ada", tSaved: true }] },
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
    thumb: `<div class="w-64">
  <LpFormField label="Phone">
    <LpPhoneInput :model-value="tPhone" default-country="UA" />
  </LpFormField>
</div>`,
    thumbLoop: { every: 2000, frames: [{ tPhone: "+380 50 123 4567" }, { tPhone: "+33 1 23 45 67 89" }, { tPhone: "+1 555 123 4567" }] },
  },
  {
    id: "address",
    name: "AddressInput",
    description:
      "Postal address form with live suggestions on the street and city fields, plus a map to drop a pin when typing won't do — the picked point is reverse-geocoded back into the fields. v-model is { line, city, postalCode, country, lat, lon }. The geocoder (`provider`), tile server (`tiles`) and the map itself (the `map` slot) are all replaceable; the picker is loaded on demand, so forms that never open the map don't pay for it. Inside an LpFormField the field's label names the whole group, its error describes it, and its invalid/disabled states reach every part; `invalid` does the same on its own.",
    components: { LpAddressInput, LpFormField, LpSwitch, LpInput, LpButton, LpIcon },
    state: () =>
      reactive({ value: { line: "", city: "", postalCode: "", country: "" }, broken: false, locked: false }),
    template: `<div class="flex w-full max-w-xl flex-col gap-3">
  <div class="flex gap-6">
    <LpSwitch v-model="broken" label="Field error" />
    <LpSwitch v-model="locked" label="Field disabled" />
  </div>
  <LpFormField label="Delivery address" :error="broken ? 'We do not deliver there yet.' : undefined" :disabled="locked">
    <LpAddressInput v-model="value" second-line />
  </LpFormField>
  <p class="text-xs text-muted">{{ JSON.stringify(value) }}</p>
</div>`,
    thumb: `<div class="flex w-64 flex-col gap-2">
  <div class="flex gap-2">
    <LpInput model-value="Karlova 12" icon="lucide:map-pin" class="min-w-0 flex-1" />
    <LpButton variant="outline" square aria-label="Pick on a map"><LpIcon name="lucide:map" :size="16" /></LpButton>
  </div>
  <div class="flex gap-2">
    <LpInput model-value="Prague" class="min-w-0 flex-1" />
    <LpInput model-value="110 00" class="w-24" />
  </div>
</div>`,
  },
  {
    id: "map-picker",
    name: "MapPicker",
    description:
      "The picker on its own: drag to pan, wheel or the buttons to zoom, click to drop the pin. v-model is { lat, lon }. Raster {z}/{x}/{y} tiles from any server via `tiles` — no mapping library, so nothing extra reaches the bundle.",
    components: { LpMapPicker, LpIcon },
    state: () => reactive({ point: { lat: 50.0875, lon: 14.4213 } }),
    template: `<div class="w-full max-w-xl">
  <LpMapPicker v-model="point" :zoom="14" height="18rem" />
  <p class="mt-2 text-xs text-muted">{{ point.lat.toFixed(5) }}, {{ point.lon.toFixed(5) }}</p>
</div>`,
    thumb: `<div class="relative h-32 w-64 overflow-hidden rounded-card border border-line bg-surface-soft">
  <div class="absolute inset-0 opacity-60" style="background-image: linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px); background-size: 32px 32px" />
  <div class="absolute left-0 right-0 top-1/2 h-2 -rotate-6 bg-surface-raised" />
  <div class="absolute bottom-0 left-1/3 top-0 w-1.5 rotate-12 bg-surface-raised" />
  <LpIcon name="lucide:map-pin" :size="28" class="absolute -translate-x-1/2 -translate-y-full text-brand transition-[left,top] duration-700 ease-out" :style="{ left: tPin[0] + '%', top: tPin[1] + '%' }" />
  <div class="absolute right-2 top-2 flex flex-col overflow-hidden rounded-control border border-line bg-surface-raised text-muted">
    <span class="grid size-6 place-items-center border-b border-line"><LpIcon name="lucide:plus" :size="13" /></span>
    <span class="grid size-6 place-items-center"><LpIcon name="lucide:minus" :size="13" /></span>
  </div>
</div>`,
    thumbLoop: { every: 2000, frames: [{ tPin: [50, 50] }, { tPin: [30, 72] }, { tPin: [68, 36] }] },
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
    thumb: `<LpOtpInput :model-value="tCode" :group="3" />`,
    thumbLoop: { every: 1400, frames: [{ tCode: "482913" }, { tCode: "" }, { tCode: "48" }, { tCode: "4829" }] },
  },
  {
    id: "colorpicker",
    name: "ColorPicker",
    description:
      "Colour field + popover: a saturation/brightness area over a hue rail, an optional alpha rail, a hex/CSS text field and preset swatches. v-model is a CSS colour STRING — `format` picks hex/rgb/hsl on the way out, and all three are parsed on the way in. @change fires on release (commit-vs-preview), and the area and rails are arrow-key operable. Right-click either the field or the panel to copy as hex/rgb/hsl, switch which format it shows via `Show as`, or paste a colour in — pasting takes hex, rgb() and hsl() in any CSS form, plus loose shapes like `255 0 0` or `rgb 17 34 51`; `recent` remembers what you settle on and offers it back above the presets. Every string it renders — menu items, the Recent heading, the accessible names on the area and rails, the copy toast — goes through `labels` and the app-wide config (scope \"colorPicker\"); an explicit `copy-toast` still wins, and `false` copies silently.",
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
    thumb: `<div class="flex w-64 flex-col gap-3">
  <LpColorPicker :model-value="tColor" />
  <div class="flex gap-2">
    <span v-for="c in ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899']" :key="c" class="size-6 rounded-control border border-line" :style="{ backgroundColor: c }" />
  </div>
</div>`,
    thumbLoop: { every: 1800, frames: [{ tColor: "#3b82f6" }, { tColor: "#22c55e" }, { tColor: "#a855f7" }, { tColor: "#f59e0b" }] },
  },
  {
    id: "calendar",
    name: "Calendar · DatePicker",
    description:
      "Inline month calendar and a field+popover date picker (reka Calendar + @internationalized/date). Model is an ISO \"YYYY-MM-DD\" string; min/max bounds, an isDisabled predicate and `is-date-unavailable` for struck-through days (weekends below). Same core props as the range pair: `months`, `locale`, `labels` (month buttons, scope \"calendar\"). The picker adds `presets`: `true` for Today / Tomorrow / In a week, or your own `{ label, date }` list; a preset that falls on a day the rules forbid is disabled. Its placeholder and Done button come from `labels` (scope \"datePicker\"). Today is tinted, the selection is a brand pill.",
    components: { LpCalendar, LpDatePicker, LpIcon },
    state: () =>
      reactive({
        date: "2026-06-18",
        picked: "",
        moment: "",
        workday: (iso: string) => [0, 6].includes(new Date(`${iso}T00:00`).getDay()),
        sprint: [
          { label: "Sprint start", date: () => "2026-06-01" },
          { label: "Demo day", date: () => "2026-06-12" },
        ],
      }),
    template: `<div class="flex flex-wrap items-start gap-6">
  <LpCalendar v-model="date" min="2026-06-01" :is-date-unavailable="workday" />
  <LpCalendar v-model="date" :months="2" locale="de-DE" :labels="{ previous: 'Zurück', next: 'Weiter' }" />
  <div class="flex w-64 flex-col gap-2">
    <LpDatePicker v-model="picked" clearable presets placeholder="Select a date" />
    <p class="text-xs text-muted">ISO value: {{ picked || "—" }}</p>
    <LpDatePicker v-model="moment" time clearable presets :labels="{ placeholder: 'Date and time' }" />
    <p class="text-xs text-muted">with time: {{ moment || "—" }}</p>
    <LpDatePicker v-model="picked" :presets="sprint" :is-date-unavailable="workday" locale="fr-FR" />
    <p class="text-xs text-muted">own presets, French, weekends unavailable</p>
  </div>
</div>`,
    thumb: `<div class="w-64 rounded-card border border-line bg-surface-raised p-2 text-center text-xs">
  <div class="mb-1 flex items-center justify-between px-1">
    <LpIcon name="lucide:chevron-left" :size="14" class="text-muted" />
    <span class="text-sm font-medium text-ink">June 2026</span>
    <LpIcon name="lucide:chevron-right" :size="14" class="text-muted" />
  </div>
  <div class="grid grid-cols-7 gap-0.5 text-muted">
    <span v-for="d in ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']" :key="d" class="py-0.5">{{ d }}</span>
  </div>
  <div class="grid grid-cols-7 gap-0.5 text-ink">
    <span v-for="n in 21" :key="n" class="rounded-pill py-1 transition-colors duration-300" :class="n + 7 === tDay ? 'bg-brand font-medium text-ink-inverse' : n + 7 === 16 ? 'bg-surface-soft' : ''">{{ n + 7 }}</span>
  </div>
</div>`,
    thumbLoop: { every: 1600, frames: [{ tDay: 18 }, { tDay: 23 }, { tDay: 12 }] },
  },
  {
    id: "date-range",
    name: "DateRangePicker",
    description:
      "Range field + popover (reka RangeCalendar). Model is `{ start, end }` of ISO days, both inclusive; presets on the side (Today, Last 7/30 days, this and last month, or your own `{ label, range }`), two months where there is room and one on a phone. A preset outside min/max is clipped to it, or disabled when nothing of it is left. Like selecting text on a phone, a range can be pressed out by dragging across the days (a finger holds for a moment first, so a swipe still scrolls), and either end of a finished range can be grabbed and pulled; Shift+arrows move the focused end. The popover stays open after a pick, so the ends can still be adjusted before clicking away.",
    components: { LpDateRangePicker, LpRangeCalendar, LpFormField, LpIcon },
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
    thumb: `<div class="flex w-64 flex-col gap-2">
  <div class="flex h-9 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm text-ink">
    <LpIcon name="lucide:calendar" :size="15" class="text-muted" />
    Jun {{ tFrom }}, 2026 – Jun {{ tTo }}, 2026
  </div>
  <div class="grid grid-cols-7 gap-y-0.5 text-center text-xs text-ink">
    <span v-for="n in 14" :key="n" class="py-1 transition-colors duration-300" :class="n + 4 === tFrom ? 'rounded-l-pill bg-brand text-ink-inverse' : n + 4 === tTo ? 'rounded-r-pill bg-brand text-ink-inverse' : n + 4 > tFrom && n + 4 < tTo ? 'bg-brand-soft text-brand' : ''">{{ n + 4 }}</span>
  </div>
</div>`,
    thumbLoop: { every: 1800, frames: [{ tFrom: 8, tTo: 14 }, { tFrom: 6, tTo: 10 }, { tFrom: 11, tTo: 17 }] },
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
    thumb: `<div class="flex w-64 flex-col gap-3">
  <LpFormField label="Nickname" required>
    <LpInput model-value="Steve" size="sm" />
  </LpFormField>
  <LpFormField label="Email" :error="tEmail.includes('.') ? undefined : 'That doesn\\'t look like an email'" :hint="tEmail.includes('.') ? 'We never share it' : undefined">
    <LpInput :model-value="tEmail" size="sm" />
  </LpFormField>
</div>`,
    thumbLoop: { every: 1900, frames: [{ tEmail: "steve@" }, { tEmail: "steve@mail.com" }] },
  },
  {
    id: "numberfield",
    name: "NumberField",
    description:
      "Numeric input with stepper buttons, min/max/step, optional unit, and `size` (sm/md/lg) as on LpInput. The stepper buttons are named through `labels` (scope \"numberField\") instead of reka's built-in English.",
    components: { LpNumberField },
    state: () => reactive({ value: 30, watts: 10, millis: 380 }),
    template: `<div class="w-48 space-y-3">
  <LpNumberField v-model="value" :min="0" :max="100" :step="5" size="sm" :labels="{ increase: 'Plus 5', decrease: 'Minus 5' }" />
  <LpNumberField v-model="watts" :min="0" unit="W" />
  <LpNumberField v-model="millis" :min="0" unit="mA" size="lg" />
  <p class="text-xs text-muted">value: {{ value }}</p>
</div>`,
    thumb: `<div class="flex w-44 flex-col gap-2">
  <LpNumberField :model-value="tLevel" :min="0" :max="100" :step="5" />
  <LpNumberField :model-value="tMilli" unit="mA" />
</div>`,
    thumbLoop: { every: 1500, frames: [{ tLevel: 30, tMilli: 380 }, { tLevel: 35, tMilli: 420 }, { tLevel: 40, tMilli: 450 }, { tLevel: 35, tMilli: 400 }] },
  },
  {
    id: "timefield",
    name: "TimeField",
    description: "Time of day as hour and minute segments (reka TimeField): type or step with the arrow keys. Model is \"HH:mm\", like a native time input, but the clock is fixed by `hourCycle` (24 by default) instead of the browser locale, and it is themed like the other fields. Full width by default; a class like `w-32` wins over it.",
    components: { LpTimeField },
    state: () => reactive({ at: "18:30", twelve: "" }),
    template: `<div class="flex w-56 flex-col gap-3">
  <LpTimeField v-model="at" />
  <LpTimeField v-model="at" class="w-32" size="sm" />
  <LpTimeField v-model="twelve" :hour-cycle="12" locale="en-US" />
  <p class="text-xs text-muted">value: {{ at || "—" }} · {{ twelve || "—" }}</p>
</div>`,
    thumb: `<div class="flex w-40 flex-col gap-2">
  <LpTimeField :model-value="tAt" />
  <LpTimeField :model-value="tMorning" :hour-cycle="12" locale="en-US" />
</div>`,
    thumbLoop: { every: 1700, frames: [{ tAt: "18:30", tMorning: "09:15" }, { tAt: "18:45", tMorning: "09:30" }, { tAt: "19:00", tMorning: "10:00" }] },
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
    thumb: `<div class="w-64">
  <LpSlider :model-value="tValue" :min="0" :max="100" />
  <p class="mt-2 text-center text-xs text-muted">{{ tValue }}</p>
</div>`,
    thumbLoop: { every: 1500, frames: [{ tValue: 64 }, { tValue: 28 }, { tValue: 82 }, { tValue: 45 }] }
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
    thumb: `<div class="w-64">
  <LpRangeSlider :model-value="tPrice" :min="0" :max="100" />
  <p class="mt-2 text-center text-xs text-muted">\${{ tPrice[0] }} to \${{ tPrice[1] }}</p>
</div>`,
    thumbLoop: { every: 1600, frames: [{ tPrice: [20, 80] }, { tPrice: [35, 70] }, { tPrice: [10, 55] }, { tPrice: [45, 90] }] },
  },
  {
    id: "dropzone",
    name: "Dropzone",
    description:
      "Drop files, click to browse, or paste from the clipboard — three routes to the same intent, because a zone that takes only one of them is the one people call broken. `accept` filters a drop the same way it filters a browse, so the two cannot disagree. `links` adds an address by the same routes: drag a picture in from another tab (a browser gives its address, not a file), paste a copied link, or press \"or a link\" and type it where the zone was (a zone narrower than 280px opens the field in a popover under itself instead); Enter adds, Escape goes back. Only http(s) is taken, and it arrives as the `link` event; whether it serves a picture is the app's call.",
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
  <div class="flex items-start gap-3">
    <LpDropzone ref="narrow" accept="image/*" links class="aspect-video !w-36 shrink-0 !p-0" title="" @link="(url) => (link = url)" @files="(f) => (taken = f.map((x) => x.name))" />
    <p class="text-xs text-muted">A zone too narrow for the field (a cover thumbnail) opens it in a popover under itself: <button type="button" class="text-brand hover:underline" @click="$refs.narrow.link()">open it</button>.</p>
  </div>
  <div v-if="link" class="flex items-center gap-2 text-xs text-muted">
    <img :src="link" alt="" class="size-10 shrink-0 rounded-control bg-surface-soft object-cover" />
    <span class="min-w-0 truncate">Link: {{ link }}</span>
  </div>
  <p v-if="refused.length" class="text-xs text-danger">Refused: {{ refused.join(', ') }}</p>
</div>`,
    thumb: `<div class="w-72">
  <LpDropzone accept="image/*" title="Drop photographs here" hint="or click to browse" links :drag-over="tOver" :linking="tLink" />
</div>`,
    thumbLoop: {
      every: 1800,
      frames: [
        { tOver: false, tLink: false },
        { tOver: true, tLink: false },
        { tOver: false, tLink: false },
        { tOver: false, tLink: true },
      ],
    },
  },
  {
    id: "imageeditor",
    name: "ImageEditor",
    description:
      "Straighten and crop on the way to an upload: quarter turns, wheel/pinch zoom, drag to pan. `export()` returns the visible region as a Blob, or null when nothing was changed — an untouched picture uploads byte-for-byte rather than a generation worse. `file` also takes an address (a link from LpDropzone's `link` event), loaded with CORS. A file that does not open draws a failed state and emits `error` (cause \"decode\", or \"load\" for an address); a picture whose server refuses CORS is still shown and edited, and export emits `error` with cause \"cors\" instead of throwing.",
    components: { LpImageEditor, LpButton, LpSelect, LpIcon },
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
      const sources: Record<string, File | string> = {
        plate: file,
        broken: new File(["not a picture"], "broken.png", { type: "image/png" }),
        link: "https://picsum.photos/id/1018/800/600.jpg",
        closed: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png",
      }
      const state = reactive({
        file: file as File | string,
        which: "plate",
        error: "",
        sources,
        aspect: "free",
        type: "image/jpeg",
        result: "",
        editor: null as { export: () => Promise<Blob | null> } | null,
        async save() {
          const blob = await state.editor?.export()
          state.result = blob
            ? `${blob.type}, ${(blob.size / 1024).toFixed(1)} KB written`
            : state.error
              ? ""
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
  <LpSelect
    v-model="which"
    :options="[
      { value: 'plate', label: 'file: sideways plate' },
      { value: 'broken', label: 'file: not a picture' },
      { value: 'link', label: 'address (CORS)' },
      { value: 'closed', label: 'address (no CORS: export reports it)' },
    ]"
    @update:model-value="(v) => { file = sources[v]; error = ''; result = '' }"
  />
  <LpImageEditor
    :ref="(el) => (editor = el)"
    :file="file"
    :aspect="aspect"
    :type="type"
    @error="(e) => (error = e.cause + ': ' + e.message)"
  />
  <p v-if="error" class="text-xs text-danger">{{ error }}</p>
  <LpButton size="sm" @click="save">Export</LpButton>
  <p v-if="result" class="text-xs text-muted">{{ result }}</p>
</div>`,
    thumb: `<div class="flex w-64 flex-col gap-2">
  <div class="relative h-28 overflow-hidden rounded-card border border-line bg-surface-soft">
    <div class="absolute inset-3 rounded-control" style="background: linear-gradient(135deg, #1f2937, #0b1220)" />
    <div class="absolute inset-x-10 inset-y-6 grid place-items-center rounded-inner bg-[#e5e7eb] text-xs font-bold text-[#111827]">MLF-A001</div>
    <div class="absolute inset-5 border-2 border-white/90" />
    <div class="absolute inset-5 grid grid-cols-3 grid-rows-3">
      <span v-for="n in 9" :key="n" class="border border-white/25" />
    </div>
  </div>
  <div class="flex items-center justify-center gap-1">
    <LpButton size="sm" variant="ghost" square aria-label="Rotate left"><LpIcon name="lucide:rotate-ccw" :size="15" /></LpButton>
    <LpButton size="sm" variant="ghost" square aria-label="Rotate right"><LpIcon name="lucide:rotate-cw" :size="15" /></LpButton>
    <LpButton size="sm" variant="ghost" square aria-label="Zoom in"><LpIcon name="lucide:zoom-in" :size="15" /></LpButton>
    <LpButton size="sm">Export</LpButton>
  </div>
</div>`,
  },
]
