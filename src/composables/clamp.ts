/** `value` held between `min` and `max`. When they cross, `max` wins. */
export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
