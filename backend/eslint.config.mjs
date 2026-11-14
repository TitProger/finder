import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    eslintPluginPrettierRecommended,
    importPlugin.flatConfigs.recommended,
    importPlugin.flatConfigs.typescript,
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'coverage/**',
            'src/migrations/**',
            'src/interfaces/http/generated/**',
            '**/*.spec.ts',
        ],
    },
    {
        files: ['**/*.ts'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.jest,
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        settings: {
            'import/resolver': {
                typescript: {
                    alwaysTryTypes: true,
                    project: './tsconfig.json',
                },
                node: true,
            },
        },
        rules: {
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/interface-name-prefix': 'off',
            'prettier/prettier': 'error',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            'no-console': 'error',
            'keyword-spacing': 'error',
            'space-before-blocks': 'error',
            'arrow-spacing': 'error',
            'key-spacing': 'error',
            'switch-colon-spacing': 'error',
            'semi-spacing': 'error',
            'comma-spacing': 'error',
            'func-call-spacing': 'error',
            'no-multi-spaces': ['error', { ignoreEOLComments: true }],
            'object-curly-spacing': ['error', 'always'],
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',           // параметры: _options, _reply
                    varsIgnorePattern: '^_',           // переменные: _page, _e
                    caughtErrorsIgnorePattern: '^_',   // catch (_e)
                    destructuredArrayIgnorePattern: '^_', // const [_, day] = match
                },
            ],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            semi: ['error', 'always'],
            'padding-line-between-statements': [
                'error',
                { blankLine: 'always', prev: '*', next: 'if' },
                { blankLine: 'always', prev: 'if', next: '*' },
                { blankLine: 'always', prev: '*', next: 'try' },
                { blankLine: 'always', prev: 'try', next: '*' },
                { blankLine: 'always', prev: '*', next: 'switch' },
                { blankLine: 'always', prev: 'switch', next: '*' },
                { blankLine: 'always', prev: '*', next: 'for' },
                { blankLine: 'always', prev: 'for', next: '*' },
                { blankLine: 'always', prev: '*', next: 'return' },
                { blankLine: 'always', prev: '*', next: 'throw' },
                { blankLine: 'always', prev: ['const', 'let', 'var'], next: 'expression' },
                { blankLine: 'always', prev: 'expression', next: ['const', 'let', 'var'] },
            ],
            'space-before-function-paren': [
                'error',
                {
                    anonymous: 'always',
                    named: 'never',
                    asyncArrow: 'always',
                },
            ],
            yoda: 'warn',
            'import/newline-after-import': 'warn',
            'import/no-cycle': 'off',
            'import/order': 'warn',
            'import/no-named-as-default-member': 'off',
        },
    },
);
