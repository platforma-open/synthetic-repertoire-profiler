<script setup lang="ts">
import {
  DEFAULT_TAG_PATTERN_PAIRED,
  DEFAULT_TAG_PATTERN_SINGLE,
  isDefaultTagPattern,
  parsePattern,
  patternUmiSpec,
  plRefKey,
  tagPatternError,
} from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";
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
  PlRow,
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

// "Export only known variants" — shown only when a known set is supplied. Default
// OFF (a nullish stored value reads as false); toggling persists an explicit boolean.
// A user-gesture write via the computed setter, not an output→data watcher — no hairpin.
const hasKnownSet = computed(
  () => !!(app.model.data.knownNtFileHandle || app.model.data.knownAaFileHandle),
);
const exportOnlyKnown = computed({
  get: () => app.model.data.exportOnlyKnown ?? false,
  set: (v: boolean) => {
    app.model.data.exportOnlyKnown = v;
  },
});

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

// The UMI declared by the pattern, or undefined.
const umi = computed(() => {
  const pattern = app.model.data.tagPattern;
  if (!pattern || pattern.trim() === "") return undefined;
  const parts = parsePattern(pattern.replace(/\s+/g, ""));
  return parts ? patternUmiSpec(parts) : undefined;
});

// Shown on the pattern field itself, so a pattern the run gate would refuse is caught
// where it was typed. Same function the gate uses, so the two agree — including the
// unparseable case, which has no `umi` to report against.
const patternError = computed(() => tagPatternError(app.model.data.tagPattern));

