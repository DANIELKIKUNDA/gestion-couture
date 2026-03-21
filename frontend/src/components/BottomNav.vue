<script setup>
const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  currentRoute: {
    type: String,
    default: ""
  },
  iconPaths: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(["navigate"]);

function isActiveItem(item) {
  const activeRoutes = Array.isArray(item.activeRoutes) ? item.activeRoutes : [item.target];
  return activeRoutes.includes(props.currentRoute);
}
</script>

<template>
  <nav class="bottom-nav" aria-label="Navigation mobile principale">
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      class="bottom-nav-item"
      :class="{ active: isActiveItem(item) }"
      @click="emit('navigate', item.target)"
    >
      <svg class="icon bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path v-for="(path, i) in iconPaths[item.icon]" :key="`${item.id}-${i}`" :d="path" />
      </svg>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>
