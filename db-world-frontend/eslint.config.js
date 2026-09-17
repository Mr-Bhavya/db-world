import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'android/**', 'android_bak/**', 'node_modules/**'] },

  js.configs.recommended,

  // Build-time Node scripts, not app code — they get Node globals rather than the browser's.
  {
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'module',
    },
  },

  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',  // not needed with React 17+ JSX transform
      'react/prop-types': 'off',           // not using PropTypes
      'react/display-name': 'warn',
      'no-unused-vars': ['error', {
        vars: 'all',
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // Catches reading a `const` above its own declaration, which is a ReferenceError at
      // runtime and invisible to the build. It shipped once: a hook argument was changed to
      // read a balance that was derived thirty lines further down, and the group page threw
      // "Cannot access 'myBalance' before initialization" on mount while lint, build and all
      // 647 tests stayed green — none of them render a component.
      //
      // Functions are exempt because hoisted function declarations genuinely work, and this
      // codebase relies on it: page files define their component first and its little
      // presentational helpers underneath, which reads far better than the reverse.
      //
      // A WARNING, not an error, and that is a judgement call worth recording. It found 19
      // pre-existing hits across eleven files, and every one of them is safe: a module-scope
      // `const` helper declared below the function that calls it, which is initialised long
      // before anything calls that function. "Main logic first, helpers underneath" is a
      // deliberate and readable style in this codebase, and `functions: false` cannot exempt it
      // because these helpers are arrow consts rather than hoisted declarations.
      //
      // The bug it caught was a different shape: a value read in the STRAIGHT-LINE body of a
      // component, which re-runs top to bottom on every render, so the read genuinely preceded
      // the declaration. ESLint cannot tell those two apart, so an error here would mean either
      // reordering eleven untouched files or nineteen inline disables.
      'no-use-before-define': ['warn', {
        functions: false,
        classes: true,
        variables: true,
      }],
    },
  },
];
