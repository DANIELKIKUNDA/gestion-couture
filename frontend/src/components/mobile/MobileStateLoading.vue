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
  gap: 12px;
}

.mobile-state-loading__copy {
  display: grid;
  gap: 4px;
}

.mobile-state-loading__copy strong {
  color: #17324d;
  font-size: 15px;
}

.mobile-state-loading__copy p {
  margin: 0;
  color: #5a7391;
  font-size: 13px;
}

.mobile-state-loading__stack {
  display: grid;
  gap: 10px;
}

.mobile-state-loading__block {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid #e6edf5;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
}

.mobile-state-loading__line {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, #e9f0f7 25%, #f5f8fc 37%, #e9f0f7 63%);
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
