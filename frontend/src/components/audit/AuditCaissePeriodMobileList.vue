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
  mode: {
    type: String,
    default: "period"
  }
});

function titleFor(row) {
  if (props.mode === "annual") {
    return `Annee ${row?.annee || "-"}`;
  }
  return `${row?.date_debut || "-"} -> ${row?.date_fin || "-"}`;
}

function subtitleFor() {
  if (props.mode === "weekly") return "Bilan hebdomadaire";
  if (props.mode === "monthly") return "Bilan mensuel";
  if (props.mode === "annual") return "Bilan annuel";
  return "Bilan";
}

function metaItemsFor(row) {
  const items = [];
  if (props.mode === "annual") {
    items.push({
      key: "periode",
      label: "Periode",
      value: `${row?.date_debut || "-"} -> ${row?.date_fin || "-"}`
    });
  }
  items.push(
    {
      key: "solde-debut",
      label: "Solde debut",
      value: props.formatCurrency(row?.solde_ouverture)
    },
    {
      key: "entrees",
      label: "Entrees",
      value: props.formatCurrency(row?.total_entrees)
    },
    {
      key: "sorties",
      label: "Sorties",
      value: props.formatCurrency(row?.total_sorties)
    },
    {
      key: "solde-fin",
      label: "Solde fin",
      value: props.formatCurrency(row?.solde_cloture),
      emphasis: true,
      tone: "info"
    }
  );
  return items;
}

function emptyDescription() {
  if (props.mode === "weekly") return "Aucun bilan hebdomadaire n'est disponible.";
  if (props.mode === "monthly") return "Aucun bilan mensuel n'est disponible.";
  if (props.mode === "annual") return "Aucun bilan annuel n'est disponible.";
  return "Aucun bilan n'est disponible.";
}
</script>

<template>
  <div class="audit-caisse-period-mobile-list">
    <MobileStateEmpty
      v-if="items.length === 0"
      title="Aucun bilan disponible"
      :description="emptyDescription()"
    />
    <template v-else>
      <MobileEntityCard
        v-for="row in items"
        :key="row.id_bilan"
        eyebrow="Bilan caisse"
        :title="titleFor(row)"
        :subtitle="subtitleFor(row)"
        tone="default"
      >
        <template #meta>
          <MobileMetaList :items="metaItemsFor(row)" />
        </template>
      </MobileEntityCard>
    </template>
  </div>
</template>

<style scoped>
.audit-caisse-period-mobile-list {
  display: grid;
  gap: 12px;
}
</style>
