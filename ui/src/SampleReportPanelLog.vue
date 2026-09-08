<script setup lang="ts">
import type { SimpleOption } from "@platforma-sdk/ui-vue";
import { PlBtnGroup, PlLogView } from "@platforma-sdk/ui-vue";
import { computed, ref, watch } from "vue";
import { useApp } from "./app";

const props = defineProps<{ sampleId: string }>();
const { model } = useApp();

// One log per mitool command. The ordinal prefix orders the picker.
const STEP_LABELS: Record<string, string> = {
  "1-parse": "Parse",
  "2-refine-tags": "Refine tags",
  "3-sort": "Sort",
  "4-consensus": "Consensus",
  "5-analyze": "Analysis",
};

const steps = computed(() =>
  (model.outputs.stepLogs?.data ?? [])
    .filter((e) => String(e.key[0]) === props.sampleId && e.value !== undefined)
    .map((e) => String(e.key[1]))
    .sort(),
);

const tabOptions = computed<SimpleOption<string>[]>(() =>
  steps.value.map((s) => ({ value: s, text: STEP_LABELS[s] ?? s })),
);

const currentStep = ref<string | undefined>(undefined);
watch(
  steps,
  (list) => {
    if (list.length > 0 && (!currentStep.value || !list.includes(currentStep.value)))
      currentStep.value = list[list.length - 1];
  },
  { immediate: true },
);

const logHandle = computed(
  () =>
    model.outputs.stepLogs?.data.find(
      (e) => String(e.key[0]) === props.sampleId && String(e.key[1]) === currentStep.value,
    )?.value,
);
</script>

<template>
  <PlBtnGroup v-if="tabOptions.length > 1" v-model="currentStep" :options="tabOptions" />
  <PlLogView
    v-if="logHandle"
    :log-handle="logHandle"
    :label="currentStep ? (STEP_LABELS[currentStep] ?? currentStep) : 'Log'"
  />
  <div v-else>No log available for this sample yet.</div>
</template>

<style lang="css">
.pl-log-view {
  max-height: calc(100% - var(--contour-offset));
  max-width: calc(100% - var(--contour-offset));
}
</style>
