<script setup lang="ts">
import type { ColDef } from "ag-grid-enterprise";
import { AgGridVue } from "ag-grid-vue3";
import {
  createAgGridColDef,
  makeRowNumberColDef,
  PlAgChartStackedBarCell,
  PlAgHeaderComponentParams,
  PlAgTextAndButtonCell,
  PlBlockPage,
  PlBtnGhost,
  PlMaskIcon24,
  PlSlideModal,
  ReactiveFileContent,
  useAgGridOptions,
} from "@platforma-sdk/ui-vue";
import { computed, ref, watch } from "vue";
import type { AlignReport } from "./alignmentChartSettings";
import { getAlignmentChartSettings } from "./alignmentChartSettings";
import { useApp } from "./app";
import { pipelineStatus } from "./stepProgress";
import SampleReportPanel from "./SampleReportPanel.vue";
import SettingsPanel from "./SettingsPanel.vue";

const { model } = useApp();

const reactiveFileContent = ReactiveFileContent.useGlobal();

type SampleRow = {
  sampleId: string;
  label: string;
  progress: string;
  progressPercent?: string;
  running: boolean;
  alignReport?: AlignReport;
};

// Settings drawer: open until the run starts; auto-close when the workflow
// starts producing outputs, and reopen if the block goes back to not-started
// (e.g. args edited / reset). Output → local ref, so not a hairpin.
const settingsOpen = ref(model.outputs.started === false);
watch(
  () => model.outputs.started,
  (started, prev) => {
    if (prev === false && started === true) settingsOpen.value = false;
    if (prev === true && started === false) settingsOpen.value = true;
  },
);

// Per-step progress entries for every sample the run knows about.
const stepEntries = computed(() => model.outputs.stepProgress?.data ?? []);

const doneSet = computed(() => new Set((model.outputs.done ?? []).map(String)));

// sampleId -> parsed align.report.json (alignment outcome) for the Alignments
// column, read from the consolidated reports map (step "align", format "json").
// Content is fetched + cached reactively by handle.
const alignReportMap = computed(() => {
  const m = new Map<string, AlignReport | undefined>();
  for (const e of model.outputs.reports?.data ?? []) {
    if (e.value === undefined || e.key[1] !== "align" || e.key[2] !== "json") continue;
    m.set(
      String(e.key[0]),
      reactiveFileContent.getContentJson(e.value.handle)?.value as AlignReport | undefined,
    );
  }
  return m;
});

const rows = computed<SampleRow[]>(() => {
  const labels = model.outputs.sampleLabels ?? {};
  const ids = new Set<string>([
    ...Object.keys(labels),
    ...stepEntries.value.map((e) => String(e.key[0])),
  ]);
  return [...ids].map((sampleId) => {
    const status = pipelineStatus(sampleId, stepEntries.value, {
      done: doneSet.value.has(sampleId),
    });
    return {
      sampleId,
      label: labels[sampleId] ?? sampleId,
      progress: status.text,
      progressPercent: status.percent,
      running: status.running,
      alignReport: alignReportMap.value.get(sampleId),
    };
  });
});

// Per-sample report slide-over (opened from the Sample cell button / row double-click).
const selectedSample = ref<string | undefined>(undefined);
const sampleReportOpen = ref(false);
const openSample = (sampleId: string | undefined) => {
  selectedSample.value = sampleId;
  sampleReportOpen.value = sampleId !== undefined;
};

const columnDefs: ColDef<SampleRow>[] = [
  makeRowNumberColDef(),
  createAgGridColDef<SampleRow, string>({
    colId: "label",
    field: "label",
    headerName: "Sample",
    headerComponentParams: { type: "Text" } satisfies PlAgHeaderComponentParams,
    pinned: "left",
    lockPinned: true,
    sortable: true,
    cellRenderer: PlAgTextAndButtonCell,
    cellRendererParams: { invokeRowsOnDoubleClick: true },
  }),
  createAgGridColDef<SampleRow, string>({
    colId: "progress",
    field: "progress",
    headerName: "Progress",
    headerComponentParams: { type: "Progress" } satisfies PlAgHeaderComponentParams,
    // The step label needs room; the Alignments chart beside it takes the flex.
    minWidth: 260,
    progress(_value, cellData) {
      const row = cellData.data;
      if (!row || row.progress === "Queued") return { status: "not_started", text: "Queued" };
      if (!row.running) return { status: "done", text: row.progress };
      return { status: "running", percent: row.progressPercent, text: row.progress };
    },
  }),
  createAgGridColDef<SampleRow, string>({
    colId: "alignmentStats",
    headerName: "Alignments",
    headerComponentParams: { type: "Text" } satisfies PlAgHeaderComponentParams,
    flex: 1,
    cellStyle: { "--ag-cell-horizontal-padding": "12px" },
    cellRendererSelector: (cellData) => ({
      component: PlAgChartStackedBarCell,
      params: { value: getAlignmentChartSettings(cellData.data?.alignReport) },
    }),
  }),
];

const { gridOptions } = useAgGridOptions<SampleRow>(() => ({
  columnDefs,
  getRowId: (row) => String(row.data.sampleId),
  rowData: rows.value,
  onRowDoubleClicked: (e) => openSample(e.data?.sampleId),
  components: { PlAgTextAndButtonCell, PlAgChartStackedBarCell },
  notReady: rows.value.length === 0,
  notReadyText: "Configure the settings and click 'Run' to see per-sample progress",
}));
</script>

<template>
  <PlBlockPage>
    <template #title>Amplicon Profiling</template>
    <template #append>
      <PlBtnGhost @click.stop="() => (settingsOpen = true)">
        Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
    </template>

    <div :style="{ flex: 1 }">
      <AgGridVue :style="{ height: '100%' }" v-bind="gridOptions as {}" />
    </div>

    <PlSlideModal v-model="settingsOpen" :shadow="true" :close-on-outside-click="false" width="40%">
      <template #title>Settings</template>
      <SettingsPanel />
    </PlSlideModal>

    <PlSlideModal v-model="sampleReportOpen" width="80%">
      <template #title>
        {{
          (selectedSample ? model.outputs.sampleLabels?.[selectedSample] : undefined) ??
          selectedSample ??
          "Sample"
        }}
      </template>
      <SampleReportPanel :sample-id="selectedSample" />
    </PlSlideModal>
  </PlBlockPage>
</template>
