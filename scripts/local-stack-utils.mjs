import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

export const FRONTEND_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
export const BACKEND_URL = process.env.API_URL || process.env.E2E_API_URL || "http://127.0.0.1:3000";

export function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function log(message) {
  process.stdout.write(`[local-pipeline] ${message}\n`);
}

function needsShell(command) {
  return process.platform === "win32" && /\.cmd$/i.test(String(command || ""));
}

export function spawnLogged(command, args, options = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    shell: needsShell(command),
    ...options
  });
}

export async function waitForHttp(url, { timeoutMs = 120_000, intervalMs = 500 } = {}) {
  const startedAt = Date.now();
  let lastError = "unknown";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = String(error?.message || error || "network_error");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Service indisponible sur ${url}: ${lastError}`);
}

export async function isHttpReady(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

export async function runCommand(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: needsShell(command),
      ...options
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Commande echouee (${command} ${args.join(" ")}), code=${code ?? "null"}, signal=${signal ?? "null"}`));
    });
  });
}

export function createStackProcesses(rootDir) {
  const envFilePath = path.join(rootDir, ".env");
  const backendArgs = fs.existsSync(envFilePath)
    ? ["--env-file", envFilePath, "src/interfaces/http/server.js"]
    : ["src/interfaces/http/server.js"];
  const backend = spawnLogged(process.execPath, backendArgs, {
    cwd: rootDir
  });

  const frontend = spawnLogged(npmCommand(), ["--prefix", "frontend", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
    cwd: rootDir
  });

  return { backend, frontend };
}

export async function stopStack(processes) {
  const children = Object.values(processes || {}).filter(Boolean);
  for (const child of children) {
    if (child.exitCode !== null) continue;
    try {
      if (process.platform === "win32") {
        await runCommand("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      // best effort cleanup
    }
  }
}
