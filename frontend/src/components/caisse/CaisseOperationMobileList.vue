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
  formatDateTime: {
    type: Function,
    required: true
  },
  sourceLabel: {
    type: Function,
    required: true
  },
  sourceTone: {
    type: Function,
    required: true
  },
  depenseTypeLabel: {
    type: Function,
    required: true
  }
});

function toneFor(op) {
  if (String(op?.statutOperation || "").trim() === "ANNULEE") return "default";
  return String(op?.typeOperation || "").trim() === "SORTIE" ? "warning" : "success";
}

function titleFor(op) {
  return String(op?.motif || "").trim() || String(op?.typeOperation || "").trim() || "Operation";
}

function subtitleFor(op) {
  return op?.justification || op?.referenceMetier || "Operation de caisse";
}

function metaItemsFor(op) {
  return [
    {
      key: "date",
      label: "Date",
      value: props.formatDateTime(op?.dateOperation)
    },
    {
      key: "type",
      label: "Type",
      value: op?.typeOperation || "-"
    },
    {
      key: "montant",
      label: "Montant",
      value: props.formatCurrency(op?.montant),
      emphasis: true,
      tone: String(op?.typeOperation || "").trim() === "SORTIE" ? "warning" : "success"
    },
    {
      key: "source",
      label: "Source",
      value: props.sourceLabel(op?.sourceFlux)
    },
    {
      key: "depense",
      label: "Type depense",
      value: op?.typeOperation === "SORTIE" ? props.depenseTypeLabel(op?.typeDepense) : "-"
    },
    {
      key: "mode",
      label: "Mode",
      value: op?.modePaiement || "-"
    },
    {
      key: "utilisateur",
      label: "Utilisateur",
      value: op?.effectuePar || "-"
    },
    {
      key: "reference",
      label: "Reference",
      value: op?.referenceMetier || "-"
    }
  ];
}
</script>

<template>
  <div class="caisse-operation-mobile-list">
    <MobileEntityCard
      v-for="op in items"
      :key="op.idOperation"
      :eyebrow="`Operation #${op.idOperation}`"
      :title="titleFor(op)"
      :subtitle="subtitleFor(op)"
      :tone="toneFor(op)"
    >
      <template #badge>
        <div class="caisse-operation-badges">
          <span class="status-pill" :data-tone="props.sourceTone(op?.sourceFlux)">
            {{ props.sourceLabel(op?.sourceFlux) }}
          </span>
          <span class="status-pill" :data-status="op.statutOperation || 'INCONNUE'">
            {{ op.statutOperation || "-" }}
          </span>
        </div>
      </template>

      <template #meta>
        <MobileMetaList :items="metaItemsFor(op)" />
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.caisse-operation-mobile-list {
  display: grid;
  gap: 12px;
}

.caisse-operation-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
