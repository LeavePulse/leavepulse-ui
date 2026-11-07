/*
 * `instanceof Element` is false for a node of an LpFrame: each window has its
 * own classes. These go by what the node is, and what it belongs to.
 */
export function isNode(value: unknown): value is Node {
  return typeof (value as Node | null | undefined)?.nodeType === "number"
}

export function isElement(value: unknown): value is Element {
  return (value as Node | null | undefined)?.nodeType === 1
}

export function isInputElement(value: unknown): value is HTMLInputElement {
  return isElement(value) && value.tagName === "INPUT"
}

export function isHTMLElement(value: unknown): value is HTMLElement {
  return isElement(value) && "style" in value
}

/** The window a node lives in, with that realm's constructors (`MouseEvent`, `ResizeObserver`). */
export function nodeWindow(node: Node): Window & typeof globalThis {
  const doc = node.nodeType === 9 ? (node as Document) : node.ownerDocument
  return (doc?.defaultView ?? globalThis) as Window & typeof globalThis
}
