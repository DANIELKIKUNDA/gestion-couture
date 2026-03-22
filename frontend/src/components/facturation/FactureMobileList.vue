<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";
import MobileStateEmpty from "../mobile/MobileStateEmpty.vue";

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

function toneFor(facture) {
  if (String(facture?.statut || "").trim() === "ANNULEE") return "default";
  if (Number(facture?.solde || 0) > 0) return "warning";
  return "success";
}

function subtitleFor(facture) {
  return facture?.client?.nom || "Client non renseigne";
}

function metaItemsFor(facture) {
  return [
    {
      key: "origine",
      label: "Origine",
      value: `${facture?.typeOrigine || "-"} / ${facture?.idOrigine || "-"}`
    },
    {
      key: "date",
      label: "Emission",
      value: facture?.dateEmission ? props.formatDate(facture.dateEmission) : "-"
    },
    {
      key: "total",
      label: "Total",
      value: props.formatCurrency(facture?.montantTotal)
    },
    {
      key: "solde",
      label: "Solde",
      value: props.formatCurrency(facture?.solde),
      emphasis: true,
      tone: Number(facture?.solde || 0) > 0 ? "warning" : "success"
    }
  ];
}
</script>

<template>
  <div class="facture-mobile-list">
    <MobileStateEmpty
      v-if="items.length === 0"
      title="Aucune facture disponible"
      description="Aucune facture ne correspond aux filtres actuels."
    />
    <template v-else>
      <MobileEntityCard
        v-for="facture in items"
        :key="facture.idFacture"
        eyebrow="Facture"
        :title="facture.numeroFacture || 'Numero non renseigne'"
        :subtitle="subtitleFor(facture)"
        :tone="toneFor(facture)"
      >
        <template #badge>
          <span class="status-pill" :data-status="facture.statut || ''">
            {{ facture.statut || "-" }}
          </span>
        </template>

        <template #meta>
          <MobileMetaList :items="metaItemsFor(facture)" />
        </template>

        <template #footer>
          <button type="button" class="action-btn blue facture-mobile-list__action" @click="emit('view', facture)">
            Voir le detail
          </button>
        </template>
      </MobileEntityCard>
    </template>
  </div>
</template>

<style scoped>
.facture-mobile-list {
  display: grid;
  gap: 12px;
}

.facture-mobile-list__action {
  width: 100%;
}
</style>
