import { createApp } from "vue";
import App from "./App.vue";
import { initializeLocalDb } from "./services/local-db.js";
import { initializeNetworkService } from "./services/network-service.js";
import { initializePwaService } from "./services/pwa-service.js";
import { initializeSyncEngine } from "./services/sync-engine.js";
import { initializeThemeService } from "./services/theme-service.js";
import "./style.css";
import "./theme.css";

let appMounted = false;

function userStartupMessage(error) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const lowered = raw.toLowerCase();
  if (
    lowered.includes("connexion api impossible") ||
    lowered.includes("frontend") ||
    lowered.includes("backend") ||
    lowered.includes("api") ||
    lowered.includes("failed to fetch") ||
    lowered.includes("networkerror") ||
    lowered.includes("not implemented") ||
    lowered.includes("undefined")
  ) {
    return "L'application rencontre un incident temporaire. Fermez puis rouvrez Atelier Pro.";
  }
  return "L'application n'a pas pu s'afficher correctement. Fermez puis rouvrez Atelier Pro.";
}

function renderStartupError(error) {
  console.error("[AtelierPro] startup error", error);
  if (appMounted) return;
  const host = document.querySelector("#app");
  if (!host) return;
  const message = userStartupMessage(error);
  host.innerHTML = `
    <section style="min-height:100vh;display:grid;place-items:center;padding:24px;font-family:Arial,sans-serif;line-height:1.5;background:#f7f3ec;color:#14213d">
      <article style="max-width:420px;width:100%;border:1px solid rgba(20,33,61,.12);border-radius:24px;background:#fffdf8;padding:28px;box-shadow:0 22px 60px rgba(20,33,61,.12);text-align:center">
        <div style="width:56px;height:56px;border-radius:18px;background:#14213d;color:#f4c86b;display:grid;place-items:center;margin:0 auto 16px;font-weight:800">AP</div>
        <h2 style="margin:0 0 10px;color:#14213d;font-size:22px">Atelier Pro</h2>
        <p style="margin:0;color:#4d5a6d">${message}</p>
      </article>
    </section>
  `;
}

window.addEventListener("error", (event) => {
  if (event?.error) renderStartupError(event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  renderStartupError(event?.reason);
});

try {
  initializeThemeService();
  initializeNetworkService();
  void initializeLocalDb();
  initializeSyncEngine();
  initializePwaService();
  createApp(App).mount("#app");
  appMounted = true;
} catch (error) {
  renderStartupError(error);
}
