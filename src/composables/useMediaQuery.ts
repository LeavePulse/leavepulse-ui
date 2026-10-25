import { onBeforeUnmount, onMounted, ref, type Ref } from "vue"
import { useView, viewWindow } from "./useView"

/*
 * A media query as a ref. False until mounted, so the server and the hydrating
 * client render the same thing and the client switches right after. Asked of
 * the window the component renders in, so inside an LpFrame narrowed to a
 * phone a width query answers for the phone.
 */
export function useMediaQuery(query: string): Ref<boolean> {
  const view = useView()
  const matches = ref(false)
  let list: MediaQueryList | undefined
  const update = () => {
    matches.value = !!list?.matches
  }
  onMounted(() => {
    list = viewWindow(view.value).matchMedia?.(query)
    update()
    list?.addEventListener("change", update)
  })
  onBeforeUnmount(() => list?.removeEventListener("change", update))
  return matches
}
