<script setup lang="ts">
import type { SimpleOption } from "@platforma-sdk/ui-vue";
import { PlBtnGroup, PlContainer, PlTextArea, ReactiveFileContent } from "@platforma-sdk/ui-vue";
import { computed, ref, watch } from "vue";
import { useApp } from "./app";

const props = defineProps<{ sampleId: string }>();
const { model } = useApp();
const reactiveFileContent = ReactiveFileContent.useGlobal();

const STEP_LABELS: Record<string, string> = {
  align: "Align",
  assemble: "Assemble",
  "call-mutations": "Call mutations",
  assign: "Assign",
};
const STEP_ORDER = ["align", "assemble", "call-mutations", "assign"];

// Steps present for this sample (assign only when a known set was used), in
// pipeline order.
const availableSteps = computed(() => {
  const steps = new Set<string>();
  for (const d of model.outputs.reports?.data ?? []) {
    if (String(d.key[0]) === props.sampleId && d.key[2] === "txt") steps.add(String(d.key[1]));
  }
  return STEP_ORDER.filter((s) => steps.has(s));
});

const tabOptions = computed<SimpleOption<string>[]>(() =>
  availableSteps.value.map((s) => ({ value: s, text: STEP_LABELS[s] ?? s })),
);

const currentStep = ref<string>("align");
watch(
  availableSteps,
  (steps) => {
    if (steps.length > 0 && !steps.includes(currentStep.value)) currentStep.value = steps[0];
  },
  { immediate: true },
);

const reportContent = computed(() => {
  const handle = model.outputs.reports?.data?.find(
    (d) =>
      String(d.key[0]) === props.sampleId && d.key[1] === currentStep.value && d.key[2] === "txt",
  )?.value?.handle;
  return handle ? reactiveFileContent.getContentString(handle)?.value : undefined;
});
</script>

<template>
  <PlContainer>
    <PlBtnGroup v-model="currentStep" :options="tabOptions" />
    <PlTextArea :model-value="reportContent" :rows="30" readonly />
  </PlContainer>
</template>
