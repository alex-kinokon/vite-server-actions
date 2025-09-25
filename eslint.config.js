import { error, extendConfig, off } from "@aet/eslint-rules";

import pkg from "./package.json" with { type: "json" };

export default extendConfig({
  rules: {
    "import-x/no-unresolved": [error, { ignore: [pkg.name, "PKG_NAME"] }],
    "@typescript-eslint/require-await": off,
  },
});
