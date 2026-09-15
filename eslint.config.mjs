import eslint from "@eslint/js";
import react from "eslint-plugin-react";
import security from "eslint-plugin-security";
import tseslint from "typescript-eslint";

const sourceFiles = ["**/*.{js,mjs,cjs,ts,tsx}"];
const unmanagedTimerRules = [
  {
    name: "setTimeout",
    message: "Use the injected Scheduler instead of setTimeout().",
  },
  {
    name: "setInterval",
    message: "Use the injected Scheduler instead of setInterval().",
  },
];
const animationFrameRule = {
  name: "requestAnimationFrame",
  message: "Use the injected FrameTimeSource instead of requestAnimationFrame().",
};
const htmlInjectionSelectors = [
  {
    selector:
      "AssignmentExpression[left.type='MemberExpression'][left.property.name=/^(innerHTML|outerHTML)$/]",
    message: "Do not inject HTML strings; construct safe DOM nodes instead.",
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: "Do not inject HTML strings; construct safe DOM nodes instead.",
  },
  {
    selector: "CallExpression[callee.object.name='document'][callee.property.name='write']",
    message: "Do not write raw HTML into the document.",
  },
];
const environmentAccessRule = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message: "Read environment variables through app/_lib/env.ts.",
};

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "reports/**",
      "tests/fixtures/arch/**",
      "tests/fixtures/bundle/**",
      "pnpm-lock.yaml",
      "next-env.d.ts",
    ],
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      globals: {
        module: "readonly",
        require: "readonly",
      },
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
      },
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    files: sourceFiles,
    plugins: {
      react,
      security,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
      "no-eval": "error",
      "no-new-func": "error",
      "react/no-danger": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-object-injection": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "engine/invalid.ts",
            "engine/render/invalid.ts",
            "components/invalid.tsx",
            "events/invalid.ts",
          ],
        },
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    files: ["core/logger.ts", "scripts/**"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["engine/**", "formations/**", "audio/**", "pointer/**", "adapters/**", "events/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "Use the injected deterministic Prng instead of Math.random().",
        },
      ],
      "no-restricted-globals": ["error", ...unmanagedTimerRules],
    },
  },
  {
    files: ["engine/**", "events/**", "adapters/**"],
    ignores: ["engine/render/**"],
    rules: {
      "no-restricted-globals": ["error", ...unmanagedTimerRules, animationFrameRule],
    },
  },
  {
    files: ["engine/render/**"],
    rules: {
      "no-restricted-globals": ["error", ...unmanagedTimerRules],
    },
  },
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    ignores: ["app/_lib/env.ts", "app/api/**", "*.config.*", "scripts/**", "tests/**"],
    rules: {
      "no-restricted-syntax": ["error", environmentAccessRule],
    },
  },
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    rules: {
      "no-restricted-syntax": ["error", environmentAccessRule, ...htmlInjectionSelectors],
    },
  },
  {
    files: ["app/_lib/env.ts", "app/api/**", "*.config.*", "scripts/**", "tests/**"],
    rules: {
      "no-restricted-syntax": ["error", ...htmlInjectionSelectors],
    },
  },
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    ignores: ["core/clock.ts", "app/**", "components/**", "scripts/**", "tests/**", "*.config.*"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Date",
          property: "now",
          message: "Use an injected Clock instead of Date.now().",
        },
        {
          object: "performance",
          property: "now",
          message: "Use an injected Clock instead of performance.now().",
        },
        {
          object: "Math",
          property: "random",
          message: "Use the injected deterministic Prng instead of Math.random().",
        },
      ],
    },
  },
);
