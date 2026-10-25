/*
 * Column maths for LpMasonry, kept free of the DOM so it can be tested.
 */

export interface MasonryColumns {
  /**
   * Fixed count, or a table of minimum container widths to counts
   * (`{ 0: 1, 480: 2, 900: 3 }`). Omit to derive the count from `minColumnWidth`.
   */
  columns?: number | Record<number, number>
  /** Narrowest a column may get when the count is derived. */
  minColumnWidth: number
  /** Upper bound for a derived count, so a wide screen does not shred cards into slivers. */
  maxColumns?: number
  gap: number
}

/** How many columns fit a container `width` px wide. Always at least one. */
export function masonryColumnCount(width: number, options: MasonryColumns): number {
  const { columns, minColumnWidth, maxColumns, gap } = options
  if (typeof columns === "number") return Math.max(1, Math.floor(columns))
  if (columns) {
    let picked = 1
    let best = -Infinity
    for (const [min, count] of Object.entries(columns)) {
      const at = Number(min)
      if (width >= at && at > best) {
        best = at
        picked = count
      }
    }
    return Math.max(1, Math.floor(picked))
  }
  const fit = Math.floor((width + gap) / (Math.max(1, minColumnWidth) + gap))
  return Math.max(1, Math.min(fit, maxColumns ?? Infinity))
}

export interface MasonryPlacement {
  /** Left edge of each item, in px, in input order. */
  x: number[]
  /** Top edge of each item, in px, in input order. */
  y: number[]
  /** Column each item went to. */
  column: number[]
  /** Width every item is laid out at. */
  columnWidth: number
  /** Height of the tallest column: the container's height. */
  height: number
}

/**
 * Places items in order, each into the column that is currently shortest
 * (leftmost on a tie). In order, so the first items stay at the top and an
 * item added at the end never reshuffles the ones before it.
 */
export function placeMasonry(heights: number[], count: number, width: number, gap: number): MasonryPlacement {
  const columns = Math.max(1, count)
  const columnWidth = Math.max(0, (width - gap * (columns - 1)) / columns)
  const bottoms = new Array<number>(columns).fill(0)
  const x: number[] = []
  const y: number[] = []
  const column: number[] = []
  for (const height of heights) {
    let shortest = 0
    for (let c = 1; c < columns; c += 1) if (bottoms[c]! < bottoms[shortest]! - 0.5) shortest = c
    x.push(shortest * (columnWidth + gap))
    y.push(bottoms[shortest]!)
    column.push(shortest)
    bottoms[shortest] = bottoms[shortest]! + Math.max(0, height) + gap
  }
  const tallest = Math.max(0, ...bottoms)
  return { x, y, column, columnWidth, height: heights.length ? tallest - gap : 0 }
}
