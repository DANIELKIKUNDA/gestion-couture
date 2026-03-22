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
  }
});

const emit = defineEmits(["view"]);

function toneFor(row) {
  if (Number(row?.nombrePaiements || 0) > 0 && Number(row?.montantPaye || 0) >= Number(row?.montantTotal || 0)) {
    return "success";
  }
  if (Number(row?.montantPaye || 0) > 0) return "warning";
  return "info";
}

function subtitleFor(row) {
  return String(row?.descriptionCommande || "").trim() || "Description non renseignee";
}

function metaItemsFor(row) {
  return [
    {
      key: "statut",
      label: "Statut",
      value: row?.statutCommande || "-"
    },
    {
      key: "total",
      label: "Montant",
      value: props.formatCurrency(row?.montantTotal)
    },
    {
      key: "paye",
      label: "Paye",
      value: props.formatCurrency(row?.montantPaye)
    },
    {
      key: "paiements",
      label: "Paiements",
      value: props.formatCurrency(row?.totalPaiements)
    },
    {
      key: "nombre-paiements",
      label: "Nb paiements",
      value: row?.nombrePaiements ?? 0,
      emphasis: true
    }
  ];
}
</script>

<template>
  <div class="audit-commande-mobile-list">
    <MobileStateEmpty
      v-if="items.length === 0"
      title="Aucune commande"
      description="Aucune commande n'est disponible dans l'audit pour le moment."
    />
    <template v-else>
      <MobileEntityCard
        v-for="row in items"
        :key="row.idCommande"
        :eyebrow="`Commande #${row.idCommande}`"
        :title="row.clientNom || row.idClient || 'Client non renseigne'"
        :subtitle="subtitleFor(row)"
        :tone="toneFor(row)"
      >
        <template #badge>
          <span class="status-pill" :data-status="row.statutCommande">
            {{ row.statutCommande || "-" }}
          </span>
        </template>

        <template #meta>
          <MobileMetaList :items="metaItemsFor(row)" />
        </template>

        <template #footer>
          <div class="audit-commande-mobile-list__footer">
            <button type="button" class="action-btn blue audit-commande-mobile-list__action" @click="emit('view', row)">
              Voir le detail
            </button>
          </div>
        </template>
      </MobileEntityCard>
    </template>
  </div>
</template>

<style scoped>
.audit-commande-mobile-list {
  display: grid;
  gap: 12px;
}

.audit-commande-mobile-list__footer {
  display: grid;
}

.audit-commande-mobile-list__action {
  width: 100%;
}
</style>
