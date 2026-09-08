<script setup lang="ts">
import type { SimpleOption } from "@platforma-sdk/ui-vue";
import { PlBtnGroup } from "@platforma-sdk/ui-vue";
import { ref } from "vue";
import SampleReportPanelSteps from "./SampleReportPanelSteps.vue";
import SampleReportPanelVisualReport from "./SampleReportPanelVisualReport.vue";

const props = defineProps<{ sampleId: string | undefined }>();

type TabId = "visualReport" | "logs";
const currentTab = ref<TabId>("visualReport");
const tabOptions: SimpleOption<TabId>[] = [
  { value: "visualReport", text: "Visual Report" },
  { value: "logs", text: "Logs" },
];
</script>

<template>
  <PlBtnGroup v-model="currentTab" :options="tabOptions" />
  <div v-if="props.sampleId !== undefined" class="pl-scrollable">
    <SampleReportPanelVisualReport
      v-if="currentTab === 'visualReport'"
      :sample-id="props.sampleId"
    />
    <SampleReportPanelSteps v-else-if="currentTab === 'logs'" :sample-id="props.sampleId" />
  </div>
  <div v-else>No sample selected</div>
</template>

<style lang="css" scoped>
.pl-scrollable {
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: 100%;
  max-height: 100%;
  max-width: 100%;
  padding: 0 6px;
  margin: 0 -6px;
}
</style>
