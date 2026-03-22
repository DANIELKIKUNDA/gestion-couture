<script setup>
import { computed } from "vue";
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";

const props = defineProps({
  commande: {
    type: Object,
    required: true
  },
  factureNumber: {
    type: String,
    default: ""
  },
  mesuresLines: {
    type: Array,
    default: () => []
  },
  soldeRestant: {
    type: Number,
    default: 0
  },
  formatCurrency: {
    type: Function,
    required: true
  }
});

const identityItems = computed(() => [
  {
    key: "client",
    label: "Client",
    value: props.commande?.clientNom || props.commande?.idClient || "-"
  },
  {
    key: "facture",
    label: "Facture",
    value: props.factureNumber || "Non emise"
  },
  {
    key: "creation",
    label: "Creation",
    value: props.commande?.dateCreation || "-"
  },
  {
    key: "prevue",
    label: "Date prevue",
    value: props.commande?.datePrevue || "-"
  }
]);

const mesureItems = computed(() => [
  {
    key: "type",
    label: "Type habit",
    value: props.commande?.typeHabit || "-"
  },
  {
    key: "unite",
    label: "Unite",
    value: "cm"
  },
  {
    key: "mode",
    label: "Mode",
    value: "Lecture seule"
  }
]);

const financeItems = computed(() => [
  {
    key: "total",
    label: "Montant total",
    value: props.formatCurrency(props.commande?.montantTotal)
  },
  {
    key: "paye",
    label: "Total paye",
    value: props.formatCurrency(props.commande?.montantPaye)
  },
  {
    key: "solde",
    label: "Solde restant",
    value: props.formatCurrency(props.soldeRestant),
    emphasis: true,
    tone: Number(props.soldeRestant || 0) > 0 ? "warning" : "success"
  }
]);
</script>

<template>
  <div class="commande-detail-overview-cards">
    <MobileEntityCard
      eyebrow="Commande"
      title="Identite commande"
      :subtitle="commande.descriptionCommande || 'Description non renseignee'"
      tone="info"
    >
      <template #badge>
        <span class="status-pill" :data-status="commande.statutCommande || ''">
          {{ commande.statutCommande || "-" }}
        </span>
      </template>

      <template #meta>
        <MobileMetaList :items="identityItems" />
      </template>
    </MobileEntityCard>

    <MobileEntityCard
      eyebrow="Habit"
      title="Mesures de l'habit"
      subtitle="Lecture rapide des informations de mesure associees."
      tone="default"
    >
      <template #meta>
        <MobileMetaList :items="mesureItems" />
      </template>

      <div class="commande-detail-overview-cards__measure-block">
        <strong>Mesures</strong>
        <ul v-if="mesuresLines.length > 0" class="commande-detail-overview-cards__measure-list">
          <li v-for="(line, index) in mesuresLines" :key="`measure-line-${index}`">{{ line }}</li>
        </ul>
        <p v-else class="helper">Aucune mesure.</p>
      </div>
    </MobileEntityCard>

    <MobileEntityCard
      eyebrow="Finance"
      title="Resume financier"
      subtitle="Situation immediate de paiement de la commande."
      :tone="Number(soldeRestant || 0) > 0 ? 'warning' : 'success'"
    >
      <template #meta>
        <MobileMetaList :items="financeItems" />
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.commande-detail-overview-cards {
  display: grid;
  gap: 12px;
}

.commande-detail-overview-cards__measure-block {
  display: grid;
  gap: 8px;
}

.commande-detail-overview-cards__measure-block strong {
  color: #183550;
  font-size: 14px;
}

.commande-detail-overview-cards__measure-list {
  display: grid;
  gap: 6px;
  padding-left: 18px;
  margin: 0;
  color: #17324d;
  font-size: 14px;
  line-height: 1.45;
}
</style>
