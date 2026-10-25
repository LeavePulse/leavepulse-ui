<script setup lang="ts">
/*
 * The site's theme, tuned in place: a preset, any brand colour, corners and
 * control size, all applied live so every demo behind the panel re-skins while
 * you drag. Built the way an app would offer it: presets from the kit,
 * `withBrand` for the colour and everything that follows from it, `defineTheme`
 * for shape and density, and the choice remembered with `usePersisted`.
 */
import { ref } from "vue"
import { LpButton, LpCodeBlock, LpColorPicker, LpIcon, LpPopover, LpSegmented, presets, type RevealOrigin } from "../src"
import { BRANDS, PRESETS, useStudio, type Studio } from "./studio"

const { studio, brand, changed, exported, pickPreset, reset } = useStudio()
const format = ref<"code" | "json" | "css">("code")

const anchor = ref<HTMLElement | null>(null)
function origin(el?: Element | null): RevealOrigin | undefined {
  const r = (el ?? anchor.value)?.getBoundingClientRect()
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined
}

const label = "text-[11px] font-medium uppercase tracking-wide text-muted"
</script>

<template>
  <LpPopover side="bottom" align="end" panel-class="w-96 max-w-[calc(100vw-24px)]" aria-label="Theme studio">
    <template #trigger>
      <span ref="anchor" class="inline-flex">
        <LpButton variant="ghost" size="sm" aria-label="Theme studio">
          <span class="size-3.5 rounded-full ring-1 ring-line" :style="{ background: brand }" />
          <span class="max-sm:hidden">{{ presets[studio.preset].name }}</span>
          <LpIcon name="lucide:sliders-horizontal" :size="14" />
        </LpButton>
      </span>
    </template>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold text-ink">Theme</p>
        <LpButton v-if="changed" variant="ghost" size="xs" @click="reset(origin())">
          <LpIcon name="lucide:rotate-ccw" :size="12" />Reset
        </LpButton>
      </div>

      <div class="flex flex-col gap-2">
        <span :class="label">Preset</span>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="name in PRESETS"
            :key="name"
            type="button"
            class="flex flex-col items-center gap-1 rounded-control p-1.5 text-[11px] text-muted transition-colors hover:bg-surface-soft hover:text-ink"
            :class="studio.preset === name && 'bg-surface-soft text-ink'"
            :aria-pressed="studio.preset === name"
            @click="pickPreset(name, origin($event.currentTarget as Element))"
          >
            <span
              class="relative size-8 overflow-hidden rounded-full ring-2 transition-[box-shadow]"
              :class="studio.preset === name ? 'ring-brand' : 'ring-line'"
              :style="{ background: presets[name].colors.surface }"
            >
              <span class="absolute inset-x-0 bottom-0 h-1/2" :style="{ background: presets[name].colors.brand }" />
            </span>
            {{ presets[name].name }}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span :class="label">Brand colour</span>
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            v-for="color in BRANDS"
            :key="color"
            type="button"
            class="size-6 rounded-full ring-2 ring-offset-2 ring-offset-surface-raised transition-[box-shadow,transform] hover:scale-110"
            :class="brand === color ? 'ring-ink' : 'ring-transparent'"
            :style="{ background: color }"
            :aria-label="`Brand ${color}`"
            @click="brand = color"
          />
          <LpColorPicker v-model="brand" size="sm" aria-label="Any brand colour" />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3">
        <div class="flex flex-col gap-2">
          <span :class="label">Corners</span>
          <LpSegmented
            :model-value="studio.corners"
            size="sm"
            :options="[{ value: 'sharp', label: 'Sharp' }, { value: 'default', label: 'Default' }, { value: 'round', label: 'Round' }]"
            @update:model-value="(v: string) => (studio = { ...studio, corners: v as Studio['corners'] })"
          />
        </div>
        <div class="flex flex-col gap-2">
          <span :class="label">Control size</span>
          <LpSegmented
            :model-value="studio.size"
            size="sm"
            :options="[{ value: 'compact', label: 'Compact' }, { value: 'default', label: 'Default' }, { value: 'comfortable', label: 'Roomy' }]"
            @update:model-value="(v: string) => (studio = { ...studio, size: v as Studio['size'] })"
          />
        </div>
        <div class="flex flex-col gap-2">
          <span :class="label">Motion</span>
          <LpSegmented
            :model-value="studio.motion ?? 'normal'"
            size="sm"
            :options="[{ value: 'fast', label: 'Fast' }, { value: 'normal', label: 'Normal' }, { value: 'slow', label: 'Slow' }]"
            @update:model-value="(v: string) => (studio = { ...studio, motion: v as Studio['motion'] })"
          />
        </div>
      </div>

      <div class="flex flex-col gap-2 border-t border-line pt-3">
        <div class="flex items-center justify-between gap-2">
          <span :class="label">Use this theme</span>
          <LpSegmented
            v-model="format"
            size="sm"
            :options="[{ value: 'code', label: 'Code' }, { value: 'json', label: 'JSON' }, { value: 'css', label: 'CSS' }]"
          />
        </div>
        <LpCodeBlock :model-value="exported[format]" :lang="format === 'json' ? 'json' : format === 'css' ? 'plain' : 'ts'" copyable height="140px" class="text-[11px]" />
      </div>
    </div>
  </LpPopover>
</template>
