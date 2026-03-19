export function showToast(message = "") {
  const value = String(message || "").trim();
  if (!value || typeof window === "undefined" || typeof window.alert !== "function") return;
  window.alert(value);
}
