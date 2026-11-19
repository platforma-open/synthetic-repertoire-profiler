<script setup lang="ts">
import type { PredefinedGraphOption } from "@milaboratories/graph-maker";
import { GraphMaker } from "@milaboratories/graph-maker";
import type { StateHeatmapTab } from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";
import {
  DEFAULT_STATE_HEATMAP_GRAPH_STATE,
  DEFAULT_STATE_HEATMAP_PER_SAMPLE_GRAPH_STATE,
} from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";
import type { PColumnIdAndSpec, PColumnSpec } from "@platforma-sdk/model";
import { PlTabs } from "@platforma-sdk/ui-vue";
import { computed } from "vue";
import { useApp } from "./app";

const app = useApp();

// GraphMaker reads its state eagerly, so guarantee a non-undefined object. A project created
// before this field reached `.init()` has it undefined until the v14 migration backfills it; the
// fallback keeps the page rendering meanwhile.
const graphState = computed({
  get: () => app.model.data.graphStateStateHeatmap ?? { ...DEFAULT_STATE_HEATMAP_GRAPH_STATE },
  set: (v) => {
    app.model.data.graphStateStateHeatmap = v;
  },
});
// Undefined until the v15 migration has run on an older project.
const perSampleGraphState = computed({
  get: () =>
    app.model.data.graphStateStateHeatmapPerSample ?? {
      ...DEFAULT_STATE_HEATMAP_PER_SAMPLE_GRAPH_STATE,
    },
  set: (v) => {
    app.model.data.graphStateStateHeatmapPerSample = v;
  },
});

const TABS = [
  { label: "All samples", value: "pooled" },
  { label: "Per sample", value: "perSample" },
] as const satisfies readonly { label: string; value: StateHeatmapTab }[];

const tab = computed({
  get: () => app.model.data.stateHeatmapTab ?? "pooled",
  set: (value: StateHeatmapTab) => (app.model.data.stateHeatmapTab = value),
});

const PARENT_ID_AXIS = "pl7.app/repertoire/parentId";
const POSITION_AXIS = "pl7.app/repertoire/position";
const STATE_AXIS = "pl7.app/repertoire/state";
const FREQUENCY_COLUMN = "pl7.app/repertoire/stateFrequency";
const PER_SAMPLE_FREQUENCY_COLUMN = "pl7.app/repertoire/stateFrequencyPerSample";
const PARENT_RESIDUE_COLUMN = "pl7.app/repertoire/parentResidue";
const REGION_COLUMN = "pl7.app/repertoire/regionAnnotation";
const SUB_REGION_COLUMN = "pl7.app/repertoire/subRegionAnnotation";
const ALPHABET_DOMAIN = "pl7.app/alphabet";

const alphabetOf = (spec: PColumnSpec) => spec.domain?.[ALPHABET_DOMAIN];

// aa is preferred because nt columns exist only when nucleotide export is on. The
// nt cells and tracks ride in the same frame, so switching level is a picker
// change rather than a re-run.
const level = computed(() => {
  const pCols = app.model.outputs.stateHeatmapPCols;
  if (!pCols) return undefined;
  const freq = pCols.filter((c) => c.spec.name === FREQUENCY_COLUMN);
  if (freq.length === 0) return undefined;
  return freq.some((c) => alphabetOf(c.spec) === "aminoacid") ? "aminoacid" : "nucleotide";
});

const findValueColumn = (name: string): PColumnIdAndSpec | undefined => {
  const pCols = app.model.outputs.stateHeatmapPCols;
  if (!pCols || level.value === undefined) return undefined;
  return pCols.find((c) => c.spec.name === name && alphabetOf(c.spec) === level.value);
};

