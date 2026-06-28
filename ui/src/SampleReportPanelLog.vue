<script setup lang="ts">
import { PlLogView } from "@platforma-sdk/ui-vue";
import { computed } from "vue";
import { useApp } from "./app";

const props = defineProps<{ sampleId: string }>();
const { model } = useApp();

// The per-sample analyze log (parse → align → assemble → call-mutations →
// [assign] output + progress markers).
const logHandle = computed(
  () => model.outputs.logs?.data.find((e) => String(e.key[0]) === props.sampleId)?.value,
);
</script>

<template>
  <PlLogView v-if="logHandle" :log-handle="logHandle" label="Analysis log" />
  <div v-else>No log available for this sample yet.</div>
</template>

<style lang="css">
.pl-log-view {
  max-height: calc(100% - var(--contour-offset));
  max-width: calc(100% - var(--contour-offset));
}
</style>
