import type {
  ImportFileHandle,
  InferOutputsType,
  PlDataTableStateV2,
  PObjectSpec,
  PlRef,
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  createPlDataTableStateV2,
  createPlDataTableV2,
  DataModelBuilder,
  isPColumnSpec,
  parseResourceMap,
} from "@platforma-sdk/model";
import type { PatternParts } from "./pattern";
import { parsePattern, patternHasUmi } from "./pattern";

export { parsePattern, patternHasUmi } from "./pattern";
export type { LengthRange, PatternHalf, PatternParts } from "./pattern";

/** mitool emits progress lines `[==PROGRESS==]<stage>: <pct>%  ETA: <eta>`. */
export const ProgressPrefix = "[==PROGRESS==]";
export const ProgressPattern =
  /(?<stage>[^:]*):(?: *(?<progress>[0-9.]+)%)?(?: *ETA: *(?<eta>.+))?/;

/** How the user supplies the parent (alignment-reference) sequences. Both modes
 *  carry FASTA — paste a string, or upload a file. */
export type ParentInputMode = "fastaSequence" | "fastaFile";

/** A column discovered in a known-set TSV: its header and the value type
 *  inferred from a sample of its values. */
export type KnownColumnInfo = {
  header: string;
  type: "Int" | "Double" | "String";
};

/** Unified, UI-editable block state (V3 data model). The `.args(...)` lambda
 *  projects this to the workflow-facing args; view-only fields stay here. */
export type BlockData = {
  // Block label shown as the subtitle. `customBlockLabel` is the user-renamed
  // override; `defaultBlockLabel` holds the selected dataset's name, snapshotted
  // by the UI on selection (the `.subtitle` context is args-only and can't
  // resolve the dataset label live).
  customBlockLabel?: string;
  defaultBlockLabel?: string;

  // Input reads — a fastq dataset from the result pool.
  input?: PlRef;

  // mitool tag pattern: insert capture (R1/R2) + optional UMI. `hasUmi` is
  // derived by parsing this string (no separate flag).
  tagPattern?: string;

  // Parents (alignment references) — FASTA, two modes.
  parentInputMode: ParentInputMode;
  parentSequence?: string; // fastaSequence: pasted FASTA
  parentFileHandle?: ImportFileHandle; // fastaFile: uploaded FASTA

  // Optional known-variant set(s) — TSV with arbitrary headers, nt and/or aa.
  // May supply one, both, or neither. The columns are user-mapped (the format
  // is not fixed): per level the UI discovers headers + inferred types
  // (`known{Nt,Aa}Columns`), and the user picks which is the ID, the Sequence,
  // and which to import as metadata. The chosen ID/Sequence names go to mitool;
  // the metadata columns become `knownVariantMetadata/*` PColumns.
  knownNtFileHandle?: ImportFileHandle;
  knownAaFileHandle?: ImportFileHandle;
  knownNtColumns?: KnownColumnInfo[];
  knownNtIdColumn?: string;
  knownNtSequenceColumn?: string;
  knownNtMetadataColumns: string[];
  knownNtImportError?: string;
  knownAaColumns?: KnownColumnInfo[];
  knownAaIdColumn?: string;
  knownAaSequenceColumn?: string;
  knownAaMetadataColumns: string[];
  knownAaImportError?: string;

  // Opt-in nt-level state matrix; OFF by default (aa state matrix is always on).
  ntStateMatrix: boolean;

  // Optional per-sample mitool resource overrides (Advanced). Empty = workflow
  // defaults. Passed to the parse + analyze exec steps.
  perProcessMemGB?: number;
  perProcessCPUs?: number;

  // Per-page table grid state (sort, column visibility, etc.).
  qcTableState: PlDataTableStateV2;
  knownVariantsNtTableState: PlDataTableStateV2;
  knownVariantsAaTableState: PlDataTableStateV2;
  unmatchedVariantsNtTableState: PlDataTableStateV2;
};

