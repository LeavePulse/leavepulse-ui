<script setup lang="ts">
import { ref } from "vue"
import type { DateRange } from "../../src"
import { LpAlert, LpAutocomplete, LpBadge, LpButton, LpCard, LpCheckbox, LpCodeBlock, LpColorPicker, LpConfirmHost, LpContextMenu, LpDataList, LpDatePicker, LpDateRangePicker, LpDrawer, LpDropdownMenu, LpEditable, LpEmptyState, LpHoverCard, LpImageEditor, LpInput, LpLightbox, LpModal, LpNotificationBell, LpNumberField, LpPhoneInput, LpRadioGroup, LpSection, LpSegmented, LpSlider, LpStat, LpSwitch, LpPopover, LpSelect, LpTagsInput, LpTextarea, LpTimeField, LpToaster, LpTooltip, confirm, useToast } from "../../src"

const tags = ref(["alpha"])
const time = ref("09:30")
const name = ref("Ada")
const code = ref("let a = 1")
const picked = ref("a")
const typed = ref("")
const phone = ref("")
const modal = ref(false)
const drawer = ref(false)
const bottom = ref(false)
const date = ref<string>()
const range = ref<DateRange>()
const colour = ref("#3366ff")
const menu = [{ label: "Rename", onSelect: () => {} }, { label: "A rather long action label that will not fit on a narrow phone screen", onSelect: () => {} }, { label: "Delete", onSelect: () => {} }]
const toast = useToast()
const many = Array.from({ length: 30 }, (_, i) => ({ value: `o${i + 1}`, label: `Option ${i + 1}` }))
const manyPicked = ref("o1")
const lightbox = ref(false)
const tipClicks = ref(0)
const long = "3f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c"
const wordy = ref(false)
const wordyDrawer = ref(false)
const edgeDrawer = ref(false)
const ticked = ref(false)
const on = ref(false)
const choice = ref("a")
const level = ref(0)
const segment = ref("a")
const pixel = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="3000"><rect width="4000" height="3000" fill="gray"/></svg>')
const images = [{ src: pixel, title: "One" }, { src: `${pixel}#2`, title: "Two" }]
</script>

<template>
  <main class="mx-auto flex max-w-xl flex-col gap-4 p-4">
    <section aria-label="Entries" class="flex flex-col gap-3">
      <LpInput aria-label="Small input" size="sm" />
      <LpInput aria-label="Input" />
      <LpTextarea aria-label="Notes" />
      <LpNumberField aria-label="Count" size="sm" :model-value="2" />
      <LpTagsInput v-model="tags" aria-label="Tags" />
      <LpTimeField v-model="time" aria-label="Time" />
      <LpAutocomplete v-model="typed" aria-label="City" :options="['Kyiv', 'Lviv']" />
      <LpPhoneInput v-model="phone" aria-label="Phone" />
      <LpEditable v-model="name" label="Name" />
      <LpCodeBlock v-model="code" :locked="false" lang="ts" />
      <LpSelect v-model="manyPicked" searchable aria-label="Many" :options="many" />
      <LpSelect v-model="picked" searchable aria-label="Searchable" :options="[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]" />
    </section>
    <section aria-label="Words" class="flex flex-col gap-3">
      <LpAlert :title="long">{{ long }}</LpAlert>
      <LpSection :title="long" :description="long"><p>Body</p></LpSection>
      <LpDataList :items="[{ label: long, value: long, copyable: true }]" />
      <LpStat :label="long" :value="long" />
      <LpBadge>{{ long }}</LpBadge>
      <LpCard>{{ long }}</LpCard>
      <LpButton @click="toast.info(long)">Long toast</LpButton>
      <LpButton @click="wordy = true">Long modal</LpButton>
      <LpModal v-model:open="wordy" :title="long" :description="long"><p>{{ long }}</p></LpModal>
      <LpEmptyState :title="long" :description="long" />
      <LpButton @click="confirm({ title: long, description: long })">Long confirm</LpButton>
      <LpConfirmHost />
      <LpButton @click="wordyDrawer = true">Long drawer</LpButton>
      <LpDrawer v-model:open="wordyDrawer" :title="long" :description="long"><p>{{ long }}</p></LpDrawer>
    </section>
    <section aria-label="Targets" class="flex flex-col items-start gap-6">
      <LpCheckbox v-model="ticked" label="Tick" />
      <LpSwitch v-model="on" label="Toggle" />
      <LpRadioGroup v-model="choice" aria-label="Choice" :options="[{ value: 'a', label: 'First' }, { value: 'b', label: 'Second' }]" />
      <LpSegmented v-model="segment" size="sm" aria-label="Segments" :options="[{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }]" />
      <LpButton size="xs" square aria-label="Tiny">+</LpButton>
      <div class="w-full" data-test-slider><LpSlider v-model="level" aria-label="Level" :min="0" :max="100" /></div>
      <output aria-label="Level value">{{ level }}</output>
    </section>
    <section aria-label="Editor">
      <LpImageEditor :file="pixel" aspect="square" />
    </section>
    <section aria-label="Overlays" class="flex flex-wrap gap-2">
      <LpButton @click="modal = true">Open modal</LpButton>
      <LpModal v-model:open="modal" title="A modal with a rather long title on a phone" size="lg">
        <div class="flex flex-col gap-3">
          <LpInput label="First field" />
          <p v-for="n in 30" :key="n">Line {{ n }}</p>
          <LpInput label="Last field" />
        </div>
        <template #footer><LpButton @click="modal = false">Done</LpButton></template>
      </LpModal>
      <LpButton @click="drawer = true">Open drawer</LpButton>
      <LpDrawer v-model:open="drawer" title="Side drawer" size="lg"><p v-for="n in 40" :key="n">Row {{ n }}</p></LpDrawer>
      <LpDrawer v-model:open="edgeDrawer" side="left" edge-open title="Edge drawer"><p v-for="n in 30" :key="n">Link {{ n }}</p></LpDrawer>
      <p data-testid="edge-state">{{ edgeDrawer ? "open" : "closed" }}</p>
      <LpButton @click="bottom = true">Open sheet</LpButton>
      <LpDrawer v-model:open="bottom" direction="bottom" title="Bottom sheet"><LpInput label="Sheet field" /></LpDrawer>
      <LpPopover aria-label="Wide popover" panel-class="w-96">
        <template #trigger><LpButton>Open popover</LpButton></template>
        <p>Popover body that is fairly wide</p>
      </LpPopover>
      <LpDropdownMenu :items="menu">
        <template #trigger><LpButton>Open menu</LpButton></template>
      </LpDropdownMenu>
      <LpContextMenu :items="menu"><div class="h-12 w-40 border border-line">Press and hold</div></LpContextMenu>
      <LpDatePicker v-model="date" aria-label="Date" presets time />
      <LpDateRangePicker v-model="range" aria-label="Range" />
      <LpColorPicker v-model="colour" aria-label="Colour" />
      <LpTooltip content="Tooltip text"><LpButton @click="tipClicks++">Has tooltip</LpButton></LpTooltip>
      <output aria-label="Tip clicks">{{ tipClicks }}</output>
      <LpHoverCard><template #trigger><a href="#hc">Hover card</a></template><p>Card body</p></LpHoverCard>
      <LpNotificationBell :items="[]" />
      <LpButton @click="toast.success('Saved')">Toast</LpButton>
      <LpToaster />
      <LpButton @click="lightbox = true">Open lightbox</LpButton>
      <LpLightbox v-model:open="lightbox" :items="images" />
    </section>
  </main>
</template>
