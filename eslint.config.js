// @ts-check
import tseslint from 'typescript-eslint';
import js from '@eslint/js';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: [
      'build/**',
      'node_modules/**',
      'dist/**',
      '**/*.d.ts'
    ]
  },
  js.configs.recommended,
  ...tseslint.config({
    files: ['**/*.ts'],
    extends: [
      ...tseslint.configs.recommended,
    ],
    rules: {
      // general hygiene
      'no-console': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': 'warn',

      // relax strict type-safety rules for this project
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',

      // prefer const
      'prefer-const': 'warn',

      // stylistic (minimal; let Prettier or team style handle more)
      'no-trailing-spaces': 'warn',
      'eol-last': ['warn', 'always'],
      'no-async-promise-executor': 'off'
    }
  })
];
