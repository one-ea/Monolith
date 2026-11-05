import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

// seo-core 是纯函数库，无安全攻击面，只应用 TS recommended 规则
export default [
  {
    files: ["src/**/*.ts"],
    plugins: { "@typescript-eslint": tseslint },
    languageOptions: { parser: tsparser, parserOptions: { ecmaVersion: "latest", sourceType: "module" } },
    rules: {
      ...tseslint.configs.recommended.rules,
    },
  },
  { ignores: ["node_modules/"] },
];
