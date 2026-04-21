import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { build, mergeConfig } from "vite";
import viteConfig from "../vite.config.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");

const config = mergeConfig(viteConfig, {
  configFile: false,
  root: rootDir
});

await build(config);
