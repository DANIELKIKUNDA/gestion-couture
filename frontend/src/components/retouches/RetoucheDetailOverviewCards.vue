<script setup>
import { computed } from "vue";
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";

const props = defineProps({
  retouche: {
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
    value: props.retouche?.clientNom || props.retouche?.idClient || "-"
  },
  {
    key: "type",
    label: "Type",
    value: props.retouche?.typeRetouche || "-"
  },
  {
    key: "facture",
    label: "Facture",
    value: props.factureNumber || "Non emise"
  },
  {
    key: "depot",
    label: "Date depot",
    value: props.retouche?.dateDepot || "-"
  },
  {
    key: "prevue",
    label: "Date prevue",
    value: props.retouche?.datePrevue || "-"
  }
]);

const mesureItems = computed(() => [
  {
    key: "type",
    label: "Type habit",
    value: props.retouche?.typeHabit || "-"
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
    value: props.formatCurrency(props.retouche?.montantTotal)
  },
  {
    key: "paye",
    label: "Total paye",
    value: props.formatCurrency(props.retouche?.montantPaye)
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
  <div class="retouche-detail-overview-cards">
    <MobileEntityCard
      eyebrow="Retouche"
      title="Identite retouche"
      :subtitle="retouche.descriptionRetouche || 'Description non renseignee'"
      tone="info"
    >
      <template #badge>
        <span class="status-pill" :data-status="retouche.statutRetouche || ''">
          {{ retouche.statutRetouche || "-" }}
        </span>
      </template>

      <template #meta>
        <MobileMetaList :items="identityItems" />
      </template>
    </MobileEntityCard>

    <MobileEntityCard
      eyebrow="Habit"
      title="Mesures de l'habit"
      subtitle="Lecture rapide des mesures associees a la retouche."
      tone="default"
    >
      <template #meta>
        <MobileMetaList :items="mesureItems" />
      </template>

      <div class="retouche-detail-overview-cards__measure-block">
        <strong>Mesures</strong>
        <ul v-if="mesuresLines.length > 0" class="retouche-detail-overview-cards__measure-list">
          <li v-for="(line, index) in mesuresLines" :key="`retouche-measure-line-${index}`">{{ line }}</li>
        </ul>
        <p v-else class="helper">Aucune mesure.</p>
      </div>
    </MobileEntityCard>

    <MobileEntityCard
      eyebrow="Finance"
      title="Resume financier"
      subtitle="Situation immediate de paiement de la retouche."
      :tone="Number(soldeRestant || 0) > 0 ? 'warning' : 'success'"
    >
      <template #meta>
        <MobileMetaList :items="financeItems" />
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.retouche-detail-overview-cards {
  display: grid;
  gap: 12px;
}

.retouche-detail-overview-cards__measure-block {
  display: grid;
  gap: 8px;
}

.retouche-detail-overview-cards__measure-block strong {
  color: #183550;
  font-size: 14px;
}

.retouche-detail-overview-cards__measure-list {
  display: grid;
  gap: 6px;
  padding-left: 18px;
  margin: 0;
  color: #17324d;
  font-size: 14px;
  line-height: 1.45;
}
</style>
