<script setup lang="ts">
import type { PredefinedGraphOption } from "@milaboratories/graph-maker";
import { GraphMaker } from "@milaboratories/graph-maker";
import type { PColumnSpec, PObjectId } from "@platforma-sdk/model";
import { getUniqueSourceValuesWithLabels } from "@platforma-sdk/model";
import { PlDropdown } from "@platforma-sdk/ui-vue";
import { computed, ref, watch } from "vue";
import { useApp } from "./app";

const app = useApp();

const PARENT_ID_AXIS = "pl7.app/repertoire/parentId";
const POSITION_AXIS = "pl7.app/repertoire/position";
const STATE_AXIS = "pl7.app/repertoire/state";
const FREQUENCY_COLUMN = "pl7.app/repertoire/stateFrequency";
const PARENT_RESIDUE_COLUMN = "pl7.app/repertoire/parentResidue";
const REGION_COLUMN = "pl7.app/repertoire/regionAnnotation";
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

const valueColumn = computed(() => {
  const pCols = app.model.outputs.stateHeatmapPCols;
  if (!pCols || level.value === undefined) return undefined;
  return pCols.find((c) => c.spec.name === FREQUENCY_COLUMN && alphabetOf(c.spec) === level.value);
});

// One plot per parent, selected here. States from different parents sit on
// unrelated position coordinates, so they are read one parent at a time.
//
// The parent list is enumerated off the value column's parentId axis and kept in
// LOCAL refs — never written to `app.model.data`. That is deliberate: the parent
// identities live in the user's FASTA and reach the UI only through an output, so
// persisting them would be an output -> data write (the hairpin), with the
// multi-client race that carries. Watching an output into a local ref is the
// sanctioned form. It also means no data migration and no workflow output are
// needed for this view.
const parentOptions = ref<{ value: string; label: string }[]>([]);
const selectedParent = ref<string | undefined>(undefined);

watch(
  () => {
    // `stateHeatmapPf` is a with-status output (GraphMaker's :p-frame takes the
    // wrapper); the enumeration needs the bare handle.
    const status = app.model.outputs.stateHeatmapPf;
    return {
      pframe: status?.ok ? status.value : undefined,
      columnId: valueColumn.value?.columnId,
    };
  },
  async ({ pframe, columnId }) => {
    if (!pframe || !columnId) {
      parentOptions.value = [];
      return;
    }
    try {
      const res = await getUniqueSourceValuesWithLabels(pframe, {
        columnId: columnId as PObjectId,
        axisIdx: 0,
      });
      parentOptions.value = res.values.map((v) => ({ value: v.value, label: v.label }));
      // Default to the first parent, and re-default when the current choice is gone
      // (a rerun with a different FASTA). Both writes target a local ref.
      const current = selectedParent.value;
      if (!current || !parentOptions.value.some((o) => o.value === current)) {
        selectedParent.value = parentOptions.value[0]?.value;
      }
    } catch {
      parentOptions.value = [];
    }
  },
  { immediate: true },
);

const defaultOptions = computed((): PredefinedGraphOption<"heatmap">[] | undefined => {
  const pCols = app.model.outputs.stateHeatmapPCols;
  const valueCol = valueColumn.value;
  if (!pCols || !valueCol) return undefined;

  const axes = valueCol.spec.axesSpec;
  const parentAxis = axes.find((a) => a.name === PARENT_ID_AXIS);
  const positionAxis = axes.find((a) => a.name === POSITION_AXIS);
  const stateAxis = axes.find((a) => a.name === STATE_AXIS);
  if (!parentAxis || !positionAxis || !stateAxis) return undefined;

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
    // status. tabBy sits outside that set, so parent-as-tabs plus these tracks is a
    // rejected combination however well the tab filter would have scoped the data.
    { inputName: "xGroupBy", selectedSource: parentAxis },
    { inputName: "tooltipContent", selectedSource: stateAxis },
  ];

  // Scope the plot to the chosen parent. A filter (rather than tabs) is what keeps
  // parentId in the annotation-friendly set above while still showing one parent at
  // a time; with the filter applied the xGroupBy band is a single section carrying
  // the parent's name. Absent a selection (before the first run, or if enumeration
  // failed) no filter is preset and every parent is shown grouped — the plot stays
  // usable rather than empty.
  if (selectedParent.value !== undefined) {
    options.push({
      inputName: "filters",
      selectedSource: parentAxis,
      filterType: "equals",
      selectedFilterValues: [selectedParent.value],
    });
  }

  // Region bands under the position axis, so region boundaries read off the map.
  // Emitted only when the run defines regions, and aa-positioned — so it rides the
  // aa map alone. Matched exactly like the parent-residue track below (name plus
  // alphabet domain); the plot's own region column carries that domain, unlike the
  // one built for the downstream export.
  const regionCol = pCols.find(
    (c) => c.spec.name === REGION_COLUMN && alphabetOf(c.spec) === level.value,
  );
  if (regionCol) {
    options.push({ inputName: "annotationsX", selectedSource: regionCol.spec });
  }
  // Parent sequence under the position axis — the reference residue per position.
  const parentResidueCol = pCols.find(
    (c) => c.spec.name === PARENT_RESIDUE_COLUMN && alphabetOf(c.spec) === level.value,
  );
  if (parentResidueCol) {
    options.push({ inputName: "annotationsX", selectedSource: parentResidueCol.spec });
  }
  return options;
});
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
    v-model="app.model.data.graphStateStateHeatmap"
    chart-type="heatmap"
    :p-frame="app.model.outputs.stateHeatmapPf"
    :default-options="defaultOptions"
    :default-palette="{ categorical: 'triadic' }"
    :readonly-inputs="['x', 'y']"
    :status-text="{
      noPframe: { title: 'Run the block on the Main tab to see the plot.' },
    }"
  >
    <template #settingsSlot>
      <PlDropdown
        :model-value="selectedParent"
        :options="parentOptions"
        label="Parent"
        @update:model-value="(v?: string) => (selectedParent = v ?? undefined)"
      >
        <template #tooltip>
          Which parent (alignment reference) to plot. Positions are numbered against the parent, so
          each parent is a separate map.
        </template>
      </PlDropdown>
    </template>
  </GraphMaker>
</template>
