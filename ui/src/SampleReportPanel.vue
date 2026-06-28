<script setup lang="ts">
import type { SimpleOption } from "@platforma-sdk/ui-vue";
import { PlBtnGroup } from "@platforma-sdk/ui-vue";
import { ref } from "vue";
import SampleReportPanelLog from "./SampleReportPanelLog.vue";
import SampleReportPanelReports from "./SampleReportPanelReports.vue";
import SampleReportPanelVisualReport from "./SampleReportPanelVisualReport.vue";

const props = defineProps<{ sampleId: string | undefined }>();

type TabId = "visualReport" | "reports" | "logs";
const currentTab = ref<TabId>("visualReport");
const tabOptions: SimpleOption<TabId>[] = [
  { value: "visualReport", text: "Visual Report" },
  { value: "reports", text: "Reports" },
  { value: "logs", text: "Log" },
];
</script>

<template>
  <PlBtnGroup v-model="currentTab" :options="tabOptions" />
  <div v-if="props.sampleId !== undefined" class="pl-scrollable">
    <SampleReportPanelVisualReport
      v-if="currentTab === 'visualReport'"
      :sample-id="props.sampleId"
    />
    <SampleReportPanelReports v-else-if="currentTab === 'reports'" :sample-id="props.sampleId" />
    <SampleReportPanelLog v-else-if="currentTab === 'logs'" :sample-id="props.sampleId" />
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
