const COLLATOR = new Intl.Collator(undefined, { numeric: true })

const rank = (v: unknown): number => {
  if (v == null || (typeof v === "number" && Number.isNaN(v))) return 0
  if (typeof v === "boolean") return 1
  if (typeof v === "number" || typeof v === "bigint") return 2
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? 0 : 3
  return 4
}

/**
 * Ascending order for raw cell values. Empty values (null, undefined, NaN, an
 * invalid Date) come first; numbers, bigints and Dates compare by magnitude,
 * booleans false before true, everything else as text with numeric runs read as
 * numbers ("file 2" before "file 10"). Mixed kinds group by kind so the order
 * is total and a sort is stable from one run to the next.
 */
export function compareValues(a: unknown, b: unknown): number {
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  switch (ra) {
    case 0:
      return 0
    case 1:
      return Number(a) - Number(b)
    case 2: {
      const x = a as number | bigint
      const y = b as number | bigint
      return x < y ? -1 : x > y ? 1 : 0
    }
    case 3:
      return (a as Date).getTime() - (b as Date).getTime()
    default:
      return COLLATOR.compare(String(a), String(b))
  }
}
