<script setup>
defineProps({
  mobile: {
    type: Boolean,
    default: false
  }
});
</script>

<template>
  <div class="responsive-data-container" :data-mode="mobile ? 'mobile' : 'desktop'">
    <template v-if="mobile">
      <slot name="mobile" :is-mobile="true" mode="mobile">
        <slot :is-mobile="true" mode="mobile" />
      </slot>
    </template>
    <template v-else>
      <slot name="desktop" :is-mobile="false" mode="desktop">
        <slot :is-mobile="false" mode="desktop" />
      </slot>
    </template>
  </div>
</template>

<style scoped>
.responsive-data-container {
  display: block;
  min-width: 0;
}
</style>
