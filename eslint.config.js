import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import jsdoc from 'eslint-plugin-jsdoc'
import noShadowState from './eslint-rules/no-shadow-state.js'

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'custom': { rules: { 'no-shadow-state': noShadowState } },
      'jsdoc': jsdoc,
    },
    rules: {
      'jsdoc/require-jsdoc': ['warn', {
        require: {
          FunctionDeclaration: false,
          ClassDeclaration: false,
        },
        contexts: [
          'ExportNamedDeclaration > FunctionDeclaration',
          'ExportNamedDeclaration > ClassDeclaration',
          'ExportNamedDeclaration > TSInterfaceDeclaration',
          'ExportNamedDeclaration > TSTypeAliasDeclaration',
          'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
        ],
        checkConstructors: false,
      }],
      'jsdoc/require-description': ['warn', {
        contexts: [
          'ExportNamedDeclaration > FunctionDeclaration',
          'ExportNamedDeclaration > ClassDeclaration',
          'ExportNamedDeclaration > TSInterfaceDeclaration',
          'ExportNamedDeclaration > TSTypeAliasDeclaration',
          'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
        ],
      }],
      // Layer 2: Warn when useState is used in views/panels (prefer XState).
      // Local UI state (modal open, animation flag) is acceptable — this is
      // guidance, not a hard block. View-routing state MUST be in XState.
      'no-restricted-imports': ['warn', {
        paths: [{
          name: 'react',
          importNames: ['useState'],
          message: 'Prefer XState machine state in views/panels. useState is OK for purely local UI state (modal open/close, animation flags). See CLAUDE.md rule #8.',
        }],
      }],

      // Layer 3: Warn when a file imports both useState and XState.
      // Co-location is sometimes legitimate (reading phase state while managing
      // local UI state). True shadow states (useState for view routing) are bugs.
      'custom/no-shadow-state': 'warn',
    },
  },
  // Allow useState freely in components, hooks, ui, stores, and non-renderer code
  {
    files: [
      'src/renderer/components/**/*.{ts,tsx}',
      'src/renderer/hooks/**/*.{ts,tsx}',
      'src/renderer/ui/**/*.{ts,tsx}',
      'src/renderer/lib/**/*.{ts,tsx}',
      'src/renderer/stores/**/*.{ts,tsx}',
      'src/main/**/*.{ts,tsx}',
      'src/preload/**/*.{ts,tsx}',
      'src/shared/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': 'off',
      'custom/no-shadow-state': 'off',
    },
  },
  // Ignore test files and build output
  {
    ignores: ['src/__tests__/**', 'e2e/**', 'dist/**', 'node_modules/**'],
  },
]
