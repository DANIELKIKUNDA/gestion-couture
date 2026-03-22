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

function toneFor(row) {
  if (String(row?.statut || "").trim() === "ANNULEE") return "default";
  if (Number(row?.solde || 0) > 0) return "warning";
  return "success";
}

function subtitleFor(row) {
  return row?.client?.nom || "Client non renseigne";
}

function metaItemsFor(row) {
  return [
    {
      key: "origine",
      label: "Origine",
      value: `${row?.typeOrigine || "-"} / ${row?.idOrigine || "-"}`
    },
    {
      key: "date-emission",
      label: "Emission",
      value: row?.dateEmission ? props.formatDate(row.dateEmission) : "-"
    },
    {
      key: "total",
      label: "Total",
      value: props.formatCurrency(row?.montantTotal)
    },
    {
      key: "paye",
      label: "Paye",
      value: props.formatCurrency(row?.montantPaye)
    },
    {
      key: "solde",
      label: "Solde",
      value: props.formatCurrency(row?.solde),
      emphasis: true,
      tone: Number(row?.solde || 0) > 0 ? "warning" : "success"
    },
    {
      key: "statut",
      label: "Statut",
      value: row?.statut || "-"
    }
  ];
}
</script>

<template>
  <div class="audit-facture-mobile-list">
    <MobileStateEmpty
      v-if="items.length === 0"
      title="Aucune facture"
      description="Aucune facture n'est disponible dans l'audit pour le moment."
    />
    <template v-else>
      <MobileEntityCard
        v-for="row in items"
        :key="row.idFacture"
        eyebrow="Facture"
        :title="row.numeroFacture || 'Numero non renseigne'"
        :subtitle="subtitleFor(row)"
        :tone="toneFor(row)"
      >
        <template #badge>
          <span class="status-pill" :data-status="row.statut || ''">
            {{ row.statut || "-" }}
          </span>
        </template>

        <template #meta>
          <MobileMetaList :items="metaItemsFor(row)" />
        </template>
      </MobileEntityCard>
    </template>
  </div>
</template>

<style scoped>
.audit-facture-mobile-list {
  display: grid;
  gap: 12px;
}
</style>
