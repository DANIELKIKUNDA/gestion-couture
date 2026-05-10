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
  return `[${props.sourceLabel(op?.sourceFlux)}][${op?.activite || "ATELIER"}] ${signedAmount(op)}`;
}

function subtitleFor(op) {
  const motif = String(op?.motif || "").trim() || String(op?.typeOperation || "").trim() || "Operation";
  const detail = op?.justification || op?.referenceMetier || op?.effectuePar || "";
  return detail ? `${motif} - ${detail}` : motif;
}

function signedAmount(op) {
  const amount = props.formatCurrency(op?.montant);
  return String(op?.typeOperation || "").trim() === "SORTIE" ? `-${amount}` : `+${amount}`;
}

function amountTone(op) {
  return String(op?.typeOperation || "").trim() === "SORTIE" ? "warning" : "success";
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
      label: "Lecture",
      value: `[${props.sourceLabel(op?.sourceFlux)}][${op?.activite || "ATELIER"}]`
    },
    {
      key: "montant",
      label: "Montant",
      value: signedAmount(op),
      emphasis: true,
      tone: amountTone(op)
    },
    {
      key: "source",
      label: "Source",
      value: props.sourceLabel(op?.sourceFlux)
    },
    {
      key: "activite",
      label: "Activite",
      value: op?.activite || "ATELIER"
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
          <span class="caisse-operation-amount" :data-tone="amountTone(op)">
            {{ signedAmount(op) }}
          </span>
          <span class="status-pill" :data-tone="props.sourceTone(op?.sourceFlux)">
            {{ props.sourceLabel(op?.sourceFlux) }}
          </span>
          <span class="status-pill" data-tone="info">
            {{ op.activite || "ATELIER" }}
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

.caisse-operation-amount {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  border-radius: 999px;
  padding: 0 10px;
  font-size: 0.78rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.caisse-operation-amount[data-tone="success"] {
  color: #17643d;
  background: #e4f7e9;
}

.caisse-operation-amount[data-tone="warning"] {
  color: #9f2f24;
  background: #fde7e4;
}
</style>