/** Workflow-facing args projected from `BlockData` by `.args(...)`. */
export type BlockArgs = {
  input: PlRef;
  tagPattern: string;
  patternParts: PatternParts;
  hasUmi: boolean;
  parentInputMode: ParentInputMode;
  parentSequence?: string;
  parentFileHandle?: ImportFileHandle;
  knownNtFileHandle?: ImportFileHandle;
  knownAaFileHandle?: ImportFileHandle;
  // User-mapped known-set columns. ID/Sequence names go to mitool's
  // --[aa-]sequence-column/--[aa-]id-column; metadata descriptors drive the
  // dynamic knownVariantMetadata/* import. Present only when the level's file is.
  knownNtIdColumn?: string;
  knownNtSequenceColumn?: string;
  knownNtMetadata?: KnownColumnInfo[];
  knownAaIdColumn?: string;
  knownAaSequenceColumn?: string;
  knownAaMetadata?: KnownColumnInfo[];
  ntStateMatrix: boolean;
  perProcessMemGB?: number;
  perProcessCPUs?: number;
  defaultBlockLabel: string;
  customBlockLabel: string;
};

const dataModel = new DataModelBuilder().from<BlockData>("v1").init(() => ({
  parentInputMode: "fastaSequence" as ParentInputMode,
  defaultBlockLabel: "",
  knownNtMetadataColumns: [],
  knownAaMetadataColumns: [],
  // Default pattern: insert capture on each mate, no UMI/anchors (paired-end).
  tagPattern: "^(R1:*)\\^(R2:*)",
  ntStateMatrix: false,
  qcTableState: createPlDataTableStateV2(),
  knownVariantsNtTableState: createPlDataTableStateV2(),
  knownVariantsAaTableState: createPlDataTableStateV2(),
  unmatchedVariantsNtTableState: createPlDataTableStateV2(),
}));

const DNA_IUPAC_RE = /^[ACGTacgtMKRYWSBDHVNmkrywsbdhvn]*$/;

/** Trace-label fallback when neither a custom label nor a dataset name is set. */
const DEFAULT_BLOCK_LABEL = "Amplicon Repertoire Profiling";

/** Shown as the block subtitle before a dataset is picked. */
const NO_DATASET_LABEL = "Select dataset";

/** Selects the FASTQ datasets (keyed by sampleId) offered in the dataset
 *  picker. The UI reuses this to resolve the selected dataset's label. */
function isFastqInput(v: PObjectSpec): boolean {
  if (!isPColumnSpec(v)) return false;
  const domain = v.domain;
  return (
    v.name === "pl7.app/sequencing/data" &&
    (v.valueType as string) === "File" &&
    domain !== undefined &&
    (domain["pl7.app/fileExtension"] === "fastq" ||
      domain["pl7.app/fileExtension"] === "fastq.gz") &&
    v.axesSpec.some((a) => a.name === "pl7.app/sampleId")
  );
}

