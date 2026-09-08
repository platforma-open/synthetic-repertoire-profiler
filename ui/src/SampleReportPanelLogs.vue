<script setup lang="ts">
import type { SimpleOption } from "@platforma-sdk/ui-vue";
import { PlBtnGroup, PlContainer, PlLogView } from "@platforma-sdk/ui-vue";
import { computed, ref, watch } from "vue";
import { useApp } from "./app";

const props = defineProps<{ sampleId: string }>();
const { model } = useApp();

/** One entry per mitool command, in pipeline order. */
const PIPELINE: { id: string; label: string }[] = [
  { id: "1-parse", label: "Parse" },
  { id: "2-refine-tags", label: "Refine tags" },
  { id: "3-sort", label: "Sort" },
  { id: "4-consensus", label: "Consensus" },
  { id: "5-analyze", label: "Analysis" },
];

const logs = computed(() =>
  (model.outputs.stepLogs?.data ?? []).filter(
    (e) => String(e.key[0]) === props.sampleId && e.value !== undefined,
  ),
);

// A step appears once its log exists, so the list grows with the run and never names a
// step this run does not have.
const steps = computed(() => {
  const present = new Set(logs.value.map((e) => String(e.key[1])));
  return PIPELINE.filter((s) => present.has(s.id));
});

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
  () => logs.value.find((e) => String(e.key[1]) === currentStep.value)?.value,
);
</script>

<template>
  <PlContainer>
    <PlBtnGroup v-if="tabOptions.length > 1" v-model="currentStep" :options="tabOptions" />
    <PlLogView v-if="logHandle" :log-handle="logHandle" :label="current?.label ?? 'Log'" />
    <div v-else>No log available for this sample yet.</div>
  </PlContainer>
</template>

<style lang="css">
.pl-log-view {
  max-height: calc(100% - var(--contour-offset));
  max-width: calc(100% - var(--contour-offset));
}
</style>
