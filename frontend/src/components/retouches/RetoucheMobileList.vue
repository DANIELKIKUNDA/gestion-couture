<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  selectedId: {
    type: [String, Number],
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

const emit = defineEmits(["view"]);

function cardTone(retouche) {
  if (!retouche) return "default";
  if (Number(retouche.soldeRestant || 0) > 0) return "warning";
  if (String(retouche.statutRetouche || "").trim() === "LIVREE") return "success";
  return "info";
}

function descriptionFor(retouche) {
  return String(retouche?.descriptionRetouche || "").trim() || "Description non renseignee";
}

function typeFor(retouche) {
  return String(retouche?.typeRetouche || "").trim() || "Type non renseigne";
}

function soldeTone(retouche) {
  return Number(retouche?.soldeRestant || 0) > 0 ? "warning" : "success";
}

function metaItemsFor(retouche) {
  return [
    {
      key: "type",
      label: "Type",
      value: typeFor(retouche)
    },
    {
      key: "dateDepot",
      label: "Date depot",
      value: retouche?.dateDepot ? props.formatDate(retouche.dateDepot) : "-"
    },
    {
      key: "datePrevue",
      label: "Date prevue",
      value: retouche?.datePrevue ? props.formatDate(retouche.datePrevue) : "-"
    },
    {
      key: "solde",
      label: "Solde",
      value: props.formatCurrency(retouche?.soldeRestant),
      emphasis: true,
      tone: soldeTone(retouche)
    }
  ];
}

function isSelected(retouche) {
  return String(retouche?.idRetouche || "") !== "" && String(retouche.idRetouche) === String(props.selectedId || "");
}
</script>

<template>
  <div class="retouche-mobile-list">
    <MobileEntityCard
      v-for="retouche in items"
      :key="retouche.idRetouche"
      :eyebrow="`Retouche #${retouche.idRetouche}`"
      :title="retouche.clientNom || 'Client non renseigne'"
      :subtitle="descriptionFor(retouche)"
      :tone="cardTone(retouche)"
      class="retouche-mobile-list__card"
      :class="{ 'retouche-mobile-list__card--selected': isSelected(retouche) }"
    >
      <template #badge>
        <span class="status-pill" :data-status="retouche.statutRetouche">
          {{ retouche.statutRetouche || "-" }}
        </span>
      </template>

      <template #meta>
        <MobileMetaList :items="metaItemsFor(retouche)" />
      </template>

      <template #footer>
        <div class="retouche-mobile-list__footer">
          <span class="status-pill" :data-tone="Number(retouche.soldeRestant || 0) > 0 ? 'due' : 'ok'">
            {{ Number(retouche.soldeRestant || 0) > 0 ? "Solde restant" : "Solde OK" }}
          </span>
          <button type="button" class="action-btn blue retouche-mobile-list__action" @click="emit('view', retouche)">
            Voir le detail
          </button>
        </div>
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.retouche-mobile-list {
  display: grid;
  gap: 12px;
}

.retouche-mobile-list__card {
  min-width: 0;
}

.retouche-mobile-list__card--selected {
  border-color: #98b4d3;
  box-shadow: 0 16px 36px rgba(31, 79, 135, 0.16);
}

.retouche-mobile-list__footer {
  display: grid;
  gap: 10px;
}

.retouche-mobile-list__action {
  width: 100%;
}
</style>
