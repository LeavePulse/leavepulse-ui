import { defineComponent, h, type PropType } from "vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"

/*
 * A right-click menu around a component's root, only when there is one.
 *
 * LpContextMenu renders more than one node (its trigger and the menu's
 * portal), and Vue applies a directive put on a component (`v-hint`,
 * `v-tooltip`) only to a single root element: wrapped unconditionally, a card
 * silently dropped every directive the app put on it. So with no items the
 * slot's element is the root itself, and only a card that really has a menu
 * pays for the wrapper. Items arriving after the first render do remount the
 * content once; that is the lesser loss.
 */
export const MenuWhen = defineComponent({
  name: "MenuWhen",
  inheritAttrs: false,
  props: {
    items: { type: Array as PropType<ContextMenuItemDef[]>, default: undefined },
    title: { type: String, default: undefined },
    subtitle: { type: String, default: undefined },
    titleImage: { type: String, default: undefined },
    titleIcon: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    return () => {
      if (props.items?.length) {
        return h(
          LpContextMenu,
          { items: props.items, title: props.title, subtitle: props.subtitle, titleImage: props.titleImage, titleIcon: props.titleIcon },
          slots,
        )
      }
      return slots.default?.()[0]
    }
  },
})
