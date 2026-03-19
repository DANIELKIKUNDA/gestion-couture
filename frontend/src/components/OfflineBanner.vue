<script setup>
import { useNetwork } from "../services/network-service.js";

const { isOffline } = useNetwork();
</script>

<template>
  <div v-if="isOffline" class="offline-banner" role="status" aria-live="polite">
    ⚠️ Mode hors ligne — certaines données peuvent être limitées.
  </div>
</template>

<style scoped>
.offline-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1100;
  padding: 10px 16px;
  background: #fff3cd;
  border-bottom: 1px solid #e4c366;
  color: #7a4f01;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  pointer-events: none;
  box-shadow: 0 6px 18px rgba(122, 79, 1, 0.12);
}
</style>
