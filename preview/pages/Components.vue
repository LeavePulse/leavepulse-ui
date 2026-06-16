<script setup lang="ts">
import { ref } from "vue"
import {
  LpBadge,
  LpButton,
  LpCard,
  LpCheckbox,
  LpFormField,
  LpInput,
  LpModal,
  LpPopover,
  LpRadioGroup,
  LpSelect,
  LpSwitch,
  LpTabs,
  LpTextarea,
  LpTooltip,
  useToast,
  type RadioOption,
  type SelectOption,
  type TabItem,
} from "../../src"

const { toast, success, warning, error } = useToast()

const variants = ["solid", "action", "outline", "ghost", "muted", "danger"] as const
const sizes = ["sm", "md", "lg"] as const

const text = ref("")
const area = ref("")
const toggle = ref(true)
const checked = ref(true)
const disabled = ref(false)

const fruit = ref("apple")
const fruits: SelectOption[] = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
]

const region = ref<string>()
const regions: SelectOption[] = [
  { value: "eu", label: "Europe", description: "ger-01-p, proxy-vps" },
  { value: "na", label: "North America", description: "collector-vps" },
  { value: "asia", label: "Asia", description: "edge nodes" },
]
const tags = ref<string[]>(["eu"])

const plan = ref("pro")
const plans: RadioOption[] = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "team", label: "Team" },
]

const tab = ref("overview")
const tabs: TabItem[] = [
  { value: "overview", label: "Overview", icon: "lucide:layout-dashboard" },
  { value: "settings", label: "Settings", icon: "lucide:settings" },
  { value: "logs", label: "Logs", icon: "lucide:scroll-text" },
]

const modalOpen = ref(false)

const section = "flex flex-col gap-4"
const heading = "text-sm font-semibold uppercase tracking-wider text-muted"
</script>

