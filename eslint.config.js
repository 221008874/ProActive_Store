import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `.vercel` holds the build output of `vercel build`, which bundles a copy of
// node_modules into .vercel/output. It is generated, gitignored, and linting it
// reports hundreds of errors in code that is not ours.
globalIgnores(['dist', '.vercel']),

  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },

  // Server-side code: the Vercel function in api/, the route handlers and
  // their _core modules in server/, and the ops scripts. These run in Node,
  // not the browser: no JSX, no React rules (useAdminFieldValue is a function,
  // not a hook), node globals (process, Buffer) available. Declared AFTER the
  // general block so it overrides.
  {
    files: ['api/**/*.js', 'server/**/*.js', 'scripts/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  // The test suite runs in Node (vitest defaults to the node environment; the
  // render smoke tests hand-build a DOM stub rather than using jsdom). Files
  // under src/test/ therefore need node globals even though they live in src/:
  // several of them exercise server-side modules that use process and Buffer.
  {
    files: ['src/test/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  // src/ui/ is the vendored ProActive Fashion design system: it intentionally
  // exports plain helpers (variantsToStock, LOW_STOCK_AT) next to components, so
  // the fast-refresh rule does not apply. HMR for these files is not a concern
  // because they are a stable, app-independent library.
  {
    files: ['src/ui/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // React contexts export the Provider component AND its hook from the same
  // module - the documented React pattern. The fast-refresh rule is written
  // for component libraries, not for context modules, and disabling it here
  // keeps the standard pattern without splitting each context in two.
  {
    files: ['src/context/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
