import security from "eslint-plugin-security";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
export default [
  {
    files: ["**/*.ts"],
    plugins: { security, "@typescript-eslint": tseslint },
    languageOptions: { parser: tsparser, parserOptions: { ecmaVersion: "latest", sourceType: "module" } },
    rules: {
      ...security.configs.recommended.rules,
      "no-eval": "error",
      "no-implied-eval": "error",
      "security/detect-object-injection": "off",
    },
  },
  { ignores: ["dist/", "node_modules/", ".wrangler/", "*.config.*"] },
];
