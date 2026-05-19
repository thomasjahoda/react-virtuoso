import { EXIT, isMdxjsEsm, isObjectExpression, isVariableDeclarator, visit } from '@virtuoso.dev/m2dx-utils'
import { EXIT as esEXIT, visit as esVisit } from 'estree-util-visit'

import type { Identifier, Program, VariableDeclaration, VariableDeclarator } from 'estree'
import type { Root } from 'mdast'

export function findExportInProgram(program: Program): undefined | VariableDeclarator {
  let found: undefined | VariableDeclarator
  esVisit(program, (n, _, __, ancestors) => {
    if (isVariableDeclarator(n)) {
      // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
      const name = (n.id as Identifier).name
      // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
      const declaration = ancestors[ancestors.length - 1] as VariableDeclaration
      if (name === 'components' && declaration.kind === 'const' && isObjectExpression(n.init)) {
        found = n
        return esEXIT
      }
    }
    return undefined
  })
  return found
}

export function findExportInMdx(root: Root): undefined | VariableDeclarator {
  let found: undefined | VariableDeclarator
  // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
  const rootNode = root as unknown as Parameters<typeof visit>[0]
  // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
  const predicate = isMdxjsEsm as Parameters<typeof visit>[1]
  visit(rootNode, predicate, (node) => {
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const estree = (node.data as Record<string, unknown> | undefined)?.estree as Program | undefined
    if (estree !== undefined) {
      found = findExportInProgram(estree)
      if (found) {
        return EXIT
      }
    }
    return undefined
  })
  return found
}
