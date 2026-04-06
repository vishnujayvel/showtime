/**
 * ESLint rule: no-shadow-state
 *
 * Detects files that import BOTH useState from React AND anything from
 * XState (@xstate/react or ../machines/). This pattern creates "shadow states"
 * where React local state duplicates what should be in the XState machine.
 *
 * See: CLAUDE.md rule #8, issue #205
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow co-locating useState with XState imports (shadow state)',
    },
    messages: {
      shadowState:
        'Shadow state detected: this file imports both useState and XState. ' +
        'Move view-routing state into the XState machine. See CLAUDE.md rule #8 and issue #205.',
    },
    schema: [],
  },
  create(context) {
    let hasUseState = false
    let hasXState = false
    let useStateNode = null

    return {
      ImportDeclaration(node) {
        const source = node.source.value

        // Check for useState import from react
        if (source === 'react') {
          const hasUseStateSpecifier = node.specifiers.some(
            (s) => s.type === 'ImportSpecifier' && s.imported.name === 'useState'
          )
          if (hasUseStateSpecifier) {
            hasUseState = true
            useStateNode = node
          }
        }

        // Check for XState-related imports
        if (
          source === '@xstate/react' ||
          source === 'xstate' ||
          source.includes('/machines/') ||
          source.includes('/machines')
        ) {
          hasXState = true
        }
      },
      'Program:exit'() {
        if (hasUseState && hasXState && useStateNode) {
          context.report({ node: useStateNode, messageId: 'shadowState' })
        }
      },
    }
  },
}
