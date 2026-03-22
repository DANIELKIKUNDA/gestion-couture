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
  formatDateTime: {
    type: Function,
    required: true
  },
  operationAuditType: {
    type: Function,
    required: true
  },
  depenseTypeLabel: {
    type: Function,
    required: true
  }
});

function toneFor(row) {
  if (row?.type_operation === "ENTREE") return "success";
  if (row?.type_operation === "SORTIE") return "warning";
  return "info";
}

function titleFor(row) {
  return props.operationAuditType(row) || "Operation";
}

function subtitleFor(row) {
  const moment = props.formatDateTime(row?.date_operation);
  const user = row?.effectue_par || "Utilisateur inconnu";
  return `${moment} · ${user}`;
}

function depenseValue(row) {
  if (row?.type_operation !== "SORTIE") return "-";
  return props.depenseTypeLabel(row?.type_depense);
}

function yesNo(value, yes = "Oui", no = "Non") {
  return value === true ? yes : no;
}

function metaItemsFor(row) {
  return [
    {
      key: "montant",
      label: "Montant",
      value: props.formatCurrency(row?.montant),
      emphasis: true,
      tone: row?.type_operation === "ENTREE" ? "success" : row?.type_operation === "SORTIE" ? "warning" : "info"
    },
    {
      key: "depense",
      label: "Depense",
      value: depenseValue(row)
    },
    {
      key: "mode",
      label: "Paiement",
      value: row?.mode_paiement || "-"
    },
    {
      key: "justification",
      label: "Justification",
      value: row?.justification || "-"
    },
    {
      key: "impact-journalier",
      label: "Impact jour",
      value: yesNo(row?.impact_journalier)
    },
    {
      key: "impact-global",
      label: "Impact global",
      value: row?.impact_global === false ? "Non" : "Oui"
    },
    {
      key: "reference-metier",
      label: "Ref. metier",
      value: row?.reference_metier || "-"
    },
    {
      key: "reference-caisse",
      label: "Ref. caisse",
      value: row?.id_caisse_jour || "-"
    }
  ];
}
</script>

<template>
  <div class="audit-operation-mobile-list">
    <MobileStateEmpty
      v-if="items.length === 0"
      title="Aucune operation"
      description="Le journal financier global est vide pour le moment."
    />
    <template v-else>
      <MobileEntityCard
        v-for="row in items"
        :key="row.id_operation"
        eyebrow="Operation financiere"
        :title="titleFor(row)"
        :subtitle="subtitleFor(row)"
        :tone="toneFor(row)"
      >
        <template #meta>
          <MobileMetaList :items="metaItemsFor(row)" />
        </template>
      </MobileEntityCard>
    </template>
  </div>
</template>

<style scoped>
.audit-operation-mobile-list {
  display: grid;
  gap: 12px;
}
</style>
