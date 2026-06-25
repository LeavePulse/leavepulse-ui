<script setup lang="ts">
/**
 * Custom Vue Flow node for a project SWIMLANE on LpTopologyCanvas: a sized
 * background zone that groups the nodes of one project (overlay network). It is
 * a NODE (not an overlay) so Vue Flow transforms it with pan/zoom for free.
 *
 * Purely decorative: the lane never intercepts pointer events (pan/drag pass
 * through to the canvas), is non-selectable / non-draggable (set on the node
 * object by the canvas), and sits below real nodes via a low z-index. The label
 * tab stays clickable-looking but is inert. Tailwind utilities only so styles
 * reach consumer apps via @source.
 */
export interface LaneNodeData {
  label: string
  /** Optional accent colour token for the lane border + label. */
  accent?: string
  width: number
  height: number
}

const props = defineProps<{ data: LaneNodeData }>()
</script>

<template>
  <div
    class="pointer-events-none rounded-card border border-dashed"
    :style="{
      width: `${props.data.width}px`,
      height: `${props.data.height}px`,
      borderColor: props.data.accent ?? 'var(--color-line)',
      background:
        'color-mix(in srgb, ' +
        (props.data.accent ?? 'var(--color-line-strong)') +
        ' 6%, transparent)',
    }"
  >
    <div
      class="inline-flex translate-y-[-50%] items-center gap-1.5 rounded-pill border bg-surface px-2.5 py-0.5 text-[11px] font-semibold tracking-wide"
      :style="{
        borderColor: props.data.accent ?? 'var(--color-line)',
        color: props.data.accent ?? 'var(--color-muted-strong)',
        marginLeft: '14px',
      }"
    >
      {{ props.data.label }}
    </div>
  </div>
</template>
