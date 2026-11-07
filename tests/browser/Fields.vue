<script setup lang="ts">
import { defineComponent, h, ref } from "vue"
import { LpButton, LpCheckbox, LpInput, LpPopover, LpSelect, LpSwitch, LpTextarea } from "../../src"

const masked = ref("")
const raw = ref("")
const clearableReadonly = ref("value")
const clearableNull = ref("value")
const checked = ref(false)
const mixed = ref(true)
const focused = ref(0)
const bare = ref(false)
const picked = ref<string[]>(["alpha", "beta", "gamma"])
const single = ref("a")
const clicks = ref(0)

async function failSave() {
  throw new Error("nope")
}

const SingleRoot = defineComponent({ setup: (_, { slots, attrs }) => () => h("button", { type: "button", ...attrs }, slots.default?.()) })
const FragmentRoot = defineComponent({ inheritAttrs: false, setup: (_, { slots }) => () => [h("span", "before"), h("button", { type: "button", "data-fragment": "" }, slots.default?.())] })
</script>

<template>
  <main class="mx-auto flex max-w-xl flex-col gap-4 p-6">
    <p id="outer-help">Outer help</p>

    <LpInput aria-label="Bare described" aria-describedby="outer-help" />
    <LpInput aria-label="Hinted described" aria-describedby="outer-help" hint="Own hint" />
    <LpTextarea aria-label="Area described" aria-describedby="outer-help" />
    <LpSwitch v-model="bare" label="Switch described" description="Own line" aria-describedby="outer-help" />

    <LpInput v-model="masked" aria-label="Masked" mask="****-****" :restrict="/[0-9]/" @update:raw="raw = $event" />
    <output aria-label="Masked model">{{ masked }}</output>
    <output aria-label="Masked raw">{{ raw }}</output>

    <LpInput v-model="clearableReadonly" aria-label="Readonly field" clearable readonly />
    <LpInput v-model="clearableNull" aria-label="Null readonly" clearable :readonly="null" />

    <LpCheckbox v-model="checked" label="Described box" aria-describedby="outer-help" data-box="yes" name="box" @focus="focused++" />
    <output aria-label="Focused">{{ focused }}</output>
    <LpCheckbox aria-label="Named box" />
    <LpCheckbox v-model="checked" v-model:indeterminate="mixed" label="Mixed box" :action="failSave" @error="() => {}" />
    <output aria-label="Mixed">{{ mixed }}</output>

    <LpSelect v-model="single" aria-label="Single" :options="[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]" />
    <button>After select</button>
    <LpSelect v-model="picked" multiple aria-label="Chips" class="w-60" :options="[{ value: 'alpha', label: 'Alpha' }, { value: 'beta', label: 'Beta' }, { value: 'gamma', label: 'Gamma' }]" />

    <LpButton :as="SingleRoot" hotkey="Shift+K" @click="clicks++">Single root</LpButton>
    <LpButton :as="FragmentRoot" hotkey="Shift+L" @click="clicks++">Fragment root</LpButton>
    <output aria-label="Clicks">{{ clicks }}</output>

    <LpPopover aria-labelledby="popover-title">
      <template #trigger><LpButton>Open popover</LpButton></template>
      <h2 id="popover-title">Popover title</h2>
    </LpPopover>
    <LpPopover aria-label="Named panel">
      <template #trigger><LpButton>Open named</LpButton></template>
      <p>Body</p>
    </LpPopover>
  </main>
</template>