const buildDefaultOptions = (
  valueCol: PColumnIdAndSpec | undefined,
): PredefinedGraphOption<"heatmap">[] | undefined => {
  const pCols = app.model.outputs.stateHeatmapPCols;
  if (!pCols || !valueCol) return undefined;

  const axes = valueCol.spec.axesSpec;
  const parentAxis = axes.find((a) => a.name === PARENT_ID_AXIS);
  const positionAxis = axes.find((a) => a.name === POSITION_AXIS);
  const stateAxis = axes.find((a) => a.name === STATE_AXIS);
  if (!parentAxis || !positionAxis || !stateAxis) return undefined;
  // The per-sample cells carry one more axis, the sample. A heat map cell holds one value, so
  // that axis must go to a basket too, or every cell gets one value per sample and the chart
  // fails.
  const sampleAxis = axes.find((a) => a !== parentAxis && a !== positionAxis && a !== stateAxis);

  const options: PredefinedGraphOption<"heatmap">[] = [
    { inputName: "value", selectedSource: valueCol.spec },
    { inputName: "x", selectedSource: positionAxis },
    { inputName: "y", selectedSource: stateAxis },
    // parentId must be consumed by some component, and xGroupBy is the only choice
    // that keeps the [parentId, position] tracks below in a VALID state — not just a
    // rendering preference. An X annotation is offered only when every axis of it
    // maps to x or xGroupBy, and a selected source absent from its component's
    // option list is reported inconsistent (pf-plots ComponentController
    // checkStateConsistency), which puts the whole chart into the 'inconsistent'
    // status. So parentId stays here even though the tabs below also carry it.
    { inputName: "xGroupBy", selectedSource: parentAxis },
    // One plot per parent: states from different parents sit on unrelated position
    // coordinates, so they are read one parent at a time. The same axis goes into
    // two baskets on purpose — tabBy draws the tab bar and scopes the data, while
    // xGroupBy keeps the annotation tracks valid (see above). With the tab applied
    // the xGroupBy band is a single section carrying the parent's name.
    //
    // No selectedFilterValues: graph-maker picks the first parent itself and keeps
    // the choice in the saved graph state, so the page needs no parent picker of
    // its own. Enumerating parents here would mean reading an output into local
    // state; letting graph-maker own the tab avoids that.
    { inputName: "tabBy", selectedSource: parentAxis },
    { inputName: "tooltipContent", selectedSource: stateAxis },
  ];

  // Region bands under the position axis, so region boundaries read off the map.
  // Emitted only when the run defines regions, and aa-positioned — so it rides the
  // aa map alone. Matched exactly like the parent-residue track below (name plus
  // alphabet domain); the plot's own region column carries that domain, unlike the
  // one built for the downstream export.
  const regionCol = pCols.find(
    (c) => c.spec.name === REGION_COLUMN && alphabetOf(c.spec) === level.value,
  );
  // The narrower reading, present only when the run subdivides a region. One band, not
  // two: where it exists it REPLACES the region band, because it already carries the
  // framework in its names (CDR2_N, Graft, CDR2_C) and a second band above it would
  // repeat what the reader can see. Both columns stay exported either way — this is a
  // display choice, and a table or a downstream block may still want the wide one.
  const subRegionCol = pCols.find(
    (c) => c.spec.name === SUB_REGION_COLUMN && alphabetOf(c.spec) === level.value,
  );
  const bandCol = subRegionCol ?? regionCol;
  if (bandCol) {
    options.push({ inputName: "annotationsX", selectedSource: bandCol.spec });
  }
  // Parent sequence under the position axis — the reference residue per position.
  const parentResidueCol = pCols.find(
    (c) => c.spec.name === PARENT_RESIDUE_COLUMN && alphabetOf(c.spec) === level.value,
  );
  if (parentResidueCol) {
    options.push({ inputName: "annotationsX", selectedSource: parentResidueCol.spec });
  }
  if (sampleAxis) options.push({ inputName: "facetBy", selectedSource: sampleAxis });
  return options;
};

const pooledDefaults = computed(() => buildDefaultOptions(findValueColumn(FREQUENCY_COLUMN)));
const perSampleDefaults = computed(() =>
  buildDefaultOptions(findValueColumn(PER_SAMPLE_FREQUENCY_COLUMN)),
);

const notRun = { noPframe: { title: "Run the block on the Main tab to see the plot." } };
</script>

<template>
  <!--
    `triadic` is the only categorical palette with enough colours for a residue
    alphabet: it carries all 27 base colours, where light/bright/dark carry 9 each
    and paired 18. Discrete colours are assigned `colors[idx % colors.length]`, so
    the 9-colour default reuses a colour every 9th residue — visible repetition
    across the 20 residues plus gap. Past 27 distinct states (many multi-residue
    insertions) it still wraps; graph-maker honours only a palette NAME for
    annotation tracks, not an explicit residue->colour map.
  -->
  <GraphMaker
    v-if="tab === 'pooled'"
    key="pooled"
    v-model="graphState"
    chart-type="heatmap"
    :p-frame="app.model.outputs.stateHeatmapPf"
    :default-options="pooledDefaults"
    :default-palette="{ categorical: 'triadic' }"
    :readonly-inputs="['x', 'y']"
    :status-text="notRun"
  >
    <template #titleLineSlot>
      <PlTabs v-model="tab" :options="TABS" :top-line="false" />
    </template>
  </GraphMaker>

  <GraphMaker
    v-else
    key="perSample"
    v-model="perSampleGraphState"
    chart-type="heatmap"
    :p-frame="app.model.outputs.stateHeatmapPf"
    :default-options="perSampleDefaults"
    :default-palette="{ categorical: 'triadic' }"
    :readonly-inputs="['x', 'y']"
    :status-text="notRun"
  >
    <template #titleLineSlot>
      <PlTabs v-model="tab" :options="TABS" :top-line="false" />
    </template>
  </GraphMaker>
</template>
