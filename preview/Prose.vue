<script setup lang="ts">
import { computed } from "vue"
import { blocks } from "./prose"

const props = defineProps<{ text: string }>()
const parts = computed(() => blocks(props.text))
</script>

<template>
  <div class="flex flex-col gap-2 text-sm leading-relaxed text-muted">
    <template v-for="(block, b) in parts" :key="b">
      <p v-if="block.kind === 'p'">
        <template v-for="(part, i) in block.parts" :key="i">
          <code v-if="part.code" class="rounded-sm bg-surface-soft px-1 py-px font-mono text-[0.8125rem] text-ink">{{ part.text }}</code>
          <template v-else>{{ part.text }}</template>
        </template>
      </p>
      <ul v-else class="flex list-disc flex-col gap-1 pl-5 marker:text-line-strong">
        <li v-for="(item, n) in block.items" :key="n">
          <template v-for="(part, i) in item" :key="i">
            <code v-if="part.code" class="rounded-sm bg-surface-soft px-1 py-px font-mono text-[0.8125rem] text-ink">{{ part.text }}</code>
            <template v-else>{{ part.text }}</template>
          </template>
        </li>
      </ul>
    </template>
  </div>
</template>
