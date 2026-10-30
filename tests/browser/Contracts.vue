<script setup lang="ts">
import { reactive, ref } from "vue"
import CommandContextDemo from "../../preview/playground/CommandContextDemo.vue"
import {
  LpButton, LpConfirmHost, LpDatePicker, LpDateRangePicker, LpDrawer,
  LpEditable, LpFormField, LpInput, LpPasswordInput, LpRepeater,
  LpSecretField, LpSelect, LpDataList, LpChart, LpFrame,
  LpContextMenu, LpDropdownMenu, LpDropzone, LpPopover, LpSegmented, LpTable, useForm,
  useTableFilterChoice, type DateRange, type TableFilters,
} from "../../src"

const params = new URLSearchParams(location.search)
const scenario = params.get("scenario")
const mode = params.get("mode")
const locked = ref(true)
const revealable = ref(true)
const secret = ref("private-value")
const rotations = ref(0)
const name = ref("Old")
const saves = ref<string[]>([])
const editingLocked = ref(false)
const blurCount = ref(0)
const chosen = ref("tcp")
const open = ref(true)
const saved = ref<unknown[]>([])
const form = reactive(useForm({
  initial: { date: undefined as string | undefined, range: undefined as DateRange | undefined },
  rules: {
    date: (value) => value ? undefined : "Choose date",
    range: (value) => value ? undefined : "Choose range",
  },
}))
const service = reactive(useForm({
  initial: { name: "", proto: "tcp", ports: [] as { port: string }[] },
  rules: { name: (value) => value.trim() ? undefined : "Enter a name" },
}))
const submit = service.handleSubmit((value) => { saved.value.push(value) })
const emptyPort = () => ({ port: "" })
const rows = ref([
  { name: "First", children: [{ name: "First child" }] },
  { name: "Second", children: [{ name: "Second child" }] },
])
const newRow = () => ({ name: "New", children: [] as { name: string }[] })
const pickedEnvironment = ref("")
const tableFilters = ref<TableFilters>({})
const statusChoice = useTableFilterChoice(tableFilters, "status", { all: null, open: ["open"], done: ["closed", "failed"] })
const tableSearch = ref("")
const orders = [
  { id: "A-1", status: "open" },
  { id: "A-2", status: "closed" },
  { id: "A-3", status: "failed" },
]
const visibleOrders = () => orders.filter((o) => o.id.toLowerCase().includes(tableSearch.value.toLowerCase()))
const tableColumns = [
  { key: "id", label: "Order" },
  { key: "status", label: "Status", filterable: true, filterValues: ["open", "closed", "failed", "archived"] },
]
const menuItems = [{ label: "Move to", children: [
  { label: "Production", onSelect: () => { pickedEnvironment.value = "Production" } },
  { label: "Staging", onSelect: () => { pickedEnvironment.value = "Staging" } },
] }]
</script>

