<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";
import MobileStateEmpty from "../mobile/MobileStateEmpty.vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
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

function toneFor(paiement) {
  return String(paiement?.statutOperation || "").trim() === "ANNULEE" ? "default" : "success";
}

function subtitleFor(paiement) {
  return paiement?.motif || paiement?.referenceMetier || "Paiement de retouche";
}

function metaItemsFor(paiement) {
  return [
    {
      key: "date",
      label: "Date",
      value: props.formatDateTime(paiement?.dateOperation || paiement?.dateJour)
    },
    {
      key: "montant",
      label: "Montant",
      value: props.formatCurrency(paiement?.montant),
      emphasis: true,
      tone: "success"
    },
    {
      key: "mode",
      label: "Mode",
      value: paiement?.modePaiement || "-"
    },
    {
      key: "reference",
      label: "Reference",
      value: paiement?.motif || paiement?.referenceMetier || "-"
    }
  ];
}
</script>

<template>
  <div class="retouche-detail-payment-mobile-list">
    <p v-if="loading" class="helper">Chargement...</p>
    <MobileStateEmpty
      v-else-if="items.length === 0"
      title="Aucun paiement enregistre"
      description="Les paiements de cette retouche apparaitront ici."
    />
    <template v-else>
      <MobileEntityCard
        v-for="paiement in items"
        :key="paiement.idOperation"
        eyebrow="Paiement"
        :title="formatCurrency(paiement.montant)"
        :subtitle="subtitleFor(paiement)"
        :tone="toneFor(paiement)"
      >
        <template #badge>
          <span class="status-pill" :data-status="paiement.statutOperation || ''">
            {{ paiement.statutOperation || "-" }}
          </span>
        </template>

        <template #meta>
          <MobileMetaList :items="metaItemsFor(paiement)" />
        </template>
      </MobileEntityCard>
    </template>
  </div>
</template>

<style scoped>
.retouche-detail-payment-mobile-list {
  display: grid;
  gap: 12px;
}
</style>
