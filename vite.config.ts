import { defineConfig } from "vite-plus";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        main_2d: fileURLToPath(new URL("./main_2d.html", import.meta.url)),
        main_3d: fileURLToPath(new URL("./main_3d.html", import.meta.url)),
        solar_system: fileURLToPath(new URL("./solar_system.html", import.meta.url)),
      },
    },
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      // Cast safety
      "typescript/no-unnecessary-type-assertion": "error",
      "typescript/no-non-null-assertion": "error",
      "typescript/no-confusing-non-null-assertion": "error",
      // Promise / async hygiene
      "typescript/no-floating-promises": "error",
      "typescript/no-misused-promises": "error",
      "no-async-promise-executor": "error",
      // Exhaustiveness and other TS traps
      "typescript/switch-exhaustiveness-check": "error",
      // DOM / browser idioms
      "unicorn/prefer-query-selector": "error",
      "unicorn/prefer-add-event-listener": "error",
      "unicorn/prefer-node-protocol": "error",
      // Idiomatic style
      "unicorn/no-useless-spread": "error",
      "unicorn/no-useless-undefined": "error",
      "unicorn/no-nested-ternary": "error",
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: "error",
      // Classic footguns
      "no-eval": "error",
      "no-cond-assign": "error",
      "no-self-compare": "error",
      "no-shadow-restricted-names": "error",
      "no-prototype-builtins": "error",
    },
    options: { typeAware: true, typeCheck: true },
  },
});
