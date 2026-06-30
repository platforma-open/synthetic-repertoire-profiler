<script setup lang="ts">
import { parsePattern } from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";
import {
  getRawPlatformaInstance,
  isImportFileHandleUpload,
  type ImportFileHandle,
  type LocalImportFileHandle,
} from "@platforma-sdk/model";
import {
  PlAccordionSection,
  PlBtnGroup,
  PlCheckbox,
  PlDropdown,
  PlDropdownMulti,
  PlDropdownRef,
  PlFileInput,
  PlNumberField,
  PlSectionSeparator,
  PlTextArea,
  PlTextField,
  PlTooltip,
  ReactiveFileContent,
} from "@platforma-sdk/ui-vue";
import { computed, watch } from "vue";
import { useApp } from "./app";
import { findHeader, parseKnownTsv } from "./parseKnownTsv";
import RegionSchemeEditor from "./RegionSchemeEditor.vue";

const app = useApp();

const parentModeOptions = [
  { label: "FASTA sequence", value: "fastaSequence" as const },
  { label: "FASTA file", value: "fastaFile" as const },
];

// --- Known-set column mapping -------------------------------------------------
// The known TSVs have arbitrary headers, so the user maps which column is the
// ID, the Sequence, and which to import as metadata. We discover headers + types
// by reading the uploaded bytes (local: straight off disk; remote: once the
// prerun imports the file and ReactiveFileContent delivers bytes).
type Level = "nt" | "aa";
const reactiveFileContent = ReactiveFileContent.useGlobal();

// Parse bytes → persist discovered columns + pre-pick the obvious ID/Sequence.
// The columns are snapshotted into `data` (not kept as a derived output) because
// `.args()` consumes their inferred types — see the watcher rationale below.
function processKnown(level: Level, bytes: Uint8Array) {
  const { columns, error } = parseKnownTsv(bytes);
  if (level === "nt") {
    app.model.data.knownNtImportError = error;
    app.model.data.knownNtColumns = columns;
    if (columns) {
      app.model.data.knownNtSequenceColumn ??= findHeader(columns, "Sequence");
      app.model.data.knownNtIdColumn ??= findHeader(columns, "ID");
    }
  } else {
    app.model.data.knownAaImportError = error;
    app.model.data.knownAaColumns = columns;
    if (columns) {
      app.model.data.knownAaSequenceColumn ??= findHeader(columns, "Sequence");
      app.model.data.knownAaIdColumn ??= findHeader(columns, "ID");
    }
  }
}

// File selection: reset the level's mapping, set the handle (triggers the prerun
// import for remote files), and read bytes immediately for local uploads.
async function setKnownFile(level: Level, file: ImportFileHandle | undefined) {
  if (level === "nt") {
    app.model.data.knownNtColumns = undefined;
    app.model.data.knownNtIdColumn = undefined;
    app.model.data.knownNtSequenceColumn = undefined;
    app.model.data.knownNtMetadataColumns = [];
    app.model.data.knownNtImportError = undefined;
    app.model.data.knownNtFileHandle = file;
  } else {
    app.model.data.knownAaColumns = undefined;
    app.model.data.knownAaIdColumn = undefined;
    app.model.data.knownAaSequenceColumn = undefined;
    app.model.data.knownAaMetadataColumns = [];
    app.model.data.knownAaImportError = undefined;
    app.model.data.knownAaFileHandle = file;
  }
  if (!file) return;
  // Local file: read off disk now. Remote: the watch below handles it once bytes arrive.
  if (isImportFileHandleUpload(file)) {
    try {
      const bytes = await getRawPlatformaInstance().lsDriver.getLocalFileContent(
        file as LocalImportFileHandle,
      );
      processKnown(level, bytes);
    } catch (e) {
      const msg = `Failed to read file: ${String(e)}`;
      if (level === "nt") app.model.data.knownNtImportError = msg;
      else app.model.data.knownAaImportError = msg;
    }
  }
}

