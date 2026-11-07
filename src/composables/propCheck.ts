import { Teleport, type ComponentPublicInstance, type Plugin, type VNode } from "vue"

/*
 * Development check for a misspelt prop on a kit component.
 *
 * A prop a component does not declare falls through as an attribute with no
 * error, and vue-tsc's own `checkUnknownProps` cannot tell that apart from the
 * `id`, `title` or `aria-*` an app rightly passes through. Here the attribute
 * is checked against the element it would land on, so `<LpTooltip text>` is
 * reported and `<LpInput autocomplete>` is not.
 *
 * Install it in development only:
 *
 *   if (import.meta.env.DEV) app.use(lpPropCheck)
 *
 * The Nuxt module does that on its own. Attributes of a third-party library
 * that nothing here can know go in `ignore`.
 */
export interface PropCheckOptions {
  /** Attributes that are not a mistake: exact names or patterns. */
  ignore?: (string | RegExp)[]
  /** Where a report goes. Defaults to console.warn. */
  warn?: (message: string) => void
}

const KIT_COMPONENT = /^Lp[A-Z]/
const ALWAYS_ALLOWED = /^(data-|aria-|on[A-Z])/
const GLOBAL_ATTRIBUTES = new Set([
  "accesskey", "class", "contenteditable", "dir", "draggable", "enterkeyhint", "for", "hidden",
  "id", "inert", "inputmode", "is", "key", "lang", "nonce", "popover", "ref", "role", "slot",
  "spellcheck", "style", "tabindex", "title", "translate",
])
/* Where a component with `inheritAttrs: false` hands its attributes on to. */
const FORWARD_TARGETS = "input, textarea, select, button, a, img, form, label"

const propertiesByTag = new Map<string, Set<string>>()

function propertiesOf(el: Element): Set<string> {
  let known = propertiesByTag.get(el.tagName)
  if (!known) {
    known = new Set<string>()
    for (const name in el) known.add(name.toLowerCase())
    propertiesByTag.set(el.tagName, known)
  }
  return known
}

const normalized = (name: string) => name.replaceAll("-", "").toLowerCase()

/** The attributes no element under this component could take. */
export function unknownAttributes(
  attributes: string[],
  elements: Element[],
  ignore: PropCheckOptions["ignore"] = [],
): string[] {
  return attributes.filter((name) => {
    if (ALWAYS_ALLOWED.test(name) || GLOBAL_ATTRIBUTES.has(name.toLowerCase())) return false
    if (ignore.some((rule) => (typeof rule === "string" ? rule === name : rule.test(name)))) return false
    const key = normalized(name)
    return !elements.some((el) => propertiesOf(el).has(key))
  })
}

/*
 * The elements a component rendered at its top. Not `$el`: with several roots
 * (a trigger and its portal) that is the fragment's empty text anchor, which
 * made every attribute look unknown. A teleport's content is left out, since
 * nothing a caller passes lands there.
 */
function rootElements(vnode: VNode | null | undefined, out: Element[] = []): Element[] {
  if (!vnode || vnode.type === Teleport) return out
  if (vnode.component) return rootElements(vnode.component.subTree, out)
  const el = vnode.el as Node | null
  if (el?.nodeType === 1) {
    out.push(el as Element)
    return out
  }
  if (Array.isArray(vnode.children)) for (const child of vnode.children) if (child && typeof child === "object") rootElements(child as VNode, out)
  return out
}

function renderedElements(instance: ComponentPublicInstance): Element[] {
  return rootElements(instance.$.subTree).flatMap((el) => [el, ...el.querySelectorAll(FORWARD_TARGETS)])
}

export const lpPropCheck: Plugin<[PropCheckOptions?]> = {
  install(app, options = {}) {
    const warn = options.warn ?? ((message: string) => console.warn(message))
    const reported = new Set<string>()
    app.mixin({
      mounted(this: ComponentPublicInstance) {
        const name = this.$options.__name
        if (!name || !KIT_COMPONENT.test(name)) return
        const attributes = Object.keys(this.$attrs)
        if (!attributes.length) return
        for (const attribute of unknownAttributes(attributes, renderedElements(this), options.ignore)) {
          const id = `${name}:${attribute}`
          if (reported.has(id)) continue
          reported.add(id)
          warn(`[@leavepulse/ui] <${name}> has no prop "${attribute}". Props: ${Object.keys(this.$props).join(", ")}`)
        }
      },
    })
  },
}
