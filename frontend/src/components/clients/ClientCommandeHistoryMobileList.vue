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
  formatDate: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(["view"]);

function cardTone(row) {
  if (String(row?.statut || "").trim() === "LIVREE") return "success";
  return "info";
}

function titleFor(row) {
  return String(row?.typeHabit || "").trim() || "Type d'habit non renseigne";
}

function metaItemsFor(row) {
  return [
    {
      key: "date",
      label: "Date",
      value: props.formatDate(row?.date)
    },
    {
      key: "montant",
      label: "Montant",
      value: props.formatCurrency(row?.montant),
      emphasis: true,
      tone: "warning"
    }
  ];
}
</script>

<template>
  <div class="client-history-mobile-list">
    <MobileEntityCard
      v-for="row in items"
      :key="`commande-history-${row.idCommande}`"
      :eyebrow="`Commande #${row.idCommande}`"
      :title="titleFor(row)"
      :subtitle="row.date ? `Commande du ${formatDate(row.date)}` : 'Historique commande'"
      :tone="cardTone(row)"
    >
      <template #badge>
        <span class="status-pill" :data-status="row.statut">
          {{ row.statut || "-" }}
        </span>
      </template>

      <template #meta>
        <MobileMetaList :items="metaItemsFor(row)" />
      </template>

      <template #footer>
        <button type="button" class="action-btn blue client-history-mobile-list__action" @click="emit('view', row.idCommande)">
          Voir le detail
        </button>
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.client-history-mobile-list {
  display: grid;
  gap: 12px;
}

.client-history-mobile-list__action {
  width: 100%;
}
</style>
