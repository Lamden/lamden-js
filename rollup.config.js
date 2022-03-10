import nodePolyfills from "rollup-plugin-polyfill-node";
import commonjs from "@rollup/plugin-commonjs";
import alias from "@rollup/plugin-alias";
import { nodeResolve as resolve } from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";
import json from "@rollup/plugin-json";

export default [
  {
    input: "src/index.js",
    output: {
      file: "dist/esm/lamden.js",
      format: "esm",
    },

    plugins: [
      alias({
        entries: [{ find: "bip39", replacement: "../bip39.browser" }],
      }),
      resolve({ browser: true, preferBuiltins: false }),
      commonjs(),
      nodePolyfills(),
      terser(),
    ],
  },
  {
    input: "src/index.js",
    output: {
      file: "dist/cjs/lamden.js",
      format: "cjs",
      exports: "default",
    },
    plugins: [resolve({ preferBuiltins: true }), commonjs(), json()],
    external: ["tweetnacl", "bip39", "ed25519-hd-key"],
  },
];
