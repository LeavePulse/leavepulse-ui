export interface IconCollection {
  prefix: string
  icons: Record<string, { body: string; width?: number; height?: number }>
  aliases?: Record<string, { parent: string }>
  width?: number
  height?: number
}
export function refsInText(text: string): [prefix: string, name: string][]
export function refsInDirs(dirs: string[]): Map<string, Set<string>>
export function namesInText(text: string): string[]
export function namesInDirs(dirs: string[]): Set<string>
export function subset(collection: IconCollection, names: Iterable<string>): IconCollection
