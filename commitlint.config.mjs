export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["playwright", "judge", "dashboard", "db", "ci", "deps"],
    ],
    "scope-empty": [1, "never"],
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [0, "always"],
  },
  helpUrl:
    "https://github.com/llm-assert/llm-assert/blob/main/.github/CONTRIBUTING.md#commit-messages",
};
