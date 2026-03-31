export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['playwright', 'judge', 'dashboard', 'db', 'ci', 'deps'],
    ],
    'scope-empty': [1, 'never'],
  },
};
