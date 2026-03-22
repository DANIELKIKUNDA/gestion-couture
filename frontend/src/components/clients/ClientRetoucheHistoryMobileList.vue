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
  return String(row?.typeRetouche || "").trim() || "Retouche";
}

function subtitleFor(row) {
  const typeHabit = String(row?.typeHabit || "").trim();
  return typeHabit ? `Type d'habit: ${typeHabit}` : "Type d'habit non renseigne";
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
      :key="`retouche-history-${row.idRetouche}`"
      :eyebrow="`Retouche #${row.idRetouche}`"
      :title="titleFor(row)"
      :subtitle="subtitleFor(row)"
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
        <button type="button" class="action-btn blue client-history-mobile-list__action" @click="emit('view', row.idRetouche)">
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
