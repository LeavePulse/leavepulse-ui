/*
 * Geometry shared by LpImageEditor's preview and its export, so what is drawn
 * on screen and what is written to the Blob come from one calculation.
 *
 * Three spaces are involved:
 * - source: the picture's own pixels, origin at its centre;
 * - upright: the source after the rotation, as the person sees it, origin at
 *   its centre, still in source-pixel units;
 * - frame: the crop box on screen, origin at its centre, in CSS pixels.
 *
 * A turn of θ (clockwise, as CSS and canvas both rotate in a y-down space)
 * maps source to upright by u = R(θ)·q. The picture is drawn at `cover` CSS
 * pixels per source pixel, then panned by `offset` and zoomed by `scale`, so a
 * frame point f shows the upright point (f / scale − offset) / cover.
 */

export interface Point {
  x: number
  y: number
}

export interface CropInput {
  sourceWidth: number
  sourceHeight: number
  frameWidth: number
  frameHeight: number
  /** Accumulated rotation in degrees; any angle, not only quarter turns. */
  rotation: number
  /** Zoom factor, 1 = the picture just covers the frame. */
  scale: number
  /** Pan in frame pixels before the zoom, as useZoomPan reports it. */
  offset: Point
}

export interface CropGeometry {
  /** CSS pixels per source pixel at zoom 1. */
  cover: number
  /** Crop size in upright (source-pixel) units. */
  width: number
  height: number
  /** Crop centre in upright space. */
  centre: Point
}

const radians = (deg: number) => (deg * Math.PI) / 180

/** Rotate a point clockwise by `deg` in a y-down space. */
export function rotatePoint(p: Point, deg: number): Point {
  const a = radians(deg)
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }
}

/** The source pixel (from the source's top-left) under an upright-space point. */
export function uprightToSource(u: Point, rotation: number, sourceWidth: number, sourceHeight: number): Point {
  const q = rotatePoint(u, -rotation)
  return { x: q.x + sourceWidth / 2, y: q.y + sourceHeight / 2 }
}

/**
 * Smallest scale at which the turned picture still covers the whole frame.
 *
 * Covering the bounding box of a turned picture is not enough at a free angle:
 * its corners are empty. The frame, turned back by the same angle, has to fit
 * inside the unturned picture; for a quarter turn this reduces to the usual
 * object-cover of the swapped dimensions.
 */
export function coverScale(
  sourceWidth: number,
  sourceHeight: number,
  frameWidth: number,
  frameHeight: number,
  rotation: number,
): number {
  const a = radians(rotation)
  const cos = Math.abs(Math.cos(a))
  const sin = Math.abs(Math.sin(a))
  return Math.max(
    (frameWidth * cos + frameHeight * sin) / sourceWidth,
    (frameWidth * sin + frameHeight * cos) / sourceHeight,
  )
}

/** What the frame holds, in upright space. */
export function cropGeometry(input: CropInput): CropGeometry {
  const cover = coverScale(
    input.sourceWidth,
    input.sourceHeight,
    input.frameWidth,
    input.frameHeight,
    input.rotation,
  )
  const shown = cover * input.scale
  return {
    cover,
    width: input.frameWidth / shown,
    height: input.frameHeight / shown,
    centre: { x: -input.offset.x / cover, y: -input.offset.y / cover },
  }
}

/** Whether the turn is closer to sideways than to upright. */
export function isSideways(rotation: number): boolean {
  const quarters = Math.round(rotation / 90)
  return ((quarters % 2) + 2) % 2 === 1
}
