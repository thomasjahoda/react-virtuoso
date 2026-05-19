import type { VFile } from './VFile'
import type { Root } from 'mdast'

export type RemarkPlugin = (tree: Root, file: VFile) => Promise<void> | void
