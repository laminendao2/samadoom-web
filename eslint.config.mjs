import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  // Ignore mobile files accidentally present in web repo
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/services/iap.js",
      "src/services/**/*.js",
      "App.js",
      "app.json",
      "plugins/**",
      "src/navigation/**",
      "src/screens/**",
      "src/components/**",
      "src/context/**",
      "src/config/**",
    ],
  },
  ...nextVitals,
  ...nextTs,
]);

export default eslintConfig;
