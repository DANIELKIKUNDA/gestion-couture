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
  }
});

function toneFor(item) {
  if (item?.type === "Vente") return "success";
  if (String(item?.statut || "").trim() === "TERMINEE" || String(item?.statut || "").trim() === "LIVREE") return "success";
  return "info";
}

function metaItemsFor(item) {
  return [
    {
      key: "type",
      label: "Type",
      value: item?.type || "-"
    },
    {
      key: "statut",
      label: "Statut",
      value: item?.statut || "-"
    },
    {
      key: "montant",
      label: "Montant",
      value: props.formatCurrency(item?.montantTotal),
      emphasis: true,
      tone: "warning"
    },
    {
      key: "avance",
      label: item?.type === "Vente" ? "Benefice" : "Avance",
      value: props.formatCurrency(item?.avancePayee)
    }
  ];
}
</script>

<template>
  <div class="dashboard-recent-work-mobile-list">
    <MobileEntityCard
      v-for="item in items"
      :key="`${item.type}-${item.id}`"
      eyebrow="Activite recente"
      :title="item.clientNom || 'Client non renseigne'"
      :subtitle="item.type || 'Activite atelier'"
      :tone="toneFor(item)"
    >
      <template #badge>
        <span class="status-pill" :data-status="item.statut || 'INCONNUE'">
          {{ item.statut || "-" }}
        </span>
      </template>

      <template #meta>
        <MobileMetaList :items="metaItemsFor(item)" />
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.dashboard-recent-work-mobile-list {
  display: grid;
  gap: 12px;
}
</style>
