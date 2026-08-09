<script setup>
const props = defineProps({
  summary: {
    type: Object,
    required: true
  },
  formatCurrency: {
    type: Function,
    required: true
  }
});
</script>

<template>
  <section class="stock-financial-summary" aria-label="Valorisation financiere du stock">
    <article class="stock-financial-summary__card">
      <span class="stock-financial-summary__label">Valeur actuelle au cout d'achat</span>
      <strong>{{ props.formatCurrency(props.summary.purchaseValue) }}</strong>
      <small>Valeur comptable estimee des quantites actuellement en stock.</small>
    </article>

    <article class="stock-financial-summary__card">
      <span class="stock-financial-summary__label">Valeur de vente potentielle</span>
      <strong>{{ props.formatCurrency(props.summary.potentialSaleValue) }}</strong>
      <small>Montant theorique si tout le stock actuel est vendu aux prix enregistres.</small>
    </article>

    <article class="stock-financial-summary__card">
      <span class="stock-financial-summary__label">Benefice brut potentiel</span>
      <strong>{{ props.formatCurrency(props.summary.potentialGrossProfit) }}</strong>
      <small>Projection non realisee : valeur de vente potentielle moins cout d'achat du stock.</small>
    </article>
    <p class="stock-financial-summary__note">
      Ces montants decrivent la valeur du stock. Ils ne correspondent ni au solde de caisse ni a un benefice deja realise.
    </p>
    <p
      v-if="props.summary.articlesWithoutPurchaseCost > 0 || props.summary.articlesWithoutSalePrice > 0"
      class="stock-financial-summary__warning"
      role="status"
    >
      Valorisation a verifier :
      <span v-if="props.summary.articlesWithoutPurchaseCost > 0">{{ props.summary.articlesWithoutPurchaseCost }} article(s) avec stock sans cout d'achat renseigne.</span>
      <span v-if="props.summary.articlesWithoutSalePrice > 0">{{ props.summary.articlesWithoutSalePrice }} article(s) avec stock sans prix de vente renseigne.</span>
    </p>
  </section>
</template>

<style scoped>
.stock-financial-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stock-financial-summary__card {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border, #dbe4ee);
  border-radius: 14px;
  background: var(--panel, #fff);
}

.stock-financial-summary__label {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.stock-financial-summary__card strong {
  font-size: clamp(1.1rem, 2vw, 1.55rem);
  line-height: 1.15;
}

.stock-financial-summary__card small {
  line-height: 1.35;
  opacity: 0.75;
}

.stock-financial-summary__note,
.stock-financial-summary__warning {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.84rem;
}

.stock-financial-summary__note {
  opacity: 0.78;
}

.stock-financial-summary__warning {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  padding: 10px 12px;
  border: 1px solid #e5c07b;
  border-radius: 10px;
  background: #fff9e8;
}

@media (max-width: 800px) {
  .stock-financial-summary {
    grid-template-columns: 1fr;
  }
}
</style>
