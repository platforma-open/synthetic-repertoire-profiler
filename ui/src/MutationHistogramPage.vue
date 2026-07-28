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

/** Level of a mutation-bin column, read off its mutation-count axis. */
const alphabetOf = (spec: PColumnSpec) =>
  spec.axesSpec.find((a) => a.name === MUTATION_COUNT_AXIS)?.domain?.[ALPHABET_DOMAIN];

// Bar chart: X = mutation count, height = number of distinct variants carrying
// that many mutations, one panel per sample. A histogram in substance, but NOT
// GraphMaker's `histogram` chart type — that one bins a raw per-item column and
// counts rows (what the sibling "Cluster Size Histogram" pages do), which cannot
// be split per sample and has a fixed bin count. Here the counts come
// pre-aggregated from the workflow as [sampleId, mutationCount] -> variantCount,
// and the bar layer renders them.
//
// Faceting by sample is a default, not a constraint: the value can be switched to
// reads, the facet moved to a sample-group metadata column, and the layer changed
// to box/violin for the across-sample spread at each mutation count.
//
// The aa level is always present; nt columns exist only when nucleotide export is
// on, so aa is preferred and nt is the fallback.
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
  // One panel per sample. Faceting also consumes the sample dimension, which is
  // what keeps each bar exact: per panel there is exactly one row per mutation
  // count, so the bar layer's `height: "max"` is the value itself.
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
