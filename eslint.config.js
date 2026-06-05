import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/dist/', '**/node_modules/', '**/coverage/', 'frontend/src/wasm/pkg/'],
  },
  {
    rules: {
      // Honour the existing `_`-prefix convention for intentionally-unused
      // bindings (e.g. `closeRunner(id, _reason)` keeps the param for the API
      // signature), and allow the destructure-omit idiom
      // (`const { drop, ...rest } = obj`) where the omitted sibling is intentional.
      '@typescript-eslint/no-unused-vars': ['error', {
        ignoreRestSiblings: true,
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
