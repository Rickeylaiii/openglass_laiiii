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
    // �ر���� React Native Web ���ı��ڵ�����
    'react-native/no-raw-text': [
      2, 
      {
        skip: ['Text'], // Text �������ֱ�Ӱ����ı�
      }
    ],
    'react-native/no-inline-styles': 0, // ������ڴ�����ʹ��������ʽ������Ϊ0���Թرմ˹���
    'react/prop-types': 0, // ���ʹ�� TypeScript�����Թر��������
    // ��ֹ����ո�
    'no-trailing-spaces': 'error',
    'no-multiple-empty-lines': ['error', { max: 1 }],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};