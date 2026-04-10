import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import {
  BACKEND_URL,
  FRONTEND_URL,
  createStackProcesses,
  isHttpReady,
  log,
  npmCommand,
  runCommand,
  stopStack,
  waitForHttp
} from "./local-stack-utils.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const values = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) values[key] = value;
  }

  return values;
}

function migrationCommand() {
  if (process.platform === "win32") {
    return { command: npmCommand(), args: ["run", "migrate"] };
  }

  return { command: "sh", args: ["deploy/scripts/migrate.sh"] };
}

async function main() {
  let processes = null;
  const dotenvEnv = loadDotEnv(path.join(ROOT_DIR, ".env"));
  const commandEnv = { ...dotenvEnv, ...process.env };

  try {
    log("Etape 1/4: tests backend stables");
    await runCommand(npmCommand(), ["run", "test:backend:stable"], { cwd: ROOT_DIR, env: commandEnv });

    log("Etape 2/4: verification frontend + backend");
    const backendReady = await isHttpReady(`${BACKEND_URL}/health`);
    const frontendReady = await isHttpReady(FRONTEND_URL);
    if (!backendReady || !frontendReady) {
      log("Services locaux absents, demarrage du stack local.");
      processes = createStackProcesses(ROOT_DIR);
    } else {
      log("Services locaux deja disponibles, reutilisation de l'environnement courant.");
    }

    await waitForHttp(`${BACKEND_URL}/health`);
    await waitForHttp(FRONTEND_URL);

    log("Etape 3/4: synchronisation du schema local");
    const migrate = migrationCommand();
    await runCommand(migrate.command, migrate.args, {
      cwd: ROOT_DIR,
      env: commandEnv
    });

    log("Etape 4/4: tests Playwright");
    await runCommand(npmCommand(), ["run", "test:e2e:serial"], {
      cwd: ROOT_DIR,
      env: {
        ...commandEnv,
        BASE_URL: FRONTEND_URL,
        API_URL: BACKEND_URL
      }
    });

    log("Validation locale OK.");
  } finally {
    if (processes) {
      await stopStack(processes);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
