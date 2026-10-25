/*
 * Magnification curve for LpDock, apart from the component for testing.
 */

/**
 * Size of an item whose centre is `distance` px from the pointer.
 *
 * A raised cosine: full size right under the pointer, falling smoothly to the
 * resting size at `radius` and flat beyond it. A linear falloff has a corner
 * at the peak, which shows as the hovered icon "ticking" between sizes while
 * the pointer crosses it.
 */
export function dockSize(base: number, max: number, distance: number, radius: number): number {
  const d = Math.abs(distance)
  if (radius <= 0 || d >= radius) return base
  return base + (max - base) * ((Math.cos((Math.PI * d) / radius) + 1) / 2)
}

/**
 * Offset of a magnetic element toward a pointer at (`dx`, `dy`) px from its
 * centre (LpMagnetic). Zero beyond `reach`; inside it the pull is a fraction
 * of the distance that fades out toward the edge of the field, so the element
 * lets go gradually instead of snapping back at an invisible line.
 */
export function magneticOffset(dx: number, dy: number, reach: number, strength: number): { x: number; y: number } {
  const distance = Math.hypot(dx, dy)
  if (reach <= 0 || distance >= reach) return { x: 0, y: 0 }
  const falloff = 1 - distance / reach
  const pull = Math.max(0, strength) * falloff
  return { x: dx * pull, y: dy * pull }
}
