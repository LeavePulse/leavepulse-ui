import { computed, useAttrs, type ComputedRef, type MaybeRefOrGetter, toValue } from "vue"
import { cn } from "tailwind-variants"

/*
 * "The class the consumer passed should win."
 *
 * Tailwind emits `w-full` and `w-40` into the same layer with the same
 * specificity, so which one applies comes down to their order in the stylesheet
 * — not to which one the caller wrote. In practice the component's own class
 * won every time: `class="w-40"` on an input that styles itself `w-full` did
 * nothing, `border-r-0` could not cancel a sidebar's `border-r`, and a consumer
 * had no way to tell from the outside that their class was being ignored. The
 * usual workaround is to grow a prop for every class anyone might want to
 * override, which is a prop per Tailwind utility and never finishes.
 *
 * `tailwind-variants` already ships the conflict resolution (its `cn`), and the
 * kit already depends on it. This wraps it in the one shape components need:
 * take the component's own classes, fold in whatever arrived through `class`,
 * and let the caller's win where the two describe the same thing.
 *
 * Note it resolves CONFLICTS, not everything: `class="w-40"` beats `w-full`
 * because both are widths, while `class="shadow-lg"` is simply added, because
 * the component said nothing about shadows.
 */

/**
 * Merges the component's own classes with the `class` attribute the consumer
 * passed, resolving Tailwind conflicts in the consumer's favour.
 *
 * ```ts
 * const rootClass = useMergedClass(() => shell({ size: props.size }))
 * ```
 * ```vue
 * <div :class="rootClass">
 * ```
 *
 * Pair it with `inheritAttrs: false` (and bind the rest of `$attrs` yourself)
 * so the raw `class` does not land on the element a second time, unmerged.
 */
export function useMergedClass(
  own: MaybeRefOrGetter<string | undefined>,
): ComputedRef<string> {
  const attrs = useAttrs()
  // `cn` returns undefined when everything it was given was empty; a class
  // binding is happier with "" than with undefined.
  return computed(() => cn(toValue(own), attrs.class as string | undefined) ?? "")
}

/**
 * `useMergedClass` plus the rest of `$attrs`, for the common `inheritAttrs:
 * false` shape: bind `class` and `attrs` and the consumer's `class` lands once,
 * merged, while ids, handlers and aria-* still reach the element.
 *
 * ```ts
 * const { class: rootClass, attrs: rest } = useMergedAttrs(() => card({ padded }))
 * ```
 * ```vue
 * <div :class="rootClass" v-bind="rest">
 * ```
 *
 * Binding the raw `$attrs` alongside a merged class is the bug this avoids:
 * Vue appends that second `class` to the merged one, and stylesheet order —
 * not the caller — decides which wins.
 */
export function useMergedAttrs(own: MaybeRefOrGetter<string | undefined>): {
  class: ComputedRef<string>
  attrs: ComputedRef<Record<string, unknown>>
} {
  const attrs = useAttrs()
  return {
    class: useMergedClass(own),
    attrs: computed(() => {
      const { class: _omitted, ...rest } = attrs
      return rest
    }),
  }
}

/**
 * The same merge as a plain function, for the places that already have both
 * strings in hand and do not need the attrs lookup — a render helper, or a
 * component merging a class onto a child rather than its own root.
 */
export function mergeClass(...classes: (string | undefined | null | false)[]): string {
  return cn(...classes) ?? ""
}