// Remote-file bytes via the prerun-exported handle. Columns are snapshotted into
// `data` because `.args()` needs their inferred types. Local files snapshot on
// the user gesture (setKnownFile); remote bytes arrive async with no gesture, so
// a watcher is required. This output→data write is hairpin-SHAPED but safe:
// idempotent (identical bytes → identical columns), guarded against re-processing,
// and knownNtColumns never feeds back into the watched output.
const knownNtBytes = computed(() => {
  const h = app.model.outputs.knownNtFileContent;
  return h ? reactiveFileContent.getContentBytes(h.handle).value : undefined;
});
const knownAaBytes = computed(() => {
  const h = app.model.outputs.knownAaFileContent;
  return h ? reactiveFileContent.getContentBytes(h.handle).value : undefined;
});
watch(knownNtBytes, (bytes) => {
  if (!bytes || !app.model.data.knownNtFileHandle) return;
  if (app.model.data.knownNtColumns !== undefined) return;
  processKnown("nt", bytes);
});
watch(knownAaBytes, (bytes) => {
  if (!bytes || !app.model.data.knownAaFileHandle) return;
  if (app.model.data.knownAaColumns !== undefined) return;
  processKnown("aa", bytes);
});

// Mapping-widget options. Metadata excludes the chosen ID + Sequence columns.
const ntColumnOptions = computed(
  () => app.model.data.knownNtColumns?.map((c) => ({ label: c.header, value: c.header })) ?? [],
);
const aaColumnOptions = computed(
  () => app.model.data.knownAaColumns?.map((c) => ({ label: c.header, value: c.header })) ?? [],
);
const ntMetadataOptions = computed(() =>
  ntColumnOptions.value.filter(
    (o) =>
      o.value !== app.model.data.knownNtIdColumn &&
      o.value !== app.model.data.knownNtSequenceColumn,
  ),
);
const aaMetadataOptions = computed(() =>
  aaColumnOptions.value.filter(
    (o) =>
      o.value !== app.model.data.knownAaIdColumn &&
      o.value !== app.model.data.knownAaSequenceColumn,
  ),
);

// Live validation: a pattern that captures Read 2 needs a paired-end input.
// Read straight from the model output — never written back into data (that was
// a hairpin). The workflow re-asserts this as defence-in-depth.
const pairedEndMismatch = computed(() => {
  const pattern = app.model.data.tagPattern;
  if (!pattern || pattern.trim() === "") return false;
  const parts = parsePattern(pattern.replace(/\s+/g, ""));
  if (!parts || parts.r2 === undefined) return false;
  return app.model.outputs.inputIsPairedEnd === false;
});

// Snapshot the picked dataset's name into data on selection — the model's
// args-only `.subtitle` reads it from there (it can't resolve the label live).
// A user-gesture write, not an output→data watchEffect, so no hairpin.
type InputRef = NonNullable<typeof app.model.data.input>;
function onSelectInput(ref: InputRef | undefined) {
  app.model.data.input = ref;
  app.model.data.defaultBlockLabel =
    app.model.outputs.inputOptions?.find(
      (o) => ref && o.ref.blockId === ref.blockId && o.ref.name === ref.name,
    )?.label ?? "";
}
</script>

<template>
  <PlDropdownRef
    :model-value="app.model.data.input"
    :options="app.model.outputs.inputOptions"
    label="Input reads (FASTQ)"
    clearable
    :required="true"
    @update:model-value="onSelectInput"
  />

  <PlBtnGroup
    v-model="app.model.data.parentInputMode"
    :options="parentModeOptions"
    label="Parent sequences"
  />

  <PlTextArea
    v-if="app.model.data.parentInputMode === 'fastaSequence'"
    v-model="app.model.data.parentSequence"
    label="Parent sequences (FASTA)"
    placeholder=">parentA
