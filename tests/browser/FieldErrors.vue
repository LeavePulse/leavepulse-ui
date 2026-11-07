<script setup lang="ts">
import { LpAddressInput, LpAutocomplete, LpCheckbox, LpColorPicker, LpDatePicker, LpDateRangePicker, LpFormField, LpInput, LpNumberField, LpOtpInput, LpPhoneInput, LpRadioGroup, LpRangeSlider, LpRepeater, LpSegmented, LpSelect, LpSlider, LpSwitch, LpTagsInput, LpTextarea, LpTimeField } from "../../src"

/*
 * Every field control given the `error` that form.field() hands it: alone it
 * shows the message under itself, and inside an LpFormField that has the
 * message already it only marks itself invalid, so the message shows once.
 */
const inside = new URLSearchParams(location.search).has("inside")
const options = [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }]
const controls = [
  { name: "input", is: LpInput, props: { "aria-label": "input" } },
  { name: "textarea", is: LpTextarea, props: { "aria-label": "textarea" } },
  { name: "tags", is: LpTagsInput, props: { "aria-label": "tags" } },
  { name: "select", is: LpSelect, props: { "aria-label": "select", options } },
  { name: "autocomplete", is: LpAutocomplete, props: { "aria-label": "autocomplete", options: ["Alpha", "Beta"] } },
  { name: "number", is: LpNumberField, props: { "aria-label": "number" } },
  { name: "otp", is: LpOtpInput, props: { "aria-label": "otp" } },
  { name: "phone", is: LpPhoneInput, props: { "aria-label": "phone" } },
  { name: "address", is: LpAddressInput, props: { "aria-label": "address" } },
  { name: "date", is: LpDatePicker, props: { "aria-label": "date" } },
  { name: "range", is: LpDateRangePicker, props: { "aria-label": "range" } },
  { name: "time", is: LpTimeField, props: { "aria-label": "time" } },
  { name: "color", is: LpColorPicker, props: { "aria-label": "color" } },
  { name: "slider", is: LpSlider, props: { "aria-label": "slider" } },
  { name: "rangeSlider", is: LpRangeSlider, props: { "aria-label": "rangeSlider" } },
  { name: "segmented", is: LpSegmented, props: { "aria-label": "segmented", options } },
  { name: "radio", is: LpRadioGroup, props: { "aria-label": "radio", options } },
  { name: "checkbox", is: LpCheckbox, props: { label: "checkbox" } },
  { name: "switch", is: LpSwitch, props: { "aria-label": "switch" } },
  { name: "repeater", is: LpRepeater, props: { createItem: () => ({}) } },
]
</script>

<template>
  <main class="flex max-w-xl flex-col gap-4 p-6">
    <div v-for="c in controls" :key="c.name" :data-field="c.name">
      <LpFormField v-if="inside" :label="`Outer ${c.name}`" :error="`Broken ${c.name}`">
        <component :is="c.is" v-bind="c.props" :error="`Broken ${c.name}`" />
      </LpFormField>
      <component :is="c.is" v-else v-bind="c.props" :error="`Broken ${c.name}`" />
    </div>
  </main>
</template>
