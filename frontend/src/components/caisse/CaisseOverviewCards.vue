<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";

const props = defineProps({
  caisse: { type: Object, default: null },
  status: { type: String, default: "INCONNUE" },
  totals: { type: Object, default: () => ({}) },
  formatCurrency: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
  formatOpenedBy: { type: Function, required: true },
  formatClosedBy: { type: Function, required: true }
});

function statusTone() {
  return props.status === "OUVERTE" ? "success" : "warning";
}

function statusItems() {
  return [
    {
      key: "ouverture",
      label: "Solde d'ouverture",
      value: props.formatCurrency(props.caisse?.soldeOuverture),
      emphasis: true,
      tone: "info"
    },
    {
      key: "courant",
      label: "Solde global courant",
      value: props.formatCurrency(props.caisse?.soldeCourant),
      emphasis: true,
      tone: props.status === "OUVERTE" ? "success" : "warning"
    },
    { key: "ouvertePar", label: "Ouverte par", value: props.formatOpenedBy(props.caisse) },
    { key: "dateOuverture", label: "Date d'ouverture", value: props.formatDateTime(props.caisse?.dateOuverture) }
  ];
}

function balanceItems() {
  if (props.totals?.soldesDisponibles !== true) {
    if (props.totals?.soldesAvantReference === true) {
      return [{ key: "reference", label: "Soldes Atelier / Stock", value: `Disponibles depuis ${props.totals?.dateReferenceSoldes || "la date de reference"}`, emphasis: true, tone: "info" }];
    }
    if (props.totals?.soldesDonneesPresentes === true && props.totals?.allocationConfigured !== true) {
      return [{ key: "allocation", label: "Soldes Atelier / Stock", value: "Repartition initiale a definir", emphasis: true, tone: "warning" }];
    }
    return [{ key: "sync", label: "Soldes Atelier / Stock", value: "Synchronisation...", emphasis: true, tone: "warning" }];
  }
  const rows = [
    {
      key: "soldeAtelier",
      label: "Solde Atelier",
      value: props.formatCurrency(props.totals?.soldeAtelier),
      emphasis: true,
      tone: Number(props.totals?.soldeAtelier || 0) < 0 ? "warning" : "info"
    },
    {
      key: "soldeStock",
      label: "Solde Stock",
      value: props.formatCurrency(props.totals?.soldeStock),
      emphasis: true,
      tone: Number(props.totals?.soldeStock || 0) < 0 ? "warning" : "success"
    }
  ];
  if (Math.abs(Number(props.totals?.soldeNonReparti || 0)) > 0.005) {
    rows.push({
      key: "nonReparti",
      label: "Solde initial non reparti",
      value: props.formatCurrency(props.totals?.soldeNonReparti),
      emphasis: true,
      tone: "warning"
    });
  }
  return rows;
}

function resultItems() {
  return [
    {
      key: "entrees",
      label: "Entrees du jour",
      value: props.formatCurrency(props.totals?.totalEntrees),
      emphasis: true,
      tone: "success"
    },
    {
      key: "sortiesQuotidiennes",
      label: "Depenses quotidiennes",
      value: props.formatCurrency(props.totals?.totalSortiesQuotidiennes),
      tone: "warning"
    },
    {
      key: "sortiesExceptionnelles",
      label: "Depenses exceptionnelles",
      value: props.formatCurrency(props.totals?.totalSortiesExceptionnelles),
      tone: "warning"
    },
    {
      key: "totalSorties",
      label: "Total depenses",
      value: props.formatCurrency(props.totals?.totalSorties),
      tone: "warning"
    },
    {
      key: "resultat",
      label: "Resultat du jour",
      value: props.formatCurrency(props.totals?.resultatJournalier),
      emphasis: true,
      tone: Number(props.totals?.resultatJournalier || 0) < 0 ? "warning" : "success"
    },
    { key: "clotureePar", label: "Cloturee par", value: props.formatClosedBy(props.caisse) },
    { key: "dateCloture", label: "Date de cloture", value: props.formatDateTime(props.caisse?.dateCloture) }
  ];
}
</script>

<template>
  <div class="caisse-overview-cards">
    <MobileEntityCard
      eyebrow="Statut de la caisse"
      title="Caisse du jour"
      subtitle="Etat et disponibilite globale"
      :tone="statusTone()"
    >
      <template #badge>
        <span class="status-pill" :data-status="status">{{ status }}</span>
      </template>
      <template #meta><MobileMetaList :items="statusItems()" /></template>
    </MobileEntityCard>

    <MobileEntityCard
      eyebrow="Soldes cumulatifs"
      title="Atelier et Stock"
      subtitle="Argent encore disponible par activite"
      tone="default"
    >
      <template #meta><MobileMetaList :items="balanceItems()" /></template>
    </MobileEntityCard>

    <MobileEntityCard
      eyebrow="Activite du jour"
      title="Resultat journalier"
      subtitle="Entrees du jour moins depenses quotidiennes"
      tone="info"
    >
      <template #meta><MobileMetaList :items="resultItems()" /></template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.caisse-overview-cards { display: grid; gap: 12px; }
</style>
