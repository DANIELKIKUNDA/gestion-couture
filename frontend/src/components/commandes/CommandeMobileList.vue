<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  selectedId: {
    type: [String, Number],
    default: ""
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

function cardTone(commande) {
  if (!commande) return "default";
  if (Number(commande.soldeRestant || 0) > 0) return "warning";
  if (String(commande.statutCommande || "").trim() === "LIVREE") return "success";
  return "info";
}

function descriptionFor(commande) {
  return String(commande?.descriptionCommande || "").trim() || "Description non renseignee";
}

function soldeTone(commande) {
  return Number(commande?.soldeRestant || 0) > 0 ? "warning" : "success";
}

function metaItemsFor(commande) {
  return [
    {
      key: "date",
      label: "Date prevue",
      value: commande?.datePrevue ? props.formatDate(commande.datePrevue) : "-"
    },
    {
      key: "total",
      label: "Total",
      value: props.formatCurrency(commande?.montantTotal)
    },
    {
      key: "solde",
      label: "Solde",
      value: props.formatCurrency(commande?.soldeRestant),
      emphasis: true,
      tone: soldeTone(commande)
    }
  ];
}

function isSelected(commande) {
  return String(commande?.idCommande || "") !== "" && String(commande.idCommande) === String(props.selectedId || "");
}
</script>

<template>
  <div class="commande-mobile-list">
    <MobileEntityCard
      v-for="commande in items"
      :key="commande.idCommande"
      :eyebrow="`Commande #${commande.idCommande}`"
      :title="commande.clientNom || 'Client non renseigne'"
      :subtitle="descriptionFor(commande)"
      :tone="cardTone(commande)"
      class="commande-mobile-list__card"
      :class="{ 'commande-mobile-list__card--selected': isSelected(commande) }"
    >
      <template #badge>
        <span class="status-pill" :data-status="commande.statutCommande">
          {{ commande.statutCommande || "-" }}
        </span>
      </template>

      <template #meta>
        <MobileMetaList :items="metaItemsFor(commande)" />
      </template>

      <template #footer>
        <div class="commande-mobile-list__footer">
          <span class="status-pill" :data-tone="Number(commande.soldeRestant || 0) > 0 ? 'due' : 'ok'">
            {{ Number(commande.soldeRestant || 0) > 0 ? "Solde restant" : "Solde OK" }}
          </span>
          <button type="button" class="action-btn blue commande-mobile-list__action" @click="emit('view', commande)">
            Voir le detail
          </button>
        </div>
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.commande-mobile-list {
  display: grid;
  gap: 12px;
}

.commande-mobile-list__card {
  min-width: 0;
}

.commande-mobile-list__card--selected {
  border-color: #98b4d3;
  box-shadow: 0 16px 36px rgba(31, 79, 135, 0.16);
}

.commande-mobile-list__footer {
  display: grid;
  gap: 10px;
}

.commande-mobile-list__action {
  width: 100%;
}
</style>
