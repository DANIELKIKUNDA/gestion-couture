<script setup>
import { computed } from "vue";
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";

const props = defineProps({
  vente: {
    type: Object,
    required: true
  },
  factureNumber: {
    type: String,
    default: ""
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

const venteItems = computed(() => [
  {
    key: "date",
    label: "Date",
    value: props.vente?.date ? props.formatDateTime(props.vente.date) : "-"
  },
  {
    key: "facture",
    label: "Facture",
    value: props.factureNumber || "Non emise"
  },
  {
    key: "caisse",
    label: "Ref caisse",
    value: props.vente?.referenceCaisse || "-"
  },
  {
    key: "motif",
    label: "Motif annulation",
    value: props.vente?.statut === "ANNULEE" ? props.vente?.motifAnnulation || "-" : "-"
  }
]);

const financeItems = computed(() => [
  {
    key: "total",
    label: "Total",
    value: props.formatCurrency(props.vente?.total),
    emphasis: true,
    tone: "info"
  }
]);
</script>

<template>
  <div class="vente-detail-overview-cards">
    <MobileEntityCard
      eyebrow="Vente"
      title="Informations vente"
      subtitle="Lecture rapide du statut et du contexte de la vente."
      tone="info"
    >
      <template #badge>
        <span class="status-pill" :data-status="vente.statut || ''">
          {{ vente.statut || "-" }}
        </span>
      </template>

      <template #meta>
        <MobileMetaList :items="venteItems" />
      </template>
    </MobileEntityCard>

    <MobileEntityCard
      eyebrow="Finance"
      title="Resume financier"
      subtitle="Montant global de la vente."
      tone="default"
    >
      <template #meta>
        <MobileMetaList :items="financeItems" />
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.vente-detail-overview-cards {
  display: grid;
  gap: 12px;
}
</style>
