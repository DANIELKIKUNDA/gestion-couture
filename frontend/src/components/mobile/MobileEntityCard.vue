<script setup>
defineProps({
  eyebrow: {
    type: String,
    default: ""
  },
  title: {
    type: String,
    default: ""
  },
  subtitle: {
    type: String,
    default: ""
  },
  tone: {
    type: String,
    default: "default"
  }
});
</script>

<template>
  <article class="mobile-entity-card" :class="`mobile-entity-card--${tone}`">
    <div v-if="$slots.media" class="mobile-entity-card__media">
      <slot name="media" />
    </div>

    <div class="mobile-entity-card__body">
      <div v-if="eyebrow || title || subtitle || $slots.badge" class="mobile-entity-card__head">
        <div class="mobile-entity-card__copy">
          <p v-if="eyebrow" class="mobile-entity-card__eyebrow">{{ eyebrow }}</p>
          <h4 v-if="title" class="mobile-entity-card__title">{{ title }}</h4>
          <p v-if="subtitle" class="mobile-entity-card__subtitle">{{ subtitle }}</p>
        </div>

        <div v-if="$slots.badge" class="mobile-entity-card__badge">
          <slot name="badge" />
        </div>
      </div>

      <div v-if="$slots.default" class="mobile-entity-card__main">
        <slot />
      </div>

      <div v-if="$slots.meta" class="mobile-entity-card__meta">
        <slot name="meta" />
      </div>

      <div v-if="$slots.footer" class="mobile-entity-card__footer">
        <slot name="footer" />
      </div>
    </div>
  </article>
</template>

<style scoped>
.mobile-entity-card {
  display: grid;
  gap: 12px;
  border: 1px solid #dbe4ee;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  box-shadow: 0 12px 30px rgba(22, 47, 78, 0.08);
  overflow: hidden;
}

.mobile-entity-card__media {
  border-bottom: 1px solid #ebf1f7;
}

.mobile-entity-card__body {
  display: grid;
  gap: 12px;
  padding: 14px;
  min-width: 0;
}

.mobile-entity-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.mobile-entity-card__copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.mobile-entity-card__eyebrow {
  margin: 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: #6d86a0;
}

.mobile-entity-card__title {
  margin: 0;
  font-size: 17px;
  line-height: 1.2;
  color: #16324d;
}

.mobile-entity-card__subtitle {
  margin: 0;
  color: #5a7391;
  font-size: 13px;
  line-height: 1.4;
}

.mobile-entity-card__badge {
  flex-shrink: 0;
}

.mobile-entity-card__main,
.mobile-entity-card__meta,
.mobile-entity-card__footer {
  min-width: 0;
}

.mobile-entity-card__footer {
  padding-top: 10px;
  border-top: 1px solid #ebf1f7;
}

.mobile-entity-card--info {
  border-color: #cfe0f3;
  background: linear-gradient(180deg, #ffffff 0%, #f6fbff 100%);
}

.mobile-entity-card--success {
  border-color: #d6eadf;
  background: linear-gradient(180deg, #ffffff 0%, #f7fcf9 100%);
}

.mobile-entity-card--warning {
  border-color: #ecd8c7;
  background: linear-gradient(180deg, #ffffff 0%, #fffaf5 100%);
}
</style>
