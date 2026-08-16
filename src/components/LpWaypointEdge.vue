<script setup lang="ts">
/**
 * An edge that curves THROUGH a list of waypoints.
 *
 * The built-in shapes each fail one way in a layered graph: a bezier bulges off
 * the line between its ends and cuts through whatever stands between the
 * columns, and orthogonal routing clears the cards but draws the graph as a
 * grid of right angles. Given the gaps a layout already knows about, a curve
 * threaded through them is both — clear of the cards and still a curve.
 *
 * Waypoints ride on the edge's `data.waypoints`; with none, this is a plain
 * bezier, so the type is safe to use for every edge in a graph.
 */
import { BaseEdge, getBezierPath, Position } from "@vue-flow/core"
import { computed } from "vue"

const props = defineProps<{
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition?: Position
  targetPosition?: Position
  data?: { waypoints?: { x: number; y: number }[] }
  markerEnd?: string
  style?: Record<string, unknown>
}>()

/*
 * Catmull-Rom through the points, converted to cubic beziers — the standard way
 * to get a curve that actually passes through its control points rather than
 * being pulled towards them. Tension 0.5 keeps it taut enough not to loop back
 * on itself between closely spaced waypoints.
 */
function splineThrough(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ""
  const p = [points[0]!, ...points, points[points.length - 1]!]
  let d = `M${points[0]!.x},${points[0]!.y}`
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1]!
    const p1 = p[i]!
    const p2 = p[i + 1]!
    const p3 = p[i + 2]!
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }
  return d
}

const path = computed(() => {
  const via = props.data?.waypoints ?? []
  if (!via.length) {
    const [d] = getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      sourcePosition: props.sourcePosition ?? Position.Right,
      targetPosition: props.targetPosition ?? Position.Left,
    })
    return d
  }
  return splineThrough([
    { x: props.sourceX, y: props.sourceY },
    ...via,
    { x: props.targetX, y: props.targetY },
  ])
})
</script>

<template>
  <BaseEdge :id="id" :path="path" :marker-end="markerEnd" :style="style" />
</template>
