<template>
  <div class="client-picker">
    <label>
      <span>Client</span>
      <input
        :value="modelValue"
        type="text"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', $event.target.value)"
      />
    </label>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: ""
  },
  placeholder: {
    type: String,
    default: "Rechercher un client"
  }
});

defineEmits(["update:modelValue"]);
</script>

<style scoped>
.client-picker label {
  display: grid;
  gap: 0.35rem;
}

.client-picker input {
  border: 1px solid #c9d0d8;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
}
</style>
