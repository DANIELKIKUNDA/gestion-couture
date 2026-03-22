<script setup>
defineProps({
  compact: {
    type: Boolean,
    default: false
  },
  hasAction: {
    type: Boolean,
    default: false
  }
});
</script>

<template>
  <section class="mobile-page-layout" :class="{ 'mobile-page-layout--compact': compact, 'mobile-page-layout--has-action': hasAction }">
    <div v-if="$slots.header" class="mobile-page-layout__header">
      <slot name="header" />
    </div>

    <div v-if="$slots.context" class="mobile-page-layout__context">
      <slot name="context" />
    </div>

    <div class="mobile-page-layout__content">
      <slot />
    </div>

    <div v-if="$slots.footer" class="mobile-page-layout__footer">
      <slot name="footer" />
    </div>

    <div v-if="$slots.action && hasAction" class="mobile-page-layout__action">
      <slot name="action" />
    </div>
  </section>
</template>

<style scoped>
.mobile-page-layout {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.mobile-page-layout__header,
.mobile-page-layout__context,
.mobile-page-layout__content,
.mobile-page-layout__footer {
  min-width: 0;
}

.mobile-page-layout__content {
  display: grid;
  gap: 12px;
}

@media (max-width: 767px) {
  .mobile-page-layout {
    gap: 10px;
  }

  .mobile-page-layout__content {
    gap: 10px;
  }

  .mobile-page-layout--compact {
    gap: 8px;
  }

  .mobile-page-layout--compact .mobile-page-layout__content {
    gap: 8px;
  }

  .mobile-page-layout--has-action {
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
  }
}
</style>
