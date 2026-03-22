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
  return String(row?.descriptionRetouche || "").trim() || "Description non renseignee";
}

function metaItemsFor(row) {
  return [
    {
      key: "type",
      label: "Type",
      value: row?.typeRetouche || "-"
    },
    {
      key: "statut",
      label: "Statut",
      value: row?.statutRetouche || "-"
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
  <div class="audit-retouche-mobile-list">
    <MobileStateEmpty
      v-if="items.length === 0"
      title="Aucune retouche"
      description="Aucune retouche n'est disponible dans l'audit pour le moment."
    />
    <template v-else>
      <MobileEntityCard
        v-for="row in items"
        :key="row.idRetouche"
        :eyebrow="`Retouche #${row.idRetouche}`"
        :title="row.clientNom || row.idClient || 'Client non renseigne'"
        :subtitle="subtitleFor(row)"
        :tone="toneFor(row)"
      >
        <template #badge>
          <span class="status-pill" :data-status="row.statutRetouche">
            {{ row.statutRetouche || "-" }}
          </span>
        </template>

        <template #meta>
          <MobileMetaList :items="metaItemsFor(row)" />
        </template>

        <template #footer>
          <div class="audit-retouche-mobile-list__footer">
            <button type="button" class="action-btn blue audit-retouche-mobile-list__action" @click="emit('view', row)">
              Voir le detail
            </button>
          </div>
        </template>
      </MobileEntityCard>
    </template>
  </div>
</template>

<style scoped>
.audit-retouche-mobile-list {
  display: grid;
  gap: 12px;
}

.audit-retouche-mobile-list__footer {
  display: grid;
}

.audit-retouche-mobile-list__action {
  width: 100%;
}
</style>
