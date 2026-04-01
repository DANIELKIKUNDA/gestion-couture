import path from "node:path";
import { fileURLToPath } from "node:url";

import { BACKEND_URL, FRONTEND_URL, createStackProcesses, log, stopStack, waitForHttp } from "./local-stack-utils.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const processes = createStackProcesses(ROOT_DIR);

const shutdown = async () => {
  await stopStack(processes);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  log(`Demarrage backend sur ${BACKEND_URL} et frontend sur ${FRONTEND_URL}`);
  await waitForHttp(`${BACKEND_URL}/health`);
  await waitForHttp(FRONTEND_URL);
  log("Backend et frontend sont prets.");
} catch (error) {
  console.error(error);
  await stopStack(processes);
  process.exit(1);
}
