<script setup lang="ts">
import type { PredefinedGraphOption } from "@milaboratories/graph-maker";
import { GraphMaker } from "@milaboratories/graph-maker";
import type { PColumnSpec } from "@platforma-sdk/model";
import { computed } from "vue";
import { useApp } from "./app";

const app = useApp();

const MUTATION_COUNT_AXIS = "pl7.app/repertoire/mutationCount";
const SAMPLE_ID_AXIS = "pl7.app/sampleId";
const ALPHABET_DOMAIN = "pl7.app/alphabet";

const alphabetOf = (spec: PColumnSpec) =>
  spec.axesSpec.find((a) => a.name === MUTATION_COUNT_AXIS)?.domain?.[ALPHABET_DOMAIN];

// Deliberately not GraphMaker's `histogram` chart type: that bins a raw column and
// counts rows, which cannot be split per sample. The counts are pre-aggregated in
// the workflow instead and the bar layer renders them.
//
// aa is preferred because nt columns exist only when nucleotide export is on.
const defaultOptions = computed((): PredefinedGraphOption<"discrete">[] | undefined => {
  const pCols = app.model.outputs.mutationHistogramPCols;
  if (!pCols || pCols.length === 0) return undefined;

  const level = pCols.some((c) => alphabetOf(c.spec) === "aminoacid") ? "aminoacid" : "nucleotide";
  const variantCount = pCols.find(
    (c) => c.spec.name === "pl7.app/repertoire/variantCount" && alphabetOf(c.spec) === level,
  );
  if (!variantCount) return undefined;

  const axes = variantCount.spec.axesSpec;
  const mutationCountAxis = axes.find((a) => a.name === MUTATION_COUNT_AXIS);
  const sampleAxis = axes.find((a) => a.name === SAMPLE_ID_AXIS);
  if (!mutationCountAxis) return undefined;

  const options: PredefinedGraphOption<"discrete">[] = [
    { inputName: "y", selectedSource: variantCount.spec },
    { inputName: "primaryGrouping", selectedSource: mutationCountAxis },
  ];
  // Faceting consumes the sample dimension, which is what keeps each bar exact:
  // one row per mutation count per panel, so `height: "max"` is the value itself.
  if (sampleAxis) options.push({ inputName: "facetBy", selectedSource: sampleAxis });
  return options;
});
</script>

<template>
  <GraphMaker
    v-model="app.model.data.graphStateMutationHistogram"
    chart-type="discrete"
    :p-frame="app.model.outputs.mutationHistogramPf"
    :default-options="defaultOptions"
    :status-text="{
      noPframe: { title: 'Run the block on the Main tab to see the plot.' },
    }"
  />
</template>
