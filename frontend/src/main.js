import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

function renderStartupError(error) {
  const host = document.querySelector("#app");
  if (!host) return;
  const message = error instanceof Error ? error.message : String(error || "Erreur inconnue");
  host.innerHTML = `
    <section style="padding:24px;font-family:Arial,sans-serif;line-height:1.5">
      <h2 style="margin:0 0 12px;color:#8a1c1c">Erreur de demarrage frontend</h2>
      <p style="margin:0 0 8px">L'application n'a pas pu s'afficher.</p>
      <pre style="background:#f7f7f7;border:1px solid #ddd;padding:12px;white-space:pre-wrap">${message}</pre>
      <p style="margin-top:12px">Ouvre la console du navigateur (F12) pour plus de details.</p>
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
  createApp(App).mount("#app");
} catch (error) {
  renderStartupError(error);
}
