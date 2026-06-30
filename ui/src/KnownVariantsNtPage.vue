<script setup lang="ts">
import { PlAgDataTableV2, PlBlockPage, usePlDataTableSettingsV2 } from "@platforma-sdk/ui-vue";
import { useApp } from "./app";

const app = useApp();

const tableSettings = usePlDataTableSettingsV2({
  model: () => app.model.outputs.knownVariantsNtTable,
});
</script>

<template>
  <PlBlockPage>
    <template #title>Known Variants (NT)</template>
    <PlAgDataTableV2
      v-model="app.model.data.knownVariantsNtTableState"
      :settings="tableSettings"
      show-columns-panel
      show-export-button
      not-ready-text="Supply a nucleotide known-variant set and run the analysis"
    />
  </PlBlockPage>
</template>
