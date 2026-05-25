import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // src/lib/logger.ts 와 env.ts 외에는 console 직접 호출 금지
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // logger/env/script 는 의도적 console 사용 허용
    files: [
      "src/lib/logger.ts",
      "src/env.ts",
      "src/scripts/**/*.ts",
      "src/app/**/error.tsx",
      "src/app/**/global-error.tsx",
    ],
    rules: {
      "no-console": "off",
    },
  },
];

export default eslintConfig;
