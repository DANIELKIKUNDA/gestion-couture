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
  ensureInput: {
    type: Function,
    required: true
  },
  canManageStockAdjustments: {
    type: Boolean,
    default: false
  },
  canManageStockPurchases: {
    type: Boolean,
    default: false
  },
  canManageStockArticles: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["adjust", "buy", "edit"]);

function toneFor(article) {
  if (article?.actif === false) return "default";
  if (Number(article?.quantiteDisponible || 0) <= Number(article?.seuilAlerte || 0)) return "warning";
  return "success";
}

function statusLabel(article) {
  if (article?.actif === false) return "INACTIF";
  if (Number(article?.quantiteDisponible || 0) <= Number(article?.seuilAlerte || 0)) return "STOCK FAIBLE";
  return "OK";
}

function statusTone(article) {
  if (article?.actif === false) return "slate";
  return Number(article?.quantiteDisponible || 0) <= Number(article?.seuilAlerte || 0) ? "due" : "ok";
}

function subtitleFor(article) {
  const category = String(article?.categorieArticle || "").trim();
  const unit = String(article?.uniteStock || "").trim();
  return [category, unit].filter(Boolean).join(" · ") || "Article de stock";
}

function metaItemsFor(article) {
  return [
    {
      key: "quantite",
      label: "Quantite",
      value: article?.quantiteDisponible ?? 0,
      emphasis: true,
      tone: Number(article?.quantiteDisponible || 0) <= Number(article?.seuilAlerte || 0) ? "warning" : "success"
    },
    {
      key: "achat",
      label: "Prix achat",
      value: props.formatCurrency(article?.prixAchatMoyen)
    },
    {
      key: "vente",
      label: "Prix vente",
      value: props.formatCurrency(article?.prixVenteUnitaire)
    },
    {
      key: "seuil",
      label: "Seuil",
      value: article?.seuilAlerte ?? 0
    }
  ];
}

function inputFor(article) {
  return props.ensureInput(article?.idArticle);
}
</script>

<template>
  <div class="stock-article-mobile-list">
    <MobileEntityCard
      v-for="article in items"
      :key="article.idArticle"
      :eyebrow="`Article #${article.idArticle}`"
      :title="article.nomArticle || 'Article non renseigne'"
      :subtitle="subtitleFor(article)"
      :tone="toneFor(article)"
    >
      <template #badge>
        <span class="status-pill" :data-tone="statusTone(article)">
          {{ statusLabel(article) }}
        </span>
      </template>

      <template #meta>
        <MobileMetaList :items="metaItemsFor(article)" />
      </template>

      <template #footer>
        <div class="stock-article-mobile-list__footer">
          <div
            v-if="canManageStockAdjustments || canManageStockPurchases || canManageStockArticles"
            class="stock-article-mobile-list__actions"
          >
            <div v-if="canManageStockAdjustments" class="stock-article-mobile-list__adjust">
              <input
                v-model="inputFor(article).quantite"
                class="inline-input"
                type="number"
                min="0"
                placeholder="Quantite"
              />
              <input
                v-model="inputFor(article).motif"
                class="inline-input"
                type="text"
                placeholder="Motif entree simple"
              />
              <button type="button" class="action-btn blue" @click="emit('adjust', article)">Entrer</button>
            </div>

            <div class="stock-article-mobile-list__secondary">
              <button v-if="canManageStockPurchases" type="button" class="mini-btn" @click="emit('buy', article)">Acheter</button>
              <button v-if="canManageStockArticles" type="button" class="mini-btn" @click="emit('edit', article)">Modifier</button>
            </div>
          </div>

          <p v-else class="helper">Lecture seule</p>
        </div>
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.stock-article-mobile-list {
  display: grid;
  gap: 12px;
}

.stock-article-mobile-list__footer,
.stock-article-mobile-list__actions,
.stock-article-mobile-list__adjust {
  display: grid;
  gap: 10px;
}

.stock-article-mobile-list__secondary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stock-article-mobile-list__secondary > * {
  flex: 1 1 0;
}
</style>
