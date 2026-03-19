import { ref } from "vue";

export const syncInProgress = ref(false);
export const pendingActions = ref(0);

export function setSyncInProgress(value) {
  syncInProgress.value = value === true;
}

export function setPendingActions(count) {
  const normalized = Number(count || 0);
  pendingActions.value = Number.isFinite(normalized) && normalized > 0 ? Math.trunc(normalized) : 0;
}
