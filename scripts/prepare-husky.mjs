import { existsSync } from "node:fs";

const isCi = String(process.env.CI || "").toLowerCase() === "true";
const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";

if (isCi || isProduction) {
  console.log("[prepare] Husky ignore en CI/production.");
  process.exit(0);
}

if (!existsSync("node_modules/husky")) {
  console.log("[prepare] Husky non installe, hook ignore.");
  process.exit(0);
}

const { default: husky } = await import("husky");

await husky();
console.log("[prepare] Husky active.");
