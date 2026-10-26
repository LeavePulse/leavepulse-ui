<script setup lang="ts">
import { computed, ref } from "vue"
import {
  LpButton, LpCommandPalette, LpCommandScope, LpDisclosure, LpFormField, LpInput,
  LpNumberField, LpPaletteFacts, LpPaletteStats, LpSecretField, LpSelect, LpSwitch,
  LpTable, LpTabs, LpToaster, useThemeStudio, type Command, vPalette,
} from "../../src"

const props = defineProps<{ testing?: boolean; manualCommands?: Command[] }>()
const open = ref(false)
const limit = ref(4)
const online = ref(true)
const onlineSaves = ref(0)
async function saveOnline() { onlineSaves.value++; await new Promise(resolve => setTimeout(resolve, 120)) }
const region = ref("eu")
const name = ref("api-gateway")
const advanced = ref(false)
const tab = ref("overview")
const snapshots = ref(0)
const picked = ref("")
const showTools = ref(true)
const loading = ref(true)
const target = ref<InstanceType<typeof LpInput> | null>(null)
const studio = useThemeStudio({ storageKey: "lp-context-palette-theme" })
const commands = computed<Command[]>(() => [
  { id: "service/snapshot", label: "Create snapshot", description: "An asynchronous action with Undo.", preview: "Creates a snapshot of this service.",
    onSelect: async () => { await new Promise(resolve => setTimeout(resolve, 80)); snapshots.value++; return snapshots.value },
    undo: () => { snapshots.value-- } },
  { id: "service/allocation", label: "Set allocation", prompt: {
    placeholder: "CPU count, 1–128",
    validate: async value => { await new Promise(resolve => setTimeout(resolve, 120)); return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 128 ? undefined : "Enter a whole number from 1 to 128." },
    submit: value => { limit.value = Number(value) },
  } },
  { id: "service/advanced", label: "Find deployment note", onSelect: () => { advanced.value = true }, afterClose: () => target.value?.focus() },
  { id: "service/branches", label: "Branches", onSelect: () => { picked.value = "branches" } },
])
const people = [{ id: "person/ada", label: "Ada Lovelace", description: "Administrator", preview: "Production services", actions: [{ id: "person/ada/copy", label: "Copy user ID", onSelect: () => { picked.value = "ada" } }] }]
const modes = { people, channels: [{ id: "channel/general", label: "general" }], roles: [{ id: "role/admin", label: "Administrator" }] }
const overrides = computed<Command[]>(() => [...props.manualCommands ?? [], ...props.testing ? [{ id: "test/fail", label: "Fail action", onSelect: async () => { throw new Error("Service unavailable") } }] : []])
</script>

<template>
  <LpCommandScope id="service" label="Service" :commands="commands" :theme="studio" isolated>
    <div class="flex w-full max-w-xl flex-col gap-5">
      <div class="flex flex-wrap items-center gap-2">
        <LpButton :palette="false" @click="open = true">Open contextual palette</LpButton>
        <LpButton :palette="false" variant="ghost" size="sm" @click="showTools = !showTools">Toggle page tools</LpButton>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <LpFormField label="CPU limit"><LpNumberField v-model="limit" :min="1" :max="128" :palette="{ id: 'cpu' }" /></LpFormField>
        <LpFormField label="Region"><LpSelect v-model="region" :options="[{ value: 'eu', label: 'Europe' }, { value: 'us', label: 'America' }]" /></LpFormField>
      </div>
      <LpInput v-model="name" label="Service name" />
      <LpSwitch v-model="online" label="Service online" :action="saveOnline" />
      <LpSecretField value="demo-private-token" label="API secret" />
      <LpTabs v-model="tab" label="Service views" :items="[{ value: 'overview', label: 'Overview' }, { value: 'logs', label: 'Logs' }]" />
      <LpDisclosure v-model:open="advanced" label="Advanced settings"><LpInput ref="target" placeholder="Deployment note" aria-label="Deployment note" /></LpDisclosure>
      <LpCommandScope v-if="showTools" id="tools" label="Page tools" :commands="[{ id: 'service/tool', label: 'Inspect deployment', onSelect: () => { picked = 'deployment' } }]" :discover="false">
        <button v-palette="{ id: 'native', label: 'Native page action', action: 'click' }" class="self-start text-sm text-brand" @click="picked = 'native'">Native action registered by v-palette</button>
      </LpCommandScope>
      <LpTable :columns="[{ key: 'name', label: 'Name' }, { key: 'state', label: 'State' }]" :rows="[{ id: 'gateway', name: 'api-gateway', state: 'Online' }, { id: 'worker', name: 'worker', state: 'Starting' }]" row-key="id" :palette="{ id: 'services', label: 'Services', labelKey: 'name' }" :row-menu="row => [{ label: 'Inspect ' + row.name, onSelect: () => { picked = String(row.id) } }]" />
      <LpSwitch v-model="loading" label="Loading summary" />
      <LpPaletteStats :loading="loading" :items="[{ label: 'Snapshots', value: snapshots }, { label: 'CPU limit', value: limit }]" />
      <LpPaletteFacts :loading="loading" :items="[{ label: 'Region', value: region }]" />
      <template v-if="testing">
        <output aria-label="CPU value">{{ limit }}</output><output aria-label="Snapshot count">{{ snapshots }}</output>
        <output aria-label="Picked action">{{ picked }}</output><output aria-label="Active view">{{ tab }}</output>
        <output aria-label="Online saves">{{ onlineSaves }}</output><output aria-label="Region value">{{ region }}</output>
        <output aria-label="Theme state">{{ JSON.stringify(studio.state.value) }}</output>
      </template>
    </div>
    <LpCommandPalette v-model:open="open" :commands="overrides" :hotkey="!testing" preview-pane :modes="modes" recent-key="lp-context-palette-recent" />
    <LpToaster v-if="testing" />
  </LpCommandScope>
</template>
