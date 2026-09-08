<script setup lang="ts">
import type { SimpleOption } from "@platforma-sdk/ui-vue";
import {
  PlBtnGroup,
  PlContainer,
  PlLogView,
  PlSectionSeparator,
  PlTextArea,
  ReactiveFileContent,
} from "@platforma-sdk/ui-vue";
import { computed, ref, watch } from "vue";
import { useApp } from "./app";

const props = defineProps<{ sampleId: string }>();
const { model } = useApp();
const reactiveFileContent = ReactiveFileContent.useGlobal();

/**
 * One entry per mitool command, in pipeline order. `analyze` is a single command that
 * runs several stages internally, so it has one log and one report per stage.
 */
const PIPELINE = [
  { id: "1-parse", label: "Parse", reports: [] as string[] },
  { id: "2-refine-tags", label: "Refine tags", reports: ["refine-tags"] },
  { id: "3-sort", label: "Sort", reports: [] as string[] },
  { id: "4-consensus", label: "Consensus", reports: ["consensus"] },
  {
    id: "5-analyze",
    label: "Analysis",
    reports: ["align", "assemble", "call-mutations", "assign"],
  },
];

const REPORT_LABELS: Record<string, string> = {
  align: "Align",
  assemble: "Assemble",
  "call-mutations": "Call mutations",
  assign: "Assign",
};

const forSample = <T,>(entries: { key: (string | number)[]; value?: T }[] | undefined) =>
  (entries ?? []).filter((e) => String(e.key[0]) === props.sampleId && e.value !== undefined);

const logSteps = computed(
  () => new Set(forSample(model.outputs.stepLogs?.data).map((e) => String(e.key[1]))),
);

const reportSteps = computed(
  () =>
    new Set(
      forSample(model.outputs.reports?.data)
        .filter((e) => e.key[2] === "txt")
        .map((e) => String(e.key[1])),
    ),
);

// A step appears once it has a log or a report — so the list grows with the run and
// never lists a step this run does not have.
const steps = computed(() =>
  PIPELINE.filter(
    (s) => logSteps.value.has(s.id) || s.reports.some((r) => reportSteps.value.has(r)),
  ),
);

const tabOptions = computed<SimpleOption<string>[]>(() =>
  steps.value.map((s) => ({ value: s.id, text: s.label })),
);

const currentStep = ref<string | undefined>(undefined);
watch(
  steps,
  (list) => {
    if (list.length > 0 && !list.some((s) => s.id === currentStep.value))
      currentStep.value = list[list.length - 1].id;
  },
  { immediate: true },
);

const current = computed(() => steps.value.find((s) => s.id === currentStep.value));

const logHandle = computed(
  () =>
    forSample(model.outputs.stepLogs?.data).find((e) => String(e.key[1]) === currentStep.value)
      ?.value,
);

/** The report sections this step produced, each with its text. */
const reports = computed(() =>
  (current.value?.reports ?? [])
    .filter((r) => reportSteps.value.has(r))
    .map((r) => {
      const handle = forSample(model.outputs.reports?.data).find(
        (e) => String(e.key[1]) === r && e.key[2] === "txt",
      )?.value?.handle;
      return {
        id: r,
        label: REPORT_LABELS[r] ?? r,
        text: handle ? reactiveFileContent.getContentString(handle)?.value : undefined,
      };
    }),
);
</script>

<template>
  <PlContainer>
    <PlBtnGroup v-if="tabOptions.length > 0" v-model="currentStep" :options="tabOptions" />

    <template v-for="r in reports" :key="r.id">
      <!-- Only labelled when a step has more than one report section. -->
      <PlSectionSeparator v-if="reports.length > 1">{{ r.label }}</PlSectionSeparator>
      <PlTextArea :model-value="r.text" :rows="reports.length > 1 ? 14 : 24" readonly />
    </template>

    <PlSectionSeparator v-if="logHandle && reports.length > 0">Log</PlSectionSeparator>
    <PlLogView v-if="logHandle" :log-handle="logHandle" :label="current?.label ?? 'Log'" />

    <div v-if="tabOptions.length === 0">Nothing to show for this sample yet.</div>
    <div v-else-if="!logHandle && reports.length === 0">No output for this step yet.</div>
  </PlContainer>
</template>

<style lang="css">
.pl-log-view {
  max-height: calc(100% - var(--contour-offset));
  max-width: calc(100% - var(--contour-offset));
}
</style>
