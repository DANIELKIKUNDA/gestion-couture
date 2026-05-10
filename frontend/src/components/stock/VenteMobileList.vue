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
  caisseOuverte: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(["view", "validate", "validate-invoice"]);

function toneFor(vente) {
  if (String(vente?.statut || "").trim() === "VALIDEE") return "success";
  if (String(vente?.statut || "").trim() === "ANNULEE") return "default";
  return "warning";
}

function metaItemsFor(vente) {
  return [
    {
      key: "acheteur",
      label: "Acheteur",
      value: vente?.acheteurNom || "Non renseigne"
    },
    {
      key: "date",
      label: "Date",
      value: props.formatDateTime(vente?.date)
    },
    {
      key: "total",
      label: "Total",
      value: props.formatCurrency(vente?.total),
      emphasis: true,
      tone: "warning"
    },
    {
      key: "caisse",
      label: "Ref. caisse",
      value: vente?.referenceCaisse || "-"
    }
  ];
}

function isDraft(vente) {
  return String(vente?.statut || "").trim() === "BROUILLON";
}
</script>

<template>
  <div class="vente-mobile-list">
    <MobileEntityCard
      v-for="vente in items"
      :key="vente.idVente"
      :eyebrow="`Vente #${vente.idVente}`"
      :title="vente.acheteurNom || 'Acheteur non renseigne'"
      :subtitle="vente.date ? `Enregistree le ${formatDateTime(vente.date)}` : 'Vente atelier'"
      :tone="toneFor(vente)"
    >
      <template #badge>
        <span class="status-pill" :data-status="vente.statut">
          {{ vente.statut || "-" }}
        </span>
      </template>

      <template #meta>
        <MobileMetaList :items="metaItemsFor(vente)" />
      </template>

      <template #footer>
        <div class="vente-mobile-list__footer">
          <button type="button" class="mini-btn vente-mobile-list__action" @click="emit('view', vente)">
            Voir le detail
          </button>
          <template v-if="isDraft(vente)">
            <button
              type="button"
              class="mini-btn vente-mobile-list__action"
              :class="{ 'is-locked': !caisseOuverte }"
              @click="emit('validate', vente)"
            >
              Valider
            </button>
            <button
              type="button"
              class="action-btn green vente-mobile-list__action"
              :class="{ 'is-locked': !caisseOuverte }"
              @click="emit('validate-invoice', vente)"
            >
              Valider + facture
            </button>
            <p v-if="!caisseOuverte" class="vente-mobile-list__hint">
              Caisse fermee: cette vente reste en brouillon.
            </p>
          </template>
        </div>
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.vente-mobile-list {
  display: grid;
  gap: 12px;
}

.vente-mobile-list__action {
  width: 100%;
}

.vente-mobile-list__footer {
  display: grid;
  gap: 8px;
}

.vente-mobile-list__hint {
  margin: 0;
  color: #8a5b0a;
  font-size: 0.8rem;
  font-weight: 700;
  text-align: center;
}

.is-locked {
  opacity: 0.72;
}
</style>
