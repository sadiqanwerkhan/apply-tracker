import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // `react-hooks/set-state-in-effect` is a new, experimental React Compiler
      // rule bundled with eslint-config-next. It fires on legitimate SSR
      // patterns — reading localStorage / matchMedia, or syncing to a prop,
      // inside an effect — which CANNOT run during server render and so have no
      // cleaner alternative here. Kept as a warning: still visible, doesn't
      // block the build. Revisit per-component if you adopt the React Compiler.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
