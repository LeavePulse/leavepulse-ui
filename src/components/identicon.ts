/*
 * Identicons: a picture derived from a string, so something with no avatar
 * of its own (a new account, a server, an API key, a commit) still gets a
 * face that is the same every time and different from its neighbours.
 *
 * The pattern is a small pixel grid mirrored left to right, the way faces
 * and logos are: symmetry is what makes a random grid read as a shape rather
 * than noise, and it halves the bits each picture needs.
 *
 * The colour comes from the same hash, but only the HUE is free. Saturation
 * and lightness are held to a middle band so every identicon reads on a dark
 * surface and on a light one alike; a free lightness would hand some seeds a
 * near-black shape that vanishes in a dark theme and others a pale one that
 * vanishes in a light theme.
 *
 * Pure and deterministic: no randomness beyond the seed, no DOM. The same
 * seed gives the same picture on the server, in the client and across
 * releases, which is what lets a user recognise it.
 */

export interface IdenticonOptions {
  /** Cells per side. 5 is the familiar look; more cells, busier shapes. */
  grid?: number
  /** Saturation range, percent. Kept in the middle so the colour holds on any theme. */
  saturation?: readonly [number, number]
  /** Lightness range, percent: dark enough for a light theme, light enough for a dark one. */
  lightness?: readonly [number, number]
}

export interface Identicon {
  /** Rows of cells, `true` filled. Mirrored left to right. */
  cells: boolean[][]
  /** The hue the seed picked, 0–360. */
  hue: number
  /** The shape's colour as a CSS `hsl()`. */
  color: string
}

/*
 * FNV-1a over the string's UTF-16 units. Not a secure hash and not meant to
 * be: it only has to spread similar ids ("user-1", "user-2") far apart, which
 * it does, in a few lines that give the same answer on every engine.
 */
export function hashString(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/*
 * A small seeded generator (mulberry32). The hash alone has 32 bits, and a
 * 7×7 grid wants more than that; drawing from a generator seeded with it
 * keeps every bit dependent on the whole string.
 */
function generator(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The grid and colour for a seed. */
export function identicon(seed: string, options: IdenticonOptions = {}): Identicon {
  const size = Math.max(3, Math.min(12, Math.round(options.grid ?? 5)))
  const [sMin, sMax] = options.saturation ?? [55, 72]
  const [lMin, lMax] = options.lightness ?? [48, 60]
  const next = generator(hashString(seed))

  const hue = Math.floor(next() * 360)
  const saturation = Math.round(sMin + next() * (sMax - sMin))
  const lightness = Math.round(lMin + next() * (lMax - lMin))

  const half = Math.ceil(size / 2)
  const cells: boolean[][] = []
  let filled = 0
  for (let y = 0; y < size; y++) {
    const row: boolean[] = new Array(size).fill(false)
    for (let x = 0; x < half; x++) {
      const on = next() < 0.5
      row[x] = on
      row[size - 1 - x] = on
      if (on) filled++
    }
    cells.push(row)
  }

  /*
   * A grid that came out nearly empty or nearly full is not a shape, just a
   * dot or a block. Flip cells in a seed-driven order until the half holds
   * between a third and two thirds of its cells.
   */
  const total = half * size
  const low = Math.ceil(total / 3)
  const high = Math.floor((total * 2) / 3)
  while (filled < low || filled > high) {
    const y = Math.floor(next() * size)
    const x = Math.floor(next() * half)
    const on = cells[y][x]
    if ((filled < low && on) || (filled > high && !on)) continue
    cells[y][x] = !on
    cells[y][size - 1 - x] = !on
    filled += on ? -1 : 1
  }

  return { cells, hue, color: `hsl(${hue} ${saturation}% ${lightness}%)` }
}

/** The filled cells as rectangles, merged along each row: fewer nodes than one per cell. */
export function identiconRects(cells: boolean[][]): { x: number; y: number; w: number }[] {
  const rects: { x: number; y: number; w: number }[] = []
  cells.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!row[x]) {
        x++
        continue
      }
      let w = 1
      while (x + w < row.length && row[x + w]) w++
      rects.push({ x, y, w })
      x += w
    }
  })
  return rects
}

export interface IdenticonSvgOptions extends IdenticonOptions {
  /** Pixel size of the square image. */
  size?: number
  /** Fill behind the pattern, any CSS colour; transparent when unset. */
  background?: string
  /** Empty margin around the grid, as a share of the side. */
  padding?: number
}

/**
 * The identicon as standalone SVG markup, for places a component cannot go:
 * a favicon, a canvas, a notification icon (`data:image/svg+xml,…`).
 */
export function identiconSvg(seed: string, options: IdenticonSvgOptions = {}): string {
  const { cells, color } = identicon(seed, options)
  const n = cells.length
  const pad = n * Math.max(0, Math.min(0.4, options.padding ?? 0.12))
  const view = n + pad * 2
  const px = options.size ?? 64
  const bg = options.background ? `<rect width="${view}" height="${view}" fill="${options.background}"/>` : ""
  const shapes = identiconRects(cells)
    .map((r) => `<rect x="${r.x + pad}" y="${r.y + pad}" width="${r.w}" height="1"/>`)
    .join("")
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${view} ${view}" shape-rendering="crispEdges">` +
    `${bg}<g fill="${color}">${shapes}</g></svg>`
  )
}
