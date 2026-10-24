import { onBeforeUnmount, onMounted, ref, type Ref } from "vue"

/*
 * A media query as a ref. False until mounted, so the server and the hydrating
 * client render the same thing and the client switches right after.
 */
export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false)
  let list: MediaQueryList | undefined
  const update = () => {
    matches.value = !!list?.matches
  }
  onMounted(() => {
    list = window.matchMedia?.(query)
    update()
    list?.addEventListener("change", update)
  })
  onBeforeUnmount(() => list?.removeEventListener("change", update))
  return matches
}
