// @ts-check Let TS check this config file

import antfu from "@antfu/eslint-config";

export default antfu(
  {
    stylistic: false,
    javascript: {
      overrides: {
        "no-restricted-globals": ["error", "window", "document"],
      },
    },
    ignores: ["addon/lib/**", "data"],
  },
  {
    files: ["**/bootstrap.js", "**/prefs.js"],
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "unused-imports/no-unused-vars": "off",
    },
  },
);
