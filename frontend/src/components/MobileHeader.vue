<script setup>
defineProps({
  title: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["toggle-menu"]);
</script>

<template>
  <header class="mobile-header">
    <button class="mobile-header-menu" type="button" aria-label="Ouvrir le menu" @click="emit('toggle-menu')">
      <span aria-hidden="true">☰</span>
    </button>
    <div class="mobile-header-copy">
      <p class="mobile-header-kicker">AtelierPro</p>
      <h2>{{ title }}</h2>
    </div>
  </header>
</template>
