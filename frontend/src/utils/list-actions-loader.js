import { ref, watch } from "vue";

export function hasActionEntry(store, id) {
  return Object.prototype.hasOwnProperty.call(store.value || {}, String(id || ""));
}

export function readActionEntry(store, id) {
  return (store.value || {})[String(id || "")] || null;
}

export function normalizeActionFlags(payload) {
  const actions = payload?.actions && typeof payload.actions === "object" ? payload.actions : {};
  return {
    voir: actions.voir === true,
    payer: actions.payer === true,
    terminer: actions.terminer === true,
    livrer: actions.livrer === true,
    annuler: actions.annuler === true,
    modifier: actions.modifier === true
  };
}

export function useEntityActions({
  pagedRows,
  idKey,
  fetchActions,
  isRemoteEntityId,
  detailState
}) {
  const actionsById = ref({});

  async function loadActionsForId(entityId, { force = false, detail = false } = {}) {
    const id = String(entityId || "");
    if (!id) return null;
    if (!isRemoteEntityId(id)) {
      actionsById.value = { ...actionsById.value, [id]: null };
      if (detail && detailState) detailState.value = null;
      return null;
    }
    if (!force && hasActionEntry(actionsById, id)) {
      const cached = readActionEntry(actionsById, id);
      if (detail && detailState) detailState.value = cached;
      return cached;
    }
    const previous = readActionEntry(actionsById, id);
    try {
      const payload = await fetchActions(id);
      const normalized = normalizeActionFlags(payload);
      actionsById.value = { ...actionsById.value, [id]: normalized };
      if (detail && detailState) detailState.value = normalized;
      return normalized;
    } catch {
      actionsById.value = { ...actionsById.value, [id]: previous };
      if (detail && detailState) detailState.value = previous;
      return previous;
    }
  }

  watch(pagedRows, (rows) => {
    const ids = (rows || []).map((row) => row?.[idKey]).filter(Boolean);
    for (const id of ids) {
      void loadActionsForId(id, { force: false, detail: false });
    }
  }, { immediate: true });

  return {
    actionsById,
    loadActionsForId
  };
}