<template>
  <main class="mx-auto flex max-w-xl flex-col gap-4 p-6">
    <CommandContextDemo v-if="scenario === 'context-palette'" testing :manual-commands="mode === 'override' ? [{ id: 'service/cpu', label: 'Custom processor action' }] : undefined" />
    <template v-else-if="scenario === 'frame'">
      <button data-test-outside>Outside frame</button>
      <LpFrame :height="420" title="Frame interactions">
        <div class="flex flex-col items-start gap-5 p-6">
          <LpDropdownMenu :items="menuItems">
            <template #trigger><LpButton aria-label="Frame actions">Actions</LpButton></template>
          </LpDropdownMenu>
          <LpPopover>
            <template #trigger><LpButton aria-label="Frame popover">Popover</LpButton></template>
            <p>Popover body</p>
          </LpPopover>
          <LpSelect :options="[{ value: 'tcp', label: 'TCP' }]" aria-label="Frame select" />
          <LpContextMenu :items="menuItems">
            <button class="h-12 w-40 border border-line">Context target</button>
          </LpContextMenu>
          <output aria-label="Picked environment">{{ pickedEnvironment }}</output>
        </div>
      </LpFrame>
    </template>
    <LpChart v-else-if="scenario === 'chart'" title="Thresholds and markers" :labels="['Jan', 'Feb']" :series="[{ name: 'Latency', data: [40, 60] }]" data-table :height="200" />
    <LpRepeater v-else-if="scenario === 'repeater'" v-model="rows" :create-item="newRow" label="Rows">
      <template #default="{ item, index }">
        <LpInput v-model="item.name" :aria-label="`Row ${index + 1}`" />
        <LpRepeater v-if="mode === 'nested'" v-model="item.children" :create-item="() => ({ name: '' })" :labels="{ add: 'Add child', remove: 'Remove child {index}' }">
          <template #default="{ item: child }"><LpInput v-model="child.name" aria-label="Child" /></template>
        </LpRepeater>
      </template>
    </LpRepeater>
    <div v-else-if="scenario === 'data-list'" class="w-[220px] rounded-card border border-line px-4">
      <LpDataList :layout="mode === 'horizontal' ? 'horizontal' : mode === 'stacked' ? 'stacked' : 'auto'" :items="[
        { label: 'Address', value: 'play.leavepulse.net:25565', mono: true, copyable: true },
        { label: 'Description', value: 'A'.repeat(100) },
      ]" />
    </div>
    <template v-else-if="scenario === 'secret'">
      <LpFormField label="Secret" :disabled="mode === 'inherited' && locked">
        <LpSecretField v-model="secret" :value="secret" :input="params.get('input') === 'true'" :disabled="mode === 'own' && locked" :revealable="revealable" :regenerate="() => { rotations++ }" />
      </LpFormField>
      <button @click="locked = !locked">Toggle lock</button>
      <button @click="revealable = !revealable">Toggle reveal</button>
      <output aria-label="Rotations">{{ rotations }}</output>
    </template>
    <template v-else-if="scenario === 'password'">
      <LpFormField label="Password" :disabled="locked">
        <LpPasswordInput v-model="secret" />
      </LpFormField>
      <button @click="locked = !locked">Toggle lock</button>
    </template>
    <template v-else-if="scenario === 'editable'">
      <LpEditable v-model="name" label="Name" :disabled="mode === 'disabled' && editingLocked" :readonly="mode === 'readonly' && editingLocked" :save="value => { saves.push(value) }" />
      <button @pointerdown.prevent @click="editingLocked = !editingLocked">Toggle lock</button>
      <output aria-label="Saved names">{{ JSON.stringify(saves) }}</output>
    </template>
    <template v-else-if="scenario === 'table-filters'">
      <LpInput v-model="tableSearch" aria-label="Search orders" />
      <LpSegmented v-model="statusChoice" aria-label="Status choice" :options="[{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }]" />
      <LpTable v-model:filters="tableFilters" :columns="tableColumns" :rows="visibleOrders()" row-key="id" :filtered="!!tableSearch" @reset-filters="tableSearch = ''" />
      <output aria-label="Table filters">{{ JSON.stringify(tableFilters) }}</output>
      <output aria-label="Status choice value">{{ statusChoice ?? "mixed" }}</output>
    </template>
    <template v-else-if="scenario === 'dropzone'">
      <LpDropzone title="Drop a picture" :class="mode === 'control' ? 'rounded-control p-0' : 'p-0'">
        <div data-test-fill class="h-40 w-full bg-surface-soft" />
      </LpDropzone>
    </template>
    <template v-else-if="scenario === 'picker'">
      <LpFormField v-if="mode === 'range'" label="Date" :error="form.field('range').error">
        <LpDateRangePicker v-bind="form.field('range')" @blur="blurCount++" />
      </LpFormField>
      <LpFormField v-else label="Date" :error="form.field('date').error">
        <LpDatePicker v-bind="form.field('date')" :time="mode === 'time'" presets @blur="blurCount++" />
      </LpFormField>
      <button class="fixed right-6 top-6">After</button>
      <output aria-label="Blur count">{{ blurCount }}</output>
    </template>
    <template v-else-if="scenario === 'select'">
      <LpFormField label="Protocol">
        <LpSelect v-model="chosen" searchable clearable :options="[{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }]" @blur="blurCount++" />
      </LpFormField>
      <button>After</button>
      <output aria-label="Blur count">{{ blurCount }}</output>
    </template>
    <template v-else-if="scenario === 'form'">
      <LpConfirmHost />
      <LpDrawer v-model:open="open" title="Edit service" :guard="service.dirty" no-drag-content>
        <form class="flex flex-col gap-4" novalidate @submit="submit">
          <LpInput v-bind="service.field('name')" label="Name" />
          <LpFormField label="Protocol" :error="service.field('proto').error">
            <LpSelect :model-value="service.values.proto" :invalid="service.field('proto').invalid" :options="[{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }]" @update:model-value="value => { if (typeof value === 'string') service.set('proto', value) }" @blur="service.touch('proto')" />
          </LpFormField>
          <LpRepeater v-model="service.values.ports" :create-item="emptyPort" label="Ports">
            <template #default="{ item }"><LpInput v-model="item.port" aria-label="Port" /></template>
          </LpRepeater>
          <LpButton type="submit" :loading="service.submitting">Save</LpButton>
        </form>
      </LpDrawer>
      <output aria-label="Saved service">{{ JSON.stringify(saved) }}</output>
      <output aria-label="Dirty">{{ service.dirty }}</output>
    </template>
  </main>
</template>