// Both writes happen on the user gesture, never in a watcher on the outputs —
// that loop would be a hairpin. `.subtitle` is args-only, so it needs the dataset
// label snapshotted here.
//
// The pattern is refitted only while it is still a default, so an edited pattern
// (UMI, anchors, fixed lengths) survives a dataset switch. Paired-endedness comes
// from the by-ref map because `inputIsPairedEnd` still describes the previous
// dataset while this handler runs.
type InputRef = NonNullable<typeof app.model.data.input>;
function onSelectInput(ref: InputRef | undefined) {
  app.model.data.input = ref;
  app.model.data.defaultBlockLabel =
    app.model.outputs.inputOptions?.find(
      (o) => ref && o.ref.blockId === ref.blockId && o.ref.name === ref.name,
    )?.label ?? "";

  const isPaired = ref ? app.model.outputs.inputPairedEndByRef?.[plRefKey(ref)] : undefined;
  if (isPaired !== undefined && isDefaultTagPattern(app.model.data.tagPattern)) {
    app.model.data.tagPattern = isPaired ? DEFAULT_TAG_PATTERN_PAIRED : DEFAULT_TAG_PATTERN_SINGLE;
  }
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

  <PlCheckbox
    :model-value="app.model.data.vdjAutoDetect ?? false"
    @update:model-value="(v) => (app.model.data.vdjAutoDetect = v)"
  >
    Auto-detect VDJ regions (germline)
    <PlTooltip class="info" position="top">
      <template #tooltip>
        Finds the FR and CDR regions of each parent for you, by comparing it to germline V genes.
        Use it when your parents are antibody or TCR V-domains, in frame. If a parent's CDR3 cannot
        be found, the run stops with a message — turn this off and enter the regions by hand.
      </template>
    </PlTooltip>
  </PlCheckbox>

  <PlNumberField
    v-model="app.model.data.maxAaMutations"
    label="Max AA mut count"
    :min-value="1"
    :step="1"
    :clearable="true"
  >
    <template #tooltip>
      Drop in-frame variants with more than this many amino-acid changes from the parent. Silent
      nucleotide changes do not count. Leave empty to keep every variant (default).
    </template>
  </PlNumberField>

  <PlAccordionSection label="Barcodes">
    <PlTextField
      v-model="app.model.data.tagPattern"
      label="Tag pattern"
      placeholder="e.g. ^N{16}CAGT(UMI:N{18})(R1:*)\^(R2:*)"
      :error="
        pairedEndMismatch
          ? 'Pattern includes a Read 2 half but the selected input is single-end. Remove the R2 half or pick a paired-end input.'
          : patternError
      "
    >
      <template #tooltip>
        Tag pattern for primer trimming, UMI extraction etc. Support MiXCR pattern syntax. Required:
        the insert capture (R1/R2) marks the region aligned to the parent.<br /><br />
        A UMI capture switches on molecule-level analysis: barcodes are error-corrected, reads
        sharing one are collapsed into a single consensus read, and abundance is then reported in
        molecules rather than reads. A UMI on each read is allowed — the two are used together as
        the molecule key, not concatenated. Each capture needs a fixed length (<code>N{12}</code>,
        not <code>N{8:12}</code>), and at least 8 nt in total: below that, a sequencing error in a
        barcode cannot be told apart from a different real barcode.
      </template>
    </PlTextField>

    <template v-if="umi">
      <PlSectionSeparator>Molecule consensus</PlSectionSeparator>
      <PlRow>
        <PlNumberField
          v-model="app.model.data.minReadsPerConsensus"
          label="Min reads per UMI"
          :min-value="1"
          :step="1"
          :error-message="
            app.model.data.minReadsPerConsensus === undefined ? 'Required' : undefined
          "
        >
          <template #tooltip>
            Reads a molecule needs before it yields a consensus. Higher values correct more
            sequencing errors but discard rare molecules — <code>1</code> keeps everything, and is
            what you want on a shallow run or a very diverse library. Default <code>2</code>.
            Molecules dropped here appear as <em>Groups dropped by count</em> in the Consensus
            report.
          </template>
        </PlNumberField>

        <PlNumberField
          v-model="app.model.data.minUmiQuality"
          label="Min UMI quality"
          :min-value="0"
          :max-value="58"
          :step="1"
          :error-message="app.model.data.minUmiQuality === undefined ? 'Required' : undefined"
        >
          <template #tooltip>
            A barcode with any base below this Phred quality is discarded unless another barcode can
            absorb it as an error. Raising it discards more reads but leaves fewer wrong molecules;
            lowering it keeps more reads at the cost of splitting one molecule into several. Default
            <code>20</code>. See <em>diversity filtered by tag quality</em> in the Refine tags
            report.
          </template>
        </PlNumberField>
      </PlRow>
    </template>
  </PlAccordionSection>

  <!-- Manual per-parent region annotation. The whole section is hidden when the
       germline auto-detect above is on — there is nothing to enter by hand then. -->
  <PlAccordionSection v-if="!app.model.data.vdjAutoDetect" label="Region annotation">
    <RegionSchemeEditor />
  </PlAccordionSection>

  <PlAccordionSection label="Known Variants">
    <PlCheckbox v-if="hasKnownSet" v-model="exportOnlyKnown">
      Export only known variants
      <PlTooltip class="info" position="top">
        <template #tooltip>
          Off by default. When enabled, the exported variant repertoire is restricted to variants
          that matched a known variant entry.
        </template>
      </PlTooltip>
    </PlCheckbox>

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
    <PlCheckbox v-model="app.model.data.exportNt">
      Export nucleotide-level results
      <PlTooltip class="info" position="top">
        <template #tooltip>
          Off by default: only amino-acid-level results are exported. Enable this to also export
          every nucleotide-level column — nt variants and sequences, per-sample nt abundance, the nt
          state matrix, parent→nt and nt↔aa linkers, and the nt known-set overlay. The nt state
          matrix is useful for detecting synthesis artifacts (bad triplets / hairpins) via
          under-represented variants.
        </template>
      </PlTooltip>
    </PlCheckbox>

    <PlSectionSeparator>Quality Filter</PlSectionSeparator>
    <PlRow>
      <PlNumberField
        v-model="app.model.data.minBaseQuality"
        label="Min base quality"
        :min-value="0"
        :max-value="58"
        :step="1"
        :clearable="true"
      >
        <template #tooltip>
          Discard a read if any of its bases that overlap the parent sequence falls below this Phred
          quality. Bases outside the overlap — adapter tails and read overhang — are ignored, since
          they never reach the reported variant. Set 0 to keep every read regardless of quality.
          Leave empty for the default of 5.
        </template>
      </PlNumberField>

      <PlNumberField
        v-model="app.model.data.minVariantQuality"
        label="Min variant quality"
        :min-value="0"
        :max-value="58"
        :step="1"
        :clearable="true"
      >
        <template #tooltip>
          Discard a variant if its combined quality falls below this Phred at any single position.
          Quality accumulates across the reads supporting a variant, so a variant seen in only one
          or two reads is the most likely to be dropped — raise this to keep only well-supported
          variants, lower it to keep rare ones. Because the check applies to the worst position
          across the whole parent, it gets stricter as the parent gets longer: on a long parent with
          noisy reads the default of 20 can remove most variants. Set 0 to keep every variant. Leave
          empty for the default of 20.
        </template>
      </PlNumberField>
    </PlRow>

    <PlSectionSeparator>Mutation Filter</PlSectionSeparator>
    <PlNumberField
      v-model="app.model.data.maxMutations"
      label="Max NT mut count"
      :min-value="1"
      :step="1"
      :clearable="true"
    >
      <template #tooltip>
        Ignore variants that differ from the parent by more than this many mutations. Helps filter
        out off-target sequences that are unlikely to be real variants. Leave empty to keep all
        (default).
      </template>
    </PlNumberField>

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
