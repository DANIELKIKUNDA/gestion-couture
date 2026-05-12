<script setup>
const props = defineProps({
  title: {
    type: String,
    default: "Chargement"
  },
  description: {
    type: String,
    default: ""
  },
  blocks: {
    type: Number,
    default: 3
  }
});

const safeBlocks = Math.max(1, Math.min(6, Number(props.blocks || 3)));
</script>

<template>
  <div class="mobile-state-loading" role="status" aria-live="polite" aria-busy="true">
    <div class="mobile-state-loading__copy">
      <strong>{{ title }}</strong>
      <p v-if="description">{{ description }}</p>
    </div>

    <div class="mobile-state-loading__stack">
      <div v-for="item in safeBlocks" :key="item" class="mobile-state-loading__block" aria-hidden="true">
        <span class="mobile-state-loading__line mobile-state-loading__line--title"></span>
        <span class="mobile-state-loading__line"></span>
        <span class="mobile-state-loading__line mobile-state-loading__line--short"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-state-loading {
  display: grid;
  gap: 14px;
  padding: 2px;
}

.mobile-state-loading__copy {
  display: grid;
  gap: 4px;
}

.mobile-state-loading__copy strong {
  color: #102a43;
  font-size: 16px;
  line-height: 1.25;
}

.mobile-state-loading__copy p {
  margin: 0;
  color: #5d718a;
  font-size: 13px;
}

.mobile-state-loading__stack {
  display: grid;
  gap: 10px;
}

.mobile-state-loading__block {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid rgba(31, 90, 162, 0.1);
  border-radius: 20px;
  background:
    radial-gradient(circle at top right, rgba(31, 90, 162, 0.06), transparent 42%),
    linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 12px 28px rgba(31, 90, 162, 0.07);
}

.mobile-state-loading__line {
  display: block;
  height: 11px;
  border-radius: 999px;
  background: linear-gradient(90deg, #e3edf8 25%, #f8fbff 37%, #e3edf8 63%);
  background-size: 400% 100%;
  animation: mobile-loading-pulse 1.6s ease-in-out infinite;
}

.mobile-state-loading__line--title {
  width: 60%;
  height: 12px;
}

.mobile-state-loading__line--short {
  width: 42%;
}

@keyframes mobile-loading-pulse {
  0% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0 50%;
  }
}
</style>
