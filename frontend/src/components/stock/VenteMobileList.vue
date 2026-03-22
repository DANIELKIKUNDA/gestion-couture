<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  formatCurrency: {
    type: Function,
    required: true
  },
  formatDateTime: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(["view"]);

function toneFor(vente) {
  if (String(vente?.statut || "").trim() === "VALIDEE") return "success";
  if (String(vente?.statut || "").trim() === "ANNULEE") return "default";
  return "warning";
}

function metaItemsFor(vente) {
  return [
    {
      key: "date",
      label: "Date",
      value: props.formatDateTime(vente?.date)
    },
    {
      key: "total",
      label: "Total",
      value: props.formatCurrency(vente?.total),
      emphasis: true,
      tone: "warning"
    },
    {
      key: "caisse",
      label: "Ref. caisse",
      value: vente?.referenceCaisse || "-"
    }
  ];
}
</script>

<template>
  <div class="vente-mobile-list">
    <MobileEntityCard
      v-for="vente in items"
      :key="vente.idVente"
      :eyebrow="`Vente #${vente.idVente}`"
      title="Historique vente"
      :subtitle="vente.date ? `Enregistree le ${formatDateTime(vente.date)}` : 'Vente atelier'"
      :tone="toneFor(vente)"
    >
      <template #badge>
        <span class="status-pill" :data-status="vente.statut">
          {{ vente.statut || "-" }}
        </span>
      </template>

      <template #meta>
        <MobileMetaList :items="metaItemsFor(vente)" />
      </template>

      <template #footer>
        <button type="button" class="action-btn blue vente-mobile-list__action" @click="emit('view', vente)">
          Voir le detail
        </button>
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.vente-mobile-list {
  display: grid;
  gap: 12px;
}

.vente-mobile-list__action {
  width: 100%;
}
</style>