export const platforma = BlockModelV3.create(dataModel)

  // FASTQ datasets keyed by sampleId — the dataset picker.
  .retentiveOutput("inputOptions", (ctx) => {
    return ctx.resultPool.getOptions(isFastqInput);
  })

  // Per-sample labels for the selected input (for table/QC display).
  .output("sampleLabels", (ctx): Record<string, string> | undefined => {
    const inputRef = ctx.data.input;
    if (inputRef === undefined) return undefined;
    const spec = ctx.resultPool.getPColumnSpecByRef(inputRef);
    if (spec === undefined) return undefined;
    return ctx.resultPool.findLabelsForColumnAxis(spec, 0);
  })

  // Whether the selected input carries an R2 read (paired-end), read from the
  // readIndex axis domain. Consumed by the UI (SettingsPanel) to validate the
  // pattern shape live; never written back into data (that was a hairpin).
  .output("inputIsPairedEnd", (ctx): boolean | undefined => {
    const inputRef = ctx.data.input;
    if (inputRef === undefined) return undefined;
    const inputSpec = ctx.resultPool.getPColumnSpecByRef(inputRef);
    if (inputSpec === undefined || !isPColumnSpec(inputSpec)) return undefined;
    const axis = inputSpec.axesSpec.find((a) => a.name === "pl7.app/sequencing/readIndex");
    const raw = axis?.domain?.["pl7.app/readIndices"];
    if (typeof raw !== "string") return undefined;
    try {
      const indices = JSON.parse(raw);
      return Array.isArray(indices) && indices.includes("R2");
    } catch {
      return undefined;
    }
  })

  // Run status — true once the main workflow has produced outputs.
  .output("started", (ctx) => ctx.outputs !== undefined)

  .output("isRunning", (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  // Drives the upload of "My Computer" files (parent FASTA / known-set TSVs) from
  // PRERUN: getImportProgress() is the side effect that starts the transfer, and
  // `isActive` forces the lambda to run even when nothing subscribes. Driving it
  // in prerun (not the main run) means the handle finalizes during staging, so a
  // run that uploaded a file does NOT flip the block to "modified" afterwards.
  .output(
    "prerunFileImports",
    (ctx) =>
      Object.fromEntries(
        ctx.prerun
          ?.resolve({ field: "fileImports", assertFieldType: "Input" })
          ?.mapFields((handle, acc) => [handle as ImportFileHandle, acc.getImportProgress()], {
            skipUnresolved: true,
          }) ?? [],
      ),
    { isActive: true },
  )

  // Known-set file handles (content-readable) for the UI's column-mapping
  // discovery. The prerun exports the imported file; the UI reads its bytes via
  // ReactiveFileContent (remote files) — local files are read straight off disk.
  .output("knownNtFileContent", (ctx) =>
    ctx.prerun?.resolveAny({ field: "knownNtFile" })?.getFileHandle(),
  )

  .output("knownAaFileContent", (ctx) =>
    ctx.prerun?.resolveAny({ field: "knownAaFile" })?.getFileHandle(),
  )

  // Per-sample analyze log handles (for the Logs view).
  .output("logs", (ctx) =>
    ctx.outputs !== undefined
      ? parseResourceMap(ctx.outputs.resolve("logs"), (acc) => acc.getLogHandle(), false)
      : undefined,
  )

  // Per-sample progress string scraped from the analyze log markers.
  .output("progress", (ctx) =>
    ctx.outputs !== undefined
      ? parseResourceMap(
          ctx.outputs.resolve("logs"),
          (acc) => acc.getProgressLog(ProgressPrefix),
          false,
        )
      : undefined,
  )

  // Per-sample step reports, keyed [sampleId, step, format] (step ∈ align /
  // assemble / call-mutations / assign; format ∈ json / txt). Feeds the sample
  // report panel and the Main-page Alignments cell. UI reads content via
  // ReactiveFileContent (getContentJson for charts, getContentString for txt).
  .output("reports", (ctx) =>
    ctx.outputs !== undefined
      ? parseResourceMap(ctx.outputs.resolve("reports"), (acc) => acc.getFileHandle(), false)
      : undefined,
  )

  // SampleIds whose per-sample pipeline has finished (qc.json materialized).
  // Drives the "Done" state — the progress log otherwise sticks at its last
  // marker (e.g. "Calling Mutations") when the exec completes.
  .output("done", (ctx): string[] | undefined =>
    ctx.outputs !== undefined
      ? parseResourceMap(ctx.outputs.resolve("qcJson"), () => true, false).data.map(
          (e) => e.key[0] as string,
        )
      : undefined,
  )

  // The variant repertoire (sequence, label, abundances, state matrix, linkers)
  // is exported to the result pool for downstream blocks, not shown in this
  // block's UI.

  // QC report table (per-sample metrics + assignment buckets). Plain metrics
  // table keyed by sampleId, no abundance/anchor column — so V2 (no anchor
  // discovery).
  .outputWithStatus("qcTable", (ctx) => {
    const pCols = ctx.outputs
      ?.resolve({ field: "qc", assertFieldType: "Input", allowPermanentAbsence: true })
      ?.getPColumns();
    if (pCols === undefined) return undefined;
    return createPlDataTableV2(ctx, pCols, ctx.data.qcTableState);
  })

  // Known-variant tables (only when the matching known set ran). Surfaces the
  // matched known table (id + sequence + linked abundance) plus convergence and
  // metadata. Plain tables keyed [knownVariantKey], no anchor → V2.
  .outputWithStatus("knownVariantsNtTable", (ctx) => {
    const pCols = ctx.outputs
      ?.resolve({ field: "knownVariantsNt", assertFieldType: "Input", allowPermanentAbsence: true })
      ?.getPColumns();
    if (pCols === undefined) return undefined;
    return createPlDataTableV2(ctx, pCols, ctx.data.knownVariantsNtTableState);
  })

  .outputWithStatus("unmatchedVariantsNtTable", (ctx) => {
    const pCols = ctx.outputs
      ?.resolve({
        field: "unmatchedVariantsNt",
        assertFieldType: "Input",
        allowPermanentAbsence: true,
      })
      ?.getPColumns();
    if (pCols === undefined) return undefined;
    return createPlDataTableV2(ctx, pCols, ctx.data.unmatchedVariantsNtTableState);
  })

  .outputWithStatus("knownVariantsAaTable", (ctx) => {
    const pCols = ctx.outputs
      ?.resolve({ field: "knownVariantsAa", assertFieldType: "Input", allowPermanentAbsence: true })
      ?.getPColumns();
    if (pCols === undefined) return undefined;
    return createPlDataTableV2(ctx, pCols, ctx.data.knownVariantsAaTableState);
  })

  .args<BlockArgs>((data) => {
    if (!data.input) throw new Error("Input dataset (FASTQ) is required");

    if (!data.tagPattern || data.tagPattern.trim() === "")
      throw new Error("Tag pattern is required");
    const tagPattern = data.tagPattern.replace(/\s+/g, ""); // canonicalize
    const patternParts = parsePattern(tagPattern);
    if (!patternParts)
      throw new Error(
        "Tag pattern is invalid. Each read must have the shape " +
          "^[*][(UMI:N{min[:max]})][leftAnchor](R1:*|N{n}|N{min:max})[rightAnchor][>{trim}]*. " +
          "UMI captures are optional; the insert (R) capture marks the region aligned to the parent. " +
          "UMI tags are named UMI, UMI1, …; insert tags R1, R2, …. All defined tag names must be unique.",
      );

    // At least one read half must carry an insert (R) capture — the region
    // aligned to the parent. The insert may be variable-length (`*`); the parent
    // alignment, not a fixed length/anchor, bounds it.
    const r1HasInsert = patternParts.r1.insertName !== undefined;
    const r2HasInsert = patternParts.r2?.insertName !== undefined;
    if (!r1HasInsert && !r2HasInsert)
      throw new Error("Pattern must capture an insert (R1 or R2) to align against the parent.");

    // Anchor characters must be DNA letters or IUPAC ambiguity codes.
    const halves = patternParts.r2 ? [patternParts.r1, patternParts.r2] : [patternParts.r1];
    for (const half of halves)
      for (const anchor of [half.leftAnchor, half.rightAnchor])
        if (anchor && !DNA_IUPAC_RE.test(anchor))
          throw new Error(
            "Anchor sequences must use DNA letters or IUPAC codes only " +
              "(A, C, G, T, M, K, R, Y, W, S, B, D, H, V, N — upper or lower case).",
          );

    // Pattern-vs-input read-structure mismatch (paired pattern, single-end input)
    // is checked live in the UI (SettingsPanel, via the `inputIsPairedEnd` output)
    // and asserted in the workflow as defence-in-depth. It is NOT gated here: args
    // is a pure function of `data`, and the paired-end fact is derived from the
    // result pool — pulling it into `data` to read here required a UI write-back
    // (a hairpin), which is the pattern we removed.

    // At least one parent must be supplied, per the active input mode.
    if (data.parentInputMode === "fastaSequence") {
      if (!data.parentSequence || data.parentSequence.trim() === "")
        throw new Error("At least one parent sequence is required (paste FASTA).");
    } else {
      if (!data.parentFileHandle) throw new Error("Upload a parent FASTA file.");
    }

    // When a known set is supplied its ID + Sequence columns must be mapped
    // (the format is not fixed) — the names are handed to mitool. Metadata
    // columns are optional.
    if (data.knownNtFileHandle) {
      if (!data.knownNtSequenceColumn)
        throw new Error("Select the Sequence column for the known nucleotide set.");
      if (!data.knownNtIdColumn)
        throw new Error("Select the ID column for the known nucleotide set.");
    }
    if (data.knownAaFileHandle) {
      if (!data.knownAaSequenceColumn)
        throw new Error("Select the Sequence column for the known amino-acid set.");
      if (!data.knownAaIdColumn)
        throw new Error("Select the ID column for the known amino-acid set.");
    }

    // Resource overrides: positive when set (empty = workflow defaults).
    if (data.perProcessMemGB !== undefined && data.perProcessMemGB < 1)
      throw new Error("Memory per process must be at least 1 GB.");
    if (data.perProcessCPUs !== undefined && data.perProcessCPUs < 1)
      throw new Error("CPUs per process must be at least 1.");

    // Resolve the selected metadata headers to {header, type} descriptors the
    // workflow uses to build the dynamic knownVariantMetadata/* import. An empty
    // selection imports ALL columns except the chosen ID/Sequence.
    const resolveMeta = (
      cols: KnownColumnInfo[] | undefined,
      selected: string[],
      idCol: string | undefined,
      seqCol: string | undefined,
    ): KnownColumnInfo[] => {
      const candidates = (cols ?? []).filter((c) => c.header !== idCol && c.header !== seqCol);
      return selected.length > 0
        ? candidates.filter((c) => selected.includes(c.header))
        : candidates;
    };

    return {
      input: data.input,
      tagPattern,
      patternParts,
      hasUmi: patternHasUmi(patternParts),
      parentInputMode: data.parentInputMode,
      // Suppress the inactive mode's field so the staleness gate ignores it.
      parentSequence: data.parentInputMode === "fastaSequence" ? data.parentSequence : undefined,
      parentFileHandle: data.parentInputMode === "fastaFile" ? data.parentFileHandle : undefined,
      knownNtFileHandle: data.knownNtFileHandle,
      knownAaFileHandle: data.knownAaFileHandle,
      // Column mapping per level — suppressed when the level's file is absent.
      knownNtIdColumn: data.knownNtFileHandle ? data.knownNtIdColumn : undefined,
      knownNtSequenceColumn: data.knownNtFileHandle ? data.knownNtSequenceColumn : undefined,
      knownNtMetadata: data.knownNtFileHandle
        ? resolveMeta(
            data.knownNtColumns,
            data.knownNtMetadataColumns,
            data.knownNtIdColumn,
            data.knownNtSequenceColumn,
          )
        : undefined,
      knownAaIdColumn: data.knownAaFileHandle ? data.knownAaIdColumn : undefined,
      knownAaSequenceColumn: data.knownAaFileHandle ? data.knownAaSequenceColumn : undefined,
      knownAaMetadata: data.knownAaFileHandle
        ? resolveMeta(
            data.knownAaColumns,
            data.knownAaMetadataColumns,
            data.knownAaIdColumn,
            data.knownAaSequenceColumn,
          )
        : undefined,
      ntStateMatrix: data.ntStateMatrix,
      perProcessMemGB: data.perProcessMemGB,
      perProcessCPUs: data.perProcessCPUs,
      // Workflow trace label: the selected dataset's name (snapshotted by the
      // UI), falling back to the constant when not yet resolved.
      defaultBlockLabel: data.defaultBlockLabel || DEFAULT_BLOCK_LABEL,
      customBlockLabel: data.customBlockLabel ?? "",
    };
  })

  // Drives uploads independently of the main Run, so the import handles finalize
  // during staging — keeps a file-upload run from going "modified" afterwards.
  .prerunArgs((data) => ({
    parentFileHandle: data.parentInputMode === "fastaFile" ? data.parentFileHandle : undefined,
    knownNtFileHandle: data.knownNtFileHandle,
    knownAaFileHandle: data.knownAaFileHandle,
  }))

  .sections((ctx) => {
    const items: {
      type: "link";
      href: "/" | "/qc" | "/known-variants-nt" | "/known-variants-aa" | "/unmatched-nt";
      label: string;
    }[] = [
      { type: "link", href: "/", label: "Main" },
      { type: "link", href: "/qc", label: "QC Report" },
    ];
    // NT known analysis runs only with an nt known set (--known); aa known
    // analysis runs with an aa set (--known-aa) or is derived from the nt set.
    if (ctx.data.knownNtFileHandle !== undefined)
      items.push({ type: "link", href: "/known-variants-nt", label: "Known Variants (NT)" });
    if (ctx.data.knownNtFileHandle !== undefined || ctx.data.knownAaFileHandle !== undefined)
      items.push({ type: "link", href: "/known-variants-aa", label: "Known Variants (AA)" });
    // Designed nt entries that no variant matched (dropouts) — nt known set only.
    if (ctx.data.knownNtFileHandle !== undefined)
      items.push({ type: "link", href: "/unmatched-nt", label: "Unmatched Designed (NT)" });
    return items;
  })

  .title(() => "Amplicon Repertoire Profiling")

  // Subtitle: custom label if the user set one, else the selected dataset's
  // name (snapshotted into data by the UI on selection), else a prompt. The
  // subtitle context is args-only — it can't resolve the dataset label live —
  // so the name must already be persisted in data here.
  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel || NO_DATASET_LABEL)

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
