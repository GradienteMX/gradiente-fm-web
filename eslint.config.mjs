import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// eslint-config-next 16 ships native flat configs; wrapping them in
// FlatCompat makes ESLint crash on a circular plugin object.
const config = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'node_modules/**', 'public/**', 'next-env.d.ts']),
  {
    rules: {
      // three.js idioms mutate refs inside frame loops by design.
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      // The API routes strip client-supplied fields by destructuring into _names.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
])

export default config
