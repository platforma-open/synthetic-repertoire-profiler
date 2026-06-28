<script setup lang="ts">
import { PlChartStackedBar, ReactiveFileContent } from "@platforma-sdk/ui-vue";
import { computed } from "vue";
import type { AlignReport } from "./alignmentChartSettings";
import { useAlignmentChartSettings } from "./alignmentChartSettings";
import type { AssignReport } from "./assignmentChartSettings";
import { useAssignmentChartSettings } from "./assignmentChartSettings";
import { useApp } from "./app";

const props = defineProps<{ sampleId: string }>();
const { model } = useApp();
const reactiveFileContent = ReactiveFileContent.useGlobal();

const reportHandle = (step: string, format: "json" | "txt") =>
  model.outputs.reports?.data?.find(
    (d) => String(d.key[0]) === props.sampleId && d.key[1] === step && d.key[2] === format,
  )?.value?.handle;

const alignReport = computed(() => {
  const h = reportHandle("align", "json");
  return h ? (reactiveFileContent.getContentJson(h)?.value as AlignReport | undefined) : undefined;
});
// Assignment ran only when a known set was supplied → the assign report is
// absent otherwise, and the Assignment chart is hidden.
const assignReport = computed(() => {
  const h = reportHandle("assign", "json");
  return h ? (reactiveFileContent.getContentJson(h)?.value as AssignReport | undefined) : undefined;
});

const alignmentSettings = useAlignmentChartSettings(alignReport);
const assignmentSettings = useAssignmentChartSettings(assignReport);
</script>

<template>
  <PlChartStackedBar :settings="alignmentSettings" />
  <PlChartStackedBar v-if="assignReport !== undefined" :settings="assignmentSettings" />
</template>
