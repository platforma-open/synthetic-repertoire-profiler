<script setup lang="ts">
import { PlAgDataTableV2, PlBlockPage, usePlDataTableSettingsV2 } from "@platforma-sdk/ui-vue";
import { useApp } from "./app";

const app = useApp();

const tableSettings = usePlDataTableSettingsV2({
  model: () => app.model.outputs.qcTable,
});
</script>

<template>
  <PlBlockPage>
    <template #title>QC Report</template>
    <PlAgDataTableV2
      v-model="app.model.data.qcTableState"
      :settings="tableSettings"
      show-columns-panel
      show-export-button
      not-ready-text="Run the analysis to see QC metrics"
    />
  </PlBlockPage>
</template>
