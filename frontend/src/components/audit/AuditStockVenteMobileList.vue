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
  }
});

const emit = defineEmits(["view"]);

function isVente(row) {
  return !!(row?.referenceMetier && String(row.referenceMetier).startsWith("VTE-"));
}

function toneFor(row) {
  return isVente(row) ? "success" : "info";
}

function subtitleFor(row) {
  return row?.dateMouvement ? `Enregistre le ${props.formatDateTime(row.dateMouvement)}` : "Mouvement de stock";
}

function metaItemsFor(row) {
  const montant = row?.montantEncaisse === null ? row?.montantEstime : row?.montantEncaisse;
  return [
    {
      key: "quantite",
      label: "Quantite",
      value: row?.quantite ?? "-"
    },
    {
      key: "montant",
      label: "Montant",
      value: props.formatCurrency(montant),
      emphasis: true,
      tone: isVente(row) ? "success" : "info"
    },
    {
      key: "caisse",
      label: "Ref. caisse",
      value: row?.idCaisseJour || "-"
    },
    {
      key: "utilisateur",
      label: "Utilisateur",
      value: row?.utilisateur || "-"
    },
    {
      key: "reference-metier",
      label: "Ref. metier",
      value: row?.referenceMetier || "-"
    }
  ];
}
</script>

<template>
  <div class="audit-stock-vente-mobile-list">
    <MobileStateEmpty
      v-if="items.length === 0"
      title="Aucune vente ou sortie"
      description="Aucune vente ou sortie de stock n'est disponible dans l'audit pour le moment."
    />
    <template v-else>
      <MobileEntityCard
        v-for="row in items"
        :key="row.idMouvement"
        eyebrow="Mouvement de stock"
        :title="row.nomArticle || row.idArticle || 'Article non renseigne'"
        :subtitle="subtitleFor(row)"
        :tone="toneFor(row)"
      >
        <template #badge>
          <span v-if="isVente(row)" class="status-pill" data-tone="ok">VENTE</span>
        </template>

        <template #meta>
          <MobileMetaList :items="metaItemsFor(row)" />
        </template>

        <template #footer v-if="isVente(row)">
          <div class="audit-stock-vente-mobile-list__footer">
            <button
              type="button"
              class="action-btn blue audit-stock-vente-mobile-list__action"
              @click="emit('view', row)"
            >
              Voir vente
            </button>
          </div>
        </template>
      </MobileEntityCard>
    </template>
  </div>
</template>

<style scoped>
.audit-stock-vente-mobile-list {
  display: grid;
  gap: 12px;
}

.audit-stock-vente-mobile-list__footer {
  display: grid;
}

.audit-stock-vente-mobile-list__action {
  width: 100%;
}
</style>