<template>
  <div class="mx-auto flex max-w-4xl flex-col gap-8 p-8">
    <LpCard variant="flat" class="flex items-center gap-3">
      <LpSwitch v-model="disabled" />
      <span class="text-sm text-muted">Disable all controls</span>
    </LpCard>

    <!-- Button -->
    <section :class="section">
      <h2 :class="heading">Button</h2>
      <div class="flex flex-col gap-3">
        <div v-for="s in sizes" :key="s" class="flex flex-wrap items-center gap-2">
          <span class="w-8 text-xs text-muted">{{ s }}</span>
          <LpButton
            v-for="v in variants"
            :key="v"
            :variant="v"
            :size="s"
            :disabled="disabled"
          >
            {{ v }}
          </LpButton>
        </div>
        <LpButton block variant="solid">Block button</LpButton>
      </div>
    </section>

    <!-- Input + Textarea -->
    <section :class="section">
      <h2 :class="heading">Input · Textarea</h2>
      <div class="grid max-w-md grid-cols-1 gap-3">
        <LpInput v-model="text" placeholder="Type something…" :disabled="disabled" />
        <LpInput v-model="text" invalid placeholder="Invalid" :disabled="disabled" />
        <LpTextarea v-model="area" placeholder="Multi-line…" :disabled="disabled" />
      </div>
    </section>

    <!-- Select: plain / searchable / multiple -->
    <section :class="section">
      <h2 :class="heading">Select (plain · searchable · multiple)</h2>
      <div class="grid max-w-md grid-cols-1 gap-4">
        <LpSelect v-model="fruit" :options="fruits" :disabled="disabled" />
        <LpSelect
          v-model="region"
          :options="regions"
          searchable
          clearable
          placeholder="Search a region"
          :disabled="disabled"
        />
        <LpSelect
          v-model="tags"
          :options="regions"
          searchable
          multiple
          placeholder="Pick several"
          :disabled="disabled"
        />
        <p class="text-xs text-muted">region: {{ region ?? "—" }} · tags: {{ tags.join(", ") || "—" }}</p>
      </div>
    </section>

    <!-- Checkbox · Radio · Switch -->
    <section :class="section">
      <h2 :class="heading">Checkbox · Radio · Switch</h2>
      <div class="flex flex-wrap items-start gap-10">
        <LpCheckbox v-model="checked" :disabled="disabled" label="Remember me" />
        <LpRadioGroup v-model="plan" :options="plans" :disabled="disabled" />
        <div class="flex items-center gap-3">
          <LpSwitch v-model="toggle" :disabled="disabled" />
          <span class="text-sm">{{ toggle ? "On" : "Off" }}</span>
        </div>
      </div>
    </section>

    <!-- Tabs -->
    <section :class="section">
      <h2 :class="heading">Tabs (animated panels)</h2>
      <LpTabs v-model="tab" :items="tabs">
        <template #panel="{ value }">
          <LpCard variant="flat">
            <span class="text-sm">Content for the “{{ value }}” tab.</span>
          </LpCard>
        </template>
      </LpTabs>
    </section>

    <!-- FormField -->
    <section :class="section">
      <h2 :class="heading">FormField (label · hint · error)</h2>
      <div class="grid max-w-md grid-cols-1 gap-4">
        <LpFormField label="Nickname" hint="Shown on your profile" required>
          <template #default="{ id }">
            <LpInput :id="id" v-model="text" placeholder="Steve" :disabled="disabled" />
          </template>
        </LpFormField>
        <LpFormField label="Email" error="That doesn't look like an email">
          <template #default="{ id }">
            <LpInput :id="id" v-model="text" invalid :disabled="disabled" />
          </template>
        </LpFormField>
      </div>
    </section>

    <!-- Toast + Popover -->
    <section :class="section">
      <h2 :class="heading">Toast · Popover</h2>
      <div class="flex flex-wrap items-center gap-3">
        <LpButton variant="outline" @click="toast('Layout written to disk', { title: 'Saved' })">
          Info
        </LpButton>
        <LpButton variant="action" @click="success('app-vps-1 healthy', { title: 'Deployed' })">
          Success
        </LpButton>
        <LpButton variant="ghost" @click="warning('Token expires in 5 min', { title: 'Heads up' })">
          Warning
        </LpButton>
        <LpButton
          variant="danger"
          @click="error('gRPC timeout', {
            title: 'Failed',
            actions: [{ label: 'Retry', onClick: () => success('Retried') }],
          })"
        >
          Error + action
        </LpButton>
        <LpButton
          variant="outline"
          @click="toast('Click me to copy diagnostics', { title: 'Clickable', onClick: () => success('Copied') })"
        >
          Clickable
        </LpButton>

        <LpPopover>
          <template #trigger>
            <LpButton variant="ghost">Open popover</LpButton>
          </template>
          <p class="font-semibold text-ink">Popover content</p>
          <p class="mt-1 text-muted">Anchored, animated, on the popover z-layer.</p>
        </LpPopover>
      </div>
    </section>

    <!-- Overlays -->
    <section :class="section">
      <h2 :class="heading">Tooltip · Modal</h2>
      <div class="flex items-center gap-3">
        <LpTooltip content="I appear on hover">
          <LpButton variant="outline">Hover me</LpButton>
        </LpTooltip>
        <LpButton variant="solid" @click="modalOpen = true">Open modal</LpButton>
      </div>
      <LpModal
        v-model:open="modalOpen"
        title="Confirm action"
        description="This is a token-driven modal built on reka-ui Dialog."
      >
        <p>Modal body content goes here. Escape and overlay click close it.</p>
        <template #footer>
          <LpButton variant="ghost" @click="modalOpen = false">Cancel</LpButton>
          <LpButton variant="solid" @click="modalOpen = false">Confirm</LpButton>
        </template>
      </LpModal>
    </section>

    <!-- Badge + Card -->
    <section :class="section">
      <h2 :class="heading">Badge · Card</h2>
      <div class="flex flex-wrap gap-2">
        <LpBadge tone="neutral" dot>Neutral</LpBadge>
        <LpBadge tone="brand" dot>Online</LpBadge>
        <LpBadge tone="action">Active</LpBadge>
        <LpBadge tone="danger" dot>Error</LpBadge>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <LpCard variant="raised"><span class="text-sm">Raised</span></LpCard>
        <LpCard variant="flat"><span class="text-sm">Flat</span></LpCard>
        <LpCard variant="flat" interactive><span class="text-sm">Interactive</span></LpCard>
      </div>
    </section>
  </div>
</template>
