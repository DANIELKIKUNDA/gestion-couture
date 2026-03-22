<script setup>
import { computed } from "vue";
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";

const props = defineProps({
  facture: {
    type: Object,
    required: true
  },
  atelierProfile: {
    type: Object,
    required: true
  },
  atelierContactLine: {
    type: String,
    default: ""
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

const atelierItems = computed(() => [
  {
    key: "adresse",
    label: "Adresse",
    value: props.atelierProfile?.adresse || "-"
  },
  {
    key: "contact",
    label: "Contact",
    value: props.atelierContactLine || "-"
  },
  {
    key: "devise",
    label: "Devise",
    value: props.atelierProfile?.devise || "-"
  },
  {
    key: "mentions",
    label: "Mentions",
    value: props.atelierProfile?.mentions || "-"
  }
]);

const headerItems = computed(() => [
  {
    key: "numero",
    label: "Numero",
    value: props.facture?.numeroFacture || "-"
  },
  {
    key: "date",
    label: "Emission",
    value: props.facture?.dateEmission ? props.formatDate(props.facture.dateEmission) : "-"
  },
  {
    key: "client",
    label: "Client",
    value: props.facture?.client?.nom || "-"
  },
  {
    key: "contact",
    label: "Contact",
    value: props.facture?.client?.contact || "-"
  },
  {
    key: "origine",
    label: "Origine",
    value: `${props.facture?.typeOrigine || "-"} / ${props.facture?.idOrigine || "-"}`
  },
  {
    key: "caisse",
    label: "Ref caisse",
    value: props.facture?.referenceCaisse || "-"
  }
]);

const financeItems = computed(() => [
  {
    key: "total",
    label: "Total",
    value: props.formatCurrency(props.facture?.montantTotal)
  },
  {
    key: "paye",
    label: "Paye",
    value: props.formatCurrency(props.facture?.montantPaye)
  },
  {
    key: "solde",
    label: "Solde",
    value: props.formatCurrency(props.facture?.solde),
    emphasis: true,
    tone: Number(props.facture?.solde || 0) > 0 ? "warning" : "success"
  },
  {
    key: "statut",
    label: "Statut",
    value: props.facture?.statut || "-"
  }
]);
</script>

<template>
  <div class="facture-detail-overview-cards">
    <MobileEntityCard
      eyebrow="Atelier"
      :title="atelierProfile.nomAtelier || '-'"
      subtitle="Informations de presentation de la facture."
      tone="info"
    >
      <template #media>
        <img
          v-if="atelierProfile.afficherLogo && atelierProfile.logo"
          :src="atelierProfile.logo"
          alt="Logo atelier"
          class="facture-detail-overview-cards__logo"
        />
      </template>

      <template #meta>
        <MobileMetaList :items="atelierItems" />
      </template>
    </MobileEntityCard>

    <MobileEntityCard
      eyebrow="Facture"
      title="En-tete"
      subtitle="Informations generales de la facture."
      tone="default"
    >
      <template #badge>
        <span class="status-pill" :data-status="facture.statut || ''">
          {{ facture.statut || "-" }}
        </span>
      </template>

      <template #meta>
        <MobileMetaList :items="headerItems" />
      </template>
    </MobileEntityCard>

    <MobileEntityCard
      eyebrow="Finance"
      title="Resume financier"
      subtitle="Lecture rapide du montant, du reglement et du solde."
      :tone="Number(facture.solde || 0) > 0 ? 'warning' : 'success'"
    >
      <template #meta>
        <MobileMetaList :items="financeItems" />
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.facture-detail-overview-cards {
  display: grid;
  gap: 12px;
}

.facture-detail-overview-cards__logo {
  display: block;
  width: 100%;
  max-width: 96px;
  height: 96px;
  object-fit: contain;
  margin: 0 auto;
  padding: 8px;
  background: #fff;
}
</style>
