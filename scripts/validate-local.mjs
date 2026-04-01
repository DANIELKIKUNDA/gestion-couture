import path from "node:path";
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

async function main() {
  let processes = null;

  try {
    log("Etape 1/3: tests backend stables");
    await runCommand(npmCommand(), ["run", "test:backend:stable"], { cwd: ROOT_DIR });

    log("Etape 2/3: verification frontend + backend");
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

    log("Etape 3/3: tests Playwright");
    await runCommand(npmCommand(), ["run", "test:e2e:serial"], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
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
