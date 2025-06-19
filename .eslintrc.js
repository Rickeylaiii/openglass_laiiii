module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-native/all',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react', 'react-native', '@typescript-eslint'],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  env: {
    'react-native/react-native': true,
  },
  rules: {
    // 特别针对 React Native Web 的文本节点问题
    'react-native/no-raw-text': [
      2, 
      {
        skip: ['Text'], // Text 组件可以直接包含文本
      }
    ],
    'react-native/no-inline-styles': 0, // 如果你在代码中使用内联样式，设置为0可以关闭此规则
    'react/prop-types': 0, // 如果使用 TypeScript，可以关闭这个规则
    // 禁止多余空格
    'no-trailing-spaces': 'error',
    'no-multiple-empty-lines': ['error', { max: 1 }],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};