ACGTACGT..."
    :rows="8"
  >
    <template #tooltip>
      Paste one or more parent nucleotide sequences in FASTA format. Each header becomes the parent
      ID; the body is the alignment reference.
    </template>
  </PlTextArea>

  <PlFileInput
    v-else
    v-model="app.model.data.parentFileHandle"
    label="Parent sequences (FASTA file)"
    :extensions="['fasta', 'fa']"
    clearable
  >
    <template #tooltip>
      Upload a FASTA file of parent nucleotide sequences. Each record header becomes the parent ID.
    </template>
  </PlFileInput>

  <PlTextField
    v-model="app.model.data.tagPattern"
    label="Tag pattern"
    placeholder="e.g. ^N{16}CAGT(UMI:N{18})(R1:*)\^(R2:*)"
    :error="
      pairedEndMismatch
        ? 'Pattern includes a Read 2 half but the selected input is single-end. Remove the R2 half or pick a paired-end input.'
        : undefined
    "
  >
    <template #tooltip>
      Tag pattern for primer trimming, UMI extraction etc. Support MiXCR pattern syntax. Required:
      the insert capture (R1/R2) marks the region aligned to the parent, and any UMI capture enables
      molecule-level counting.
    </template>
  </PlTextField>

  <PlAccordionSection label="Region scheme">
    <RegionSchemeEditor />
  </PlAccordionSection>

  <PlAccordionSection label="Known Variants">
    <PlFileInput
      :model-value="app.model.data.knownNtFileHandle"
      label="Known NT variants"
      :extensions="['tsv']"
      clearable
      @update:model-value="(f) => setKnownFile('nt', f)"
    >
      <template #tooltip>
        Optional. TSV with arbitrary columns. After upload, map which column is the ID, the
        Sequence, and which to import as metadata. Used to assign assembled nucleotide variants to
        the designed set.
      </template>
    </PlFileInput>

    <template v-if="app.model.data.knownNtFileHandle">
      <PlDropdown
        v-model="app.model.data.knownNtSequenceColumn"
        :options="ntColumnOptions"
        label="Known NT — Sequence column"
        required
        :error="app.model.data.knownNtImportError"
      />
      <PlDropdown
        v-model="app.model.data.knownNtIdColumn"
        :options="ntColumnOptions"
        label="Known NT — ID column"
        required
      />
      <PlDropdownMulti
        v-model="app.model.data.knownNtMetadataColumns"
        :options="ntMetadataOptions"
        label="Known NT — Metadata columns to import"
        placeholder="All columns"
      />
    </template>

    <PlFileInput
      :model-value="app.model.data.knownAaFileHandle"
      label="Known AA variants"
      :extensions="['tsv']"
      clearable
      @update:model-value="(f) => setKnownFile('aa', f)"
    >
      <template #tooltip>
        Optional. TSV with arbitrary columns, at the amino-acid level. After upload, map the ID,
        Sequence, and metadata columns.
      </template>
    </PlFileInput>

    <template v-if="app.model.data.knownAaFileHandle">
      <PlDropdown
        v-model="app.model.data.knownAaSequenceColumn"
        :options="aaColumnOptions"
        label="Known AA — Sequence column"
        required
        :error="app.model.data.knownAaImportError"
      />
      <PlDropdown
        v-model="app.model.data.knownAaIdColumn"
        :options="aaColumnOptions"
        label="Known AA — ID column"
        required
      />
      <PlDropdownMulti
        v-model="app.model.data.knownAaMetadataColumns"
        :options="aaMetadataOptions"
        label="Known AA — Metadata columns to import"
        placeholder="All columns"
      />
    </template>
  </PlAccordionSection>

  <PlAccordionSection label="Advanced Settings">
    <PlCheckbox v-model="app.model.data.ntStateMatrix">
      Produce nucleotide-level state matrix
      <PlTooltip class="info" position="top">
        <template #tooltip>
          Enable this to emit the nucleotide-level position state matrix in addition to amino
          acid-level, whose primary use is detecting synthesis artifacts (bad triplets / hairpins)
          via under-represented variants.
        </template>
      </PlTooltip>
    </PlCheckbox>

    <PlSectionSeparator>Resource Allocation</PlSectionSeparator>
    <PlNumberField
      v-model="app.model.data.perProcessMemGB"
      label="Memory per sample process (GB)"
      :min-value="1"
      :clearable="true"
    >
      <template #tooltip>
        Override the memory given to each per-sample mitool run (parse + analyze). Leave empty for
        the default.
      </template>
    </PlNumberField>

    <PlNumberField
      v-model="app.model.data.perProcessCPUs"
      label="CPUs per sample process"
      :min-value="1"
      :clearable="true"
    >
      <template #tooltip>
        Override the CPUs given to each per-sample mitool run. Leave empty for the default.
      </template>
    </PlNumberField>
  </PlAccordionSection>
</template>
