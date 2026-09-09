import type { GraphMakerState } from "@milaboratories/graph-maker";
import type {
  ImportFileHandle,
  InferOutputsType,
  PColumnIdAndSpec,
  PFrameHandle,
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
import type {
  ParentInputMode,
  ParentRegionConfig,
  RegionDef,
  RegionScheme,
} from "@platforma-open/milaboratories.synthetic-repertoire-profiler.kind";
import { kind } from "@platforma-open/milaboratories.synthetic-repertoire-profiler.kind";
import type { PatternParts, UmiSpec } from "./pattern";
import { parsePattern, patternUmiSpec } from "./pattern";

export { parsePattern, patternHasUmi, patternUmiSpec } from "./pattern";
export type { LengthRange, PatternHalf, PatternParts, UmiSpec } from "./pattern";

// The parent-input and region shapes are part of the kind's init-params
// contract, so the kind declares them. Re-exported here because the UI reads
// them from the model, and only the model is on its import path.
export type { ParentInputMode, ParentRegionConfig, RegionDef, RegionScheme };

/** mitool emits progress lines `[==PROGRESS==]<stage>: <pct>%  ETA: <eta>`. */
export const ProgressPrefix = "[==PROGRESS==]";
export const ProgressPattern =
  /(?<stage>[^:]*):(?: *(?<progress>[0-9.]+)%)?(?: *ETA: *(?<eta>.+))?/;

/** A column discovered in a known-set TSV: its header and the value type
 *  inferred from a sample of its values. */
export type KnownColumnInfo = {
  header: string;
  type: "Int" | "Double" | "String";
};

/** The conventional VDJ V-domain partition (FR/CDR), in order. The editor seeds the
 *  `vdj` scheme from this list; it is not a constraint. An engineered V-domain may
 *  insert a region between two of these, put one in place of another, or rename one —
 *  an engineered scaffold carrying a grafted insert does all three. */
export const VDJ_REGION_NAMES = ["FR1", "CDR1", "FR2", "CDR2", "FR3", "CDR3", "FR4"] as const;

const FEATURE_NAME_RE = /^[A-Za-z0-9_]+$/;

/** A resolved span in the parent's own nucleotide frame. `children`, when present,
 *  tile the span exactly; their offsets are absolute in the same frame, so every span
 *  in the overlay is read the same way. */
type Span = { name: string; begin: number; end: number; children?: Span[] };

/** Builds the `--parent-regions` overlay JSON (offsets cumulative from region
 *  lengths) consumed by mitool and re-parsed by the workflow. Returns undefined
 *  when nothing is configured. Throws on an invalid partition. */
export function buildParentRegionsJson(
  configs: ParentRegionConfig[] | undefined,
): string | undefined {
  const parents: Record<
    string,
    {
      scheme: RegionScheme;
      completeFeatureName?: string;
      regions: Span[];
    }
  > = {};
  for (const c of configs ?? []) {
    const af = c.completeFeatureName?.trim() || undefined;
    if (c.scheme === "none" && !af) continue; // nothing to carry for this parent
    if (af && !FEATURE_NAME_RE.test(af))
      throw new Error(`Complete feature name '${af}' must be alphanumeric/underscore.`);

    // Name and length are checked identically at either level — a sub-region is an
    // ordinary span that happens to sit inside another.
    const checked = (r: RegionDef): string => {
      const name = r.name.trim();
      if (c.scheme !== "none") {
        if (!FEATURE_NAME_RE.test(name))
          throw new Error(
            `Region name '${r.name}' (parent ${c.parentId}) must be alphanumeric/underscore.`,
          );
        if (!Number.isInteger(r.length) || r.length <= 0)
          throw new Error(`Region '${name}' (parent ${c.parentId}) needs a positive length.`);
      }
      return name;
    };

    let pos = 0;
    const regions: Span[] = c.regions.map((r) => {
      const name = checked(r);
      const begin = pos;
      pos += r.length;
      const end = pos;
      if (!r.children?.length) return { name, begin, end };

      // Sub-regions run on the same cumulative rule, seeded at their region's begin.
      // Tiling then reduces to one check: the lengths must add up to the region's own.
      let childPos = begin;
      const children: Span[] = r.children.map((child) => {
        const childName = checked(child);
        const childBegin = childPos;
        childPos += child.length;
        return { name: childName, begin: childBegin, end: childPos };
      });
      if (childPos !== end)
        throw new Error(
          `Sub-regions of '${name}' (parent ${c.parentId}) must tile it exactly: they total ` +
            `${childPos - begin} nt, but '${name}' is ${end - begin} nt.`,
        );
      return { name, begin, end, children };
    });

    // `vdj` and `custom` both carry a free region list, so both need at least one region.
    // (`none` reaches here only to carry a complete feature name, and has no regions.)
    // mitool rejects an empty list too; catching it here puts the error in the settings
    // panel instead of at run time.
    if (c.scheme !== "none" && regions.length === 0)
      throw new Error(`Scheme '${c.scheme}' (parent ${c.parentId}) needs at least one region.`);
    // One namespace across the whole parent: every name becomes an output column id.
    const names = regions.flatMap((r) => [r.name, ...(r.children?.map((ch) => ch.name) ?? [])]);
    if (new Set(names).size !== names.length)
      throw new Error(`Region names must be unique within parent ${c.parentId}.`);

    parents[c.parentId] = {
      scheme: c.scheme,
      completeFeatureName: af,
      regions: c.scheme === "none" ? [] : regions,
    };
  }
  return Object.keys(parents).length === 0 ? undefined : JSON.stringify({ version: 1, parents });
}

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

  // mitool tag pattern: insert capture (R1/R2) + optional UMI. UMI presence and layout
  // are derived by parsing this string — see patternUmiSpec.
  tagPattern?: string;

  // Parents (alignment references) — FASTA, two modes.
  parentInputMode: ParentInputMode;
  parentSequence?: string; // fastaSequence: pasted FASTA
  parentFileHandle?: ImportFileHandle; // fastaFile: uploaded FASTA

  // Optional per-parent region schemes (FR/CDR or custom), keyed by parent id.
  // Empty/absent = no regions (today's behaviour). Projected to the
  // `--parent-regions` overlay JSON in args. Ignored while `vdjAutoDetect` is on.
  parentRegions?: ParentRegionConfig[];

  // Whole-dataset germline auto-annotation. When true, EVERY parent is treated as
  // a VDJ V-domain and its FR1–FR4 boundaries are inferred from germline in the
  // workflow (repseqio) — the manual per-parent region editor is hidden and
  // `parentRegions` is not projected. All-or-nothing; no mixing with manual schemes.
  vdjAutoDetect?: boolean;

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

  // Restrict the exported variant repertoire to variants that matched a known
  // entry. Only meaningful when a known set (nt and/or aa) is supplied; the UI
  // shows the checkbox only then. `undefined` = the default, which is OFF (the
  // user opts in). When ON, the whole exported `variants` frame is filtered per
  // level — nt keeps `assignStatus == ASSIGNED`, aa keeps variants carrying a
  // `knownAaKey`. A level with no match signal (e.g. nt with only an aa set)
  // exports empty.
  exportOnlyKnown?: boolean;

  // Opt-in nucleotide-level export; OFF by default. When on, the workflow emits
  // the nt state matrix and exports every nt-related column (nt variants,
  // per-sample nt abundance, nt sequences, parent→nt + nt↔aa linkers, and the nt
  // known-set overlay) into the downstream `variants` frame. When off, only the
  // amino-acid level is exported. (Was `ntStateMatrix`, which only toggled the nt
  // state matrix — migrated forward below.)
  exportNt: boolean;

  // Optional per-fragment mutation-load filter (Advanced). Applied by mitool's
  // align step (AlignParams.filter, via -Malign.filter.*): a fragment whose
  // alignment to the parent carries more mutations than allowed is rejected as a
  // likely misalignment / off-target read. Empty = mitool default (off). Both may
  // be set; mitool applies each gate independently.
  maxMutations?: number; // reject if the alignment has more than this many mutations (edit ops)
  maxMutationFraction?: number; // reject if mutations / parentLength exceeds this (0 < f ≤ 1)

  // "Substitutions only" (Advanced). Also an align-step filter, but a checkbox
  // rather than a number: the user's intent is a mode, not a budget. The args
  // lambda projects it to mitool's -Malign.filter.maxIndels=0, which rejects any
  // FRAGMENT whose alignment carries an insertion or deletion — so an
  // indel-bearing variant never forms and neither export level can carry one.
  // `undefined` = off (mitool's default of -1). Note the rejection is per read,
  // so reads whose only indel is a basecalling error are dropped too, and the
  // frame-shift counts fall to near zero because those reads never reach
  // assembly — they are counted among the alignment outcomes instead.
  substitutionsOnly?: boolean;

  // Optional per-variant amino-acid mutation-load filter (Advanced). Applied by
  // mitool's call-mutations step (CallMutationsParams, via -Mcall-mutations.*):
  // an in-frame variant whose aa-mutation count (aaMutations edit ops vs the
  // aa-translated parent) exceeds the gate is dropped. Empty = mitool default
  // (off). Both may be set; mitool applies each gate independently.
  maxAaMutations?: number; // reject if the aa alignment has more than this many mutations (edit ops)
  maxAaMutationFraction?: number; // reject if aaMutations / aaParentLength exceeds this (0 < f ≤ 1)

  // minBaseQuality → align step (AlignParams.filter): reject a fragment if ANY
  // read base inside the parent-covered span is below this Phred. Bases outside
  // the span (overhang, adapter tails) are ignored.
  minBaseQuality?: number;
  // minVariantQuality → assemble step (AssembleParams): drop a variant whose
  // aggregated per-position quality dips below this Phred at ANY position.
  minVariantQuality?: number;

  // UMI consensus settings, used and required only when the tag pattern carries a UMI.
  minReadsPerConsensus?: number; // consensus -O minRecordsPerConsensus
  minUmiQuality?: number; // refine-tags -q

  // Optional per-sample mitool resource overrides (Advanced). Empty = workflow
  // defaults. Passed to the parse + analyze exec steps.
  perProcessMemGB?: number;
  perProcessCPUs?: number;

  // Per-page table grid state (sort, column visibility, etc.).
  qcTableState: PlDataTableStateV2;
  knownVariantsNtTableState: PlDataTableStateV2;
  knownVariantsAaTableState: PlDataTableStateV2;
  graphStateMutationHistogram: GraphMakerState;
  graphStateStateHeatmap: GraphMakerState;
};

/** Workflow-facing args projected from `BlockData` by `.args(...)`. */
export type BlockArgs = {
  input: PlRef;
  tagPattern: string;
  patternParts: PatternParts;
  // Absent when the pattern has no UMI; its presence switches the UMI chain on.
  umi?: UmiSpec;
  minReadsPerConsensus?: number;
  minUmiQuality?: number;
  parentInputMode: ParentInputMode;
  parentSequence?: string;
  parentFileHandle?: ImportFileHandle;
  // `--parent-regions` overlay JSON (built from parentRegions); absent = none.
  // Suppressed (undefined) when vdjAutoDetect is on — the workflow builds the
  // overlay from germline inference instead.
  parentRegionsJson?: string;
  // Whole-dataset germline auto-annotation. When true, the workflow infers every
  // parent's FR1–FR4 from germline (repseqio) and builds the `--parent-regions`
  // overlay itself. Absent/false = use the manual `parentRegionsJson`.
  vdjAutoDetect?: boolean;
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
  // When true, the workflow restricts the exported `variants` frame to variants
  // that matched a known entry (nt: assignStatus == ASSIGNED; aa: has knownAaKey).
  // False when no known set is supplied (nothing to match against).
  exportOnlyKnown: boolean;
  exportNt: boolean;
  // Mutation-load filter → mitool -Malign.filter.maxMutations / maxMutationFraction.
  maxMutations?: number;
  maxMutationFraction?: number;
  // Indel gate → mitool -Malign.filter.maxIndels. 0 = substitutions only; absent = off.
  maxIndels?: number;
  // AA mutation-load filter → mitool -Mcall-mutations.maxAaMutations / maxAaMutationFraction.
  maxAaMutations?: number;
  maxAaMutationFraction?: number;
  // Quality gates → mitool -Malign.filter.minBaseQuality / -Massemble.minVariantQuality.
  // Absent = mitool defaults (5 / 20), which are ON — not off.
  minBaseQuality?: number;
  minVariantQuality?: number;
  perProcessMemGB?: number;
  perProcessCPUs?: number;
  defaultBlockLabel: string;
  customBlockLabel: string;
};

/** v1 data shape: the toggle was `ntStateMatrix` (nt state matrix only). v2
 *  renames it to `exportNt` (governs all nt export). */
type BlockDataV1 = Omit<BlockDataV2, "exportNt"> & { ntStateMatrix: boolean };

type BlockDataV2 = Omit<BlockDataV3, "graphStateMutationHistogram">;

type BlockDataV3 = Omit<BlockDataV4, "graphStateStateHeatmap">;
type BlockDataV4 = Omit<BlockData, "minReadsPerConsensus" | "minUmiQuality">;

const DEFAULT_MUTATION_HISTOGRAM_GRAPH_STATE: GraphMakerState = {
  title: "Mutation Distribution",
  template: "bar",
  currentTab: null,
  layersSettings: {
    // A fixed fill is what disables the colouring: left unset, graph-maker maps
    // fill to the primary grouping (here the mutation count) and colours every bar.
    bar: { fillColor: "#99e099" },
  },
};

const DEFAULT_STATE_HEATMAP_GRAPH_STATE: GraphMakerState = {
  // Fuller than the sidebar label ("Residue Composition"): this one shows on the
  // chart itself and in exports, where "per-position" is what stops a pooled
  // marginal being read as a per-mutation effect map.
  title: "Per-position residue composition",
  template: "heatmap",
  currentTab: null,
  // GraphMaker defaults heatmaps to row z-score (standardScaling), turning cells
  // below their row mean negative. The default view is the per-position residue
  // frequency computed in the workflow, on a linear 0–1 scale, so disable
  // GraphMaker's own normalization and transform.
  layersSettings: {
    heatmap: {
      normalizationDirection: null,
      transform: null,
    },
  },
  // Show the Y (residue) axis labels, and pin both cell dimensions so cells stay
  // square and labelled: the residue alphabet is large (single residues plus
  // multi-residue insertions and the gap), and a long parent compresses the
  // position axis to slivers. The chart grows and scrolls instead. Users can
  // override live via the chart's Axes settings.
  axesSettings: {
    axisX: {
      cellSize: 20,
    },
    axisY: {
      hideAxisLabels: false,
      cellSize: 20,
    },
  },
};

const dataModel = new DataModelBuilder({ kind })
  .from<BlockDataV1>("v1")
  .migrate<BlockDataV2>("v2", ({ ntStateMatrix, ...rest }) => ({
    ...rest,
    exportNt: ntStateMatrix ?? false,
  }))
  // New fields must come as a NEW step: editing a deployed migration body has no
  // effect on projects already tagged with that version.
  .migrate<BlockDataV3>("v3", (v2) => ({
    ...v2,
    graphStateMutationHistogram: { ...DEFAULT_MUTATION_HISTOGRAM_GRAPH_STATE },
  }))
  .migrate<BlockDataV4>("v4", (v3) => ({
    ...v3,
    graphStateStateHeatmap: { ...DEFAULT_STATE_HEATMAP_GRAPH_STATE },
  }))
  .migrate<BlockData>("v5", (v4) => ({
    ...v4,
    ...UMI_DEFAULTS,
  }))
  // The first group of fields is the kind's init-params contract, field for
  // field, and
  // `.templateParams(...)` below projects those same fields back out. `params` is
  // optional — a block may be created without a template — so every field keeps
  // its own default.
  .init(({ params }) => ({
    // Paired-end default; the UI refits it to the dataset's read structure when a
    // dataset is picked (see onSelectInput in SettingsPanel).
    tagPattern: params?.tagPattern ?? DEFAULT_TAG_PATTERN_PAIRED,
    parentInputMode: params?.parentInputMode ?? "fastaSequence",
    parentSequence: params?.parentSequence,
    parentRegions: params?.parentRegions,
    vdjAutoDetect: params?.vdjAutoDetect ?? false,
    exportNt: params?.exportNt ?? false,
    exportOnlyKnown: params?.exportOnlyKnown,
    maxMutations: params?.maxMutations,
    maxMutationFraction: params?.maxMutationFraction,
    substitutionsOnly: params?.substitutionsOnly,
    maxAaMutations: params?.maxAaMutations,
    maxAaMutationFraction: params?.maxAaMutationFraction,
    minBaseQuality: params?.minBaseQuality,
    minVariantQuality: params?.minVariantQuality,
    minReadsPerConsensus: params?.minReadsPerConsensus ?? UMI_DEFAULTS.minReadsPerConsensus,
    minUmiQuality: params?.minUmiQuality ?? UMI_DEFAULTS.minUmiQuality,
    perProcessMemGB: params?.perProcessMemGB,
    perProcessCPUs: params?.perProcessCPUs,

    // Not init params: uploaded files, what the UI discovers by reading them, and
    // view state. See the kind for why each group stays out of the contract.
    defaultBlockLabel: "",
    knownNtMetadataColumns: [],
    knownAaMetadataColumns: [],
    qcTableState: createPlDataTableStateV2(),
    knownVariantsNtTableState: createPlDataTableStateV2(),
    knownVariantsAaTableState: createPlDataTableStateV2(),
    graphStateMutationHistogram: { ...DEFAULT_MUTATION_HISTOGRAM_GRAPH_STATE },
    graphStateStateHeatmap: { ...DEFAULT_STATE_HEATMAP_GRAPH_STATE },
  }));

const DNA_IUPAC_RE = /^[ACGTacgtMKRYWSBDHVNmkrywsbdhvn]*$/;

/** Trace-label fallback when neither a custom label nor a dataset name is set. */
const DEFAULT_BLOCK_LABEL = "Amplicon Profiling";

/** milib's `SequenceQuality.MAX_QUALITY_VALUE` — the ceiling for both quality
 *  gates. A threshold above it can never be met, so nothing would pass. */
export const MAX_PHRED_QUALITY = 58;

const UMI_DEFAULTS = { minReadsPerConsensus: 2, minUmiQuality: 20 } as const;

/** Below this a barcode cannot be told apart from a 1-error neighbour of another. */
const MIN_UMI_LENGTH = 8;

/** The `BlockData` fields [validateUmiSettings] reads. */
export type UmiSettings = Pick<BlockData, "minReadsPerConsensus" | "minUmiQuality">;

/**
 * What is wrong with a tag pattern, or undefined. Shown on the tag-pattern field, and
 * re-checked by `.args(...)` so the field and the run gate cannot disagree.
 */
export function tagPatternError(tagPattern: string | undefined): string | undefined {
  const canonical = (tagPattern ?? "").replace(/\s+/g, "");
  if (canonical === "") return "Tag pattern is required.";

  const parts = parsePattern(canonical);
  if (!parts)
    return (
      "Tag pattern is invalid. Each read must have the shape " +
      "^[*][(UMI:N{min[:max]})][leftAnchor](R1:*|N{n}|N{min:max})[rightAnchor][>{trim}]*. " +
      "UMI captures are optional; the insert (R) capture marks the region aligned to the " +
      "parent. UMI tags are named UMI, UMI1, …; insert tags R1, R2, …. All defined tag " +
      "names must be unique."
    );

  // At least one half must capture an insert — the region aligned to the parent. The
  // insert may be variable-length (`*`); the alignment bounds it, not a fixed length.
  if (parts.r1.insertName === undefined && parts.r2?.insertName === undefined)
    return "Pattern must capture an insert (R1 or R2) to align against the parent.";

  const halves = parts.r2 ? [parts.r1, parts.r2] : [parts.r1];
  for (const half of halves)
    for (const anchor of [half.leftAnchor, half.rightAnchor])
      if (anchor && !DNA_IUPAC_RE.test(anchor))
        return (
          "Anchor sequences must use DNA letters or IUPAC codes only " +
          "(A, C, G, T, M, K, R, Y, W, S, B, D, H, V, N — upper or lower case)."
        );

  const umi = patternUmiSpec(parts);
  if (umi?.ranged)
    return (
      "UMI captures must have a fixed length (N{n}), not a range (N{min:max}) — " +
      "a variable-length barcode cannot identify a molecule."
    );
  if (umi && umi.totalLength < MIN_UMI_LENGTH)
    return (
      `A UMI of ${umi.totalLength} nt is too short to identify molecules; ` +
      `use at least ${MIN_UMI_LENGTH} nt in total across both reads.`
    );

  return undefined;
}

/** Throws when a UMI declaration or its consensus settings cannot produce a molecule count. */
export function validateUmiSettings(s: UmiSettings): void {
  const missing: string[] = [];
  if (s.minReadsPerConsensus === undefined) missing.push("Min reads per UMI");
  if (s.minUmiQuality === undefined) missing.push("Min UMI quality");
  if (missing.length > 0)
    throw new Error(`Set the molecule consensus settings under Barcodes: ${missing.join(", ")}.`);

  if (!Number.isInteger(s.minReadsPerConsensus) || s.minReadsPerConsensus! < 1)
    throw new Error("Min reads per UMI must be a positive integer.");
  if (
    !Number.isInteger(s.minUmiQuality) ||
    s.minUmiQuality! < 0 ||
    s.minUmiQuality! > MAX_PHRED_QUALITY
  )
    throw new Error(`Min UMI quality must be an integer between 0 and ${MAX_PHRED_QUALITY}.`);
}

/** Shown as the block subtitle before a dataset is picked. */
const NO_DATASET_LABEL = "Select dataset";

/** Default tag patterns; `\` separates the two read halves. */
export const DEFAULT_TAG_PATTERN_PAIRED = "^(R1:*)\\^(R2:*)";
export const DEFAULT_TAG_PATTERN_SINGLE = "^(R1:*)";

/** True while the pattern is untouched (empty or one of the defaults) — the guard
 *  that keeps the auto-fit from overwriting a pattern the user edited. */
export function isDefaultTagPattern(pattern: string | undefined): boolean {
  const p = (pattern ?? "").replace(/\s+/g, "");
  return p === "" || p === DEFAULT_TAG_PATTERN_PAIRED || p === DEFAULT_TAG_PATTERN_SINGLE;
}

export function plRefKey(ref: PlRef): string {
  return `${ref.blockId}/${ref.name}`;
}

/** Paired-end? true = the readIndex axis lists R2; false = no readIndex axis at
 *  all, i.e. one file per sample; undefined = axis present but readIndices
 *  unreadable, so the structure is unknown and callers must not guess. */
function specIsPairedEnd(spec: PObjectSpec): boolean | undefined {
  if (!isPColumnSpec(spec)) return undefined;
  const axis = spec.axesSpec.find((a) => a.name === "pl7.app/sequencing/readIndex");
  if (axis === undefined) return false;
  const raw = axis.domain?.["pl7.app/readIndices"];
  if (typeof raw !== "string") return undefined;
  try {
    const indices = JSON.parse(raw);
    return Array.isArray(indices) && indices.includes("R2");
  } catch {
    return undefined;
  }
}

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

export const platforma = BlockModelV3.create({ dataModel, kind })

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

  // Must not be written back into data — that loop would be a hairpin.
  .output("inputIsPairedEnd", (ctx): boolean | undefined => {
    const inputRef = ctx.data.input;
    if (inputRef === undefined) return undefined;
    const inputSpec = ctx.resultPool.getPColumnSpecByRef(inputRef);
    if (inputSpec === undefined) return undefined;
    return specIsPairedEnd(inputSpec);
  })

  // Keyed by ref because `inputIsPairedEnd` derives from `data.input`, and so still
  // describes the previous dataset while a selection handler runs.
  .output("inputPairedEndByRef", (ctx): Record<string, boolean> | undefined => {
    const options = ctx.resultPool.getOptions(isFastqInput);
    if (options === undefined) return undefined;
    const byRef: Record<string, boolean> = {};
    for (const o of options) {
      const spec = ctx.resultPool.getPColumnSpecByRef(o.ref);
      const paired = spec === undefined ? undefined : specIsPairedEnd(spec);
      if (paired !== undefined) byRef[plRefKey(o.ref)] = paired;
    }
    return byRef;
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

  // Uploaded parent FASTA bytes for the region editor (parent-id discovery +
  // length preview). Same prerun-export + ReactiveFileContent path as the known
  // sets; the pasted-FASTA mode reads `data.parentSequence` directly instead.
  .output("parentFileContent", (ctx) =>
    ctx.prerun
      ?.resolve({ field: "parentFile", assertFieldType: "Input", allowPermanentAbsence: true })
      ?.getFileHandle(),
  )

  // Known-set file handles (content-readable) for the UI's column-mapping
  // discovery. The prerun exports the imported file; the UI reads its bytes via
  // ReactiveFileContent (remote files) — local files are read straight off disk.
  .output("knownNtFileContent", (ctx) =>
    ctx.prerun
      ?.resolve({ field: "knownNtFile", assertFieldType: "Input", allowPermanentAbsence: true })
      ?.getFileHandle(),
  )

  .output("knownAaFileContent", (ctx) =>
    ctx.prerun
      ?.resolve({ field: "knownAaFile", assertFieldType: "Input", allowPermanentAbsence: true })
      ?.getFileHandle(),
  )

  // Per-step log handles, keyed [sampleId, step].
  //
  // Resolved with allowPermanentAbsence because this field did not exist before block
  // 1.2.9: the workflow emitted `logs` and 1.2.9 renamed it to `stepLogs`. A project
  // computed under 1.2.8 therefore has outputs with no `stepLogs` field at all, and the
  // throwing form of resolve() failed the whole model render — every output, not just
  // this one — leaving the upgraded block unusable until it was re-run. Absent reads as
  // undefined instead, so the Logs and Progress views are simply empty until the user
  // re-runs, which the upgrade already makes them do.
  //
  // allowPermanentAbsence is only honoured alongside assertFieldType (see
  // CommonFieldTraverseOps), hence "Input" here, matching the other tolerant resolves.
  .output("stepLogs", (ctx) => {
    const acc = ctx.outputs?.resolve({
      field: "stepLogs",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    });
    return acc !== undefined ? parseResourceMap(acc, (a) => a.getLogHandle(), false) : undefined;
  })

  // Per-step progress, keyed [sampleId, step]. `WithInfo` adds the `live` flag, which
  // separates a running step from one whose log froze at its last marker.
  // Same pre-1.2.9 absence as stepLogs above — it reads the same field.
  .output("stepProgress", (ctx) => {
    const acc = ctx.outputs?.resolve({
      field: "stepLogs",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    });
    return acc !== undefined
      ? parseResourceMap(
          acc,
          (a) => a.getProgressLogWithInfo(ProgressPrefix),
          // A step that has started but printed no marker yet must still appear.
          true,
        )
      : undefined;
  })

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

  // Known-variant tables (only when the matching known set ran). Plain tables
  // keyed [knownVariantKey], no anchor → V2. The NT table lists EVERY designed nt
  // entry (id + sequence + metadata), with matched abundance where detected and
  // blank abundance for undetected designed entries — matched and unmatched in
  // one view.
  .outputWithStatus("knownVariantsNtTable", (ctx) => {
    const pCols = ctx.outputs
      ?.resolve({ field: "knownVariantsNt", assertFieldType: "Input", allowPermanentAbsence: true })
      ?.getPColumns();
    if (pCols === undefined) return undefined;
    return createPlDataTableV2(ctx, pCols, ctx.data.knownVariantsNtTableState);
  })

  // Upstream single-axis sample metadata is added so the plot can facet by sample
  // group, not just by sample.
  .outputWithStatus("mutationHistogramPf", (ctx): PFrameHandle | undefined => {
    const pCols = ctx.outputs
      ?.resolve({
        field: "mutationHistogram",
        assertFieldType: "Input",
        allowPermanentAbsence: true,
      })
      ?.getPColumns();
    if (pCols === undefined) return undefined;
    const inputRef = ctx.data.input;
    // `createPFrameForGraphs` would walk the result pool and pull in this block's
    // own `variants` export, state matrix included, filling the picker with junk.
    const sampleMeta =
      inputRef !== undefined
        ? (ctx.resultPool.getAnchoredPColumns({ main: inputRef }, [
            { axes: [{ anchor: "main", idx: 0 }] },
          ]) ?? [])
        : [];
    return ctx.createPFrame([...pCols, ...sampleMeta]);
  })

  // The page's default axis mapping picks from these — own columns only, no
  // upstream metadata.
  .output("mutationHistogramPCols", (ctx): PColumnIdAndSpec[] | undefined =>
    ctx.outputs
      ?.resolve({
        field: "mutationHistogram",
        assertFieldType: "Input",
        allowPermanentAbsence: true,
      })
      ?.getPColumns()
      ?.map((c) => ({ columnId: c.id, spec: c.spec }) satisfies PColumnIdAndSpec),
  )

  // Per-position residue composition heat map. Own columns only — the frame is
  // self-contained (cells plus the parent-residue and region tracks, all keyed on
  // [parentId, position]), and `createPFrameForGraphs` would walk the result pool
  // and pull this block's own `variants` export in, state matrix included.
  .outputWithStatus("stateHeatmapPf", (ctx): PFrameHandle | undefined => {
    const pCols = ctx.outputs
      ?.resolve({ field: "stateHeatmap", assertFieldType: "Input", allowPermanentAbsence: true })
      ?.getPColumns();
    if (pCols === undefined) return undefined;
    return ctx.createPFrame(pCols);
  })

  // Drives the page's default axis mapping, and the parent enumeration that
  // decides whether parentId becomes a grouping or a set of tabs.
  .output("stateHeatmapPCols", (ctx): PColumnIdAndSpec[] | undefined =>
    ctx.outputs
      ?.resolve({ field: "stateHeatmap", assertFieldType: "Input", allowPermanentAbsence: true })
      ?.getPColumns()
      ?.map((c) => ({ columnId: c.id, spec: c.spec }) satisfies PColumnIdAndSpec),
  )

  .outputWithStatus("knownVariantsAaTable", (ctx) => {
    const pCols = ctx.outputs
      ?.resolve({ field: "knownVariantsAa", assertFieldType: "Input", allowPermanentAbsence: true })
      ?.getPColumns();
    if (pCols === undefined) return undefined;
    return createPlDataTableV2(ctx, pCols, ctx.data.knownVariantsAaTableState);
  })

  .args<BlockArgs>((data) => {
    if (!data.input) throw new Error("Input dataset (FASTQ) is required");

    const patternError = tagPatternError(data.tagPattern);
    if (patternError) throw new Error(patternError);
    const tagPattern = data.tagPattern!.replace(/\s+/g, ""); // canonicalize
    const patternParts = parsePattern(tagPattern)!;
    const umi = patternUmiSpec(patternParts);
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

    // A known set (nt and/or aa) is what "export only matched" filters against.
    const hasKnownSet = !!(data.knownNtFileHandle || data.knownAaFileHandle);

    // Mutation-load filter (Advanced): positive when set (empty = mitool default,
    // off). maxMutations counts alignment edit ops (positive integer);
    // maxMutationFraction is mutations / parentLength (0 < f ≤ 1). Both feed
    // mitool's align-step filter. Normalize null → undefined first: a cleared
    // PlNumberField can rehydrate as null, which must read as "not set" — both for
    // validation and so a cleared field projects identically to a never-set one
    // (else the staleness gate fires on an edit that changes nothing).
    const maxMutations = data.maxMutations ?? undefined;
    const maxMutationFraction = data.maxMutationFraction ?? undefined;
    if (maxMutations !== undefined && (!Number.isInteger(maxMutations) || maxMutations < 1))
      throw new Error("Max mutations must be a positive integer.");
    if (maxMutationFraction !== undefined && (maxMutationFraction <= 0 || maxMutationFraction > 1))
      throw new Error("Max mutation fraction must be between 0 and 1.");

    // "Substitutions only" is a mode in `data` and a budget in `args`: the checkbox
    // becomes mitool's maxIndels=0. Projected as undefined when off so an
    // untouched block sends no mixin at all, leaving mitool's default (-1) —
    // and so toggling on then off returns the args to their previous bytes.
    const maxIndels = data.substitutionsOnly === true ? 0 : undefined;

    // AA mutation-load filter (Advanced): aa-level analog of the above, applied
    // by mitool's call-mutations step. Same null → undefined normalization and
    // positivity/range gates. maxAaMutations counts aa edit ops (positive
    // integer); maxAaMutationFraction is aaMutations / aaParentLength (0 < f ≤ 1).
    const maxAaMutations = data.maxAaMutations ?? undefined;
    const maxAaMutationFraction = data.maxAaMutationFraction ?? undefined;
    if (maxAaMutations !== undefined && (!Number.isInteger(maxAaMutations) || maxAaMutations < 1))
      throw new Error("Max amino-acid mutations must be a positive integer.");
    if (
      maxAaMutationFraction !== undefined &&
      (maxAaMutationFraction <= 0 || maxAaMutationFraction > 1)
    )
      throw new Error("Max amino-acid mutation fraction must be between 0 and 1.");

    // Quality gates (Advanced): same null → undefined normalization as above, but
    // note the different "empty" semantics — these are ON at mitool's defaults
    // (5 / 20) when absent, so empty is not "no filtering". 0 is the way to
    // disable (a 0 threshold accepts everything, Phred being non-negative), which
    // is why the floor here is 0 and not 1. The ceiling is milib's
    // MAX_QUALITY_VALUE (58): above it, nothing can ever pass.
    const minBaseQuality = data.minBaseQuality ?? undefined;
    const minVariantQuality = data.minVariantQuality ?? undefined;
    const checkQuality = (v: number | undefined, label: string) => {
      if (v === undefined) return;
      if (!Number.isInteger(v) || v < 0 || v > MAX_PHRED_QUALITY)
        throw new Error(`${label} must be an integer between 0 and ${MAX_PHRED_QUALITY}.`);
    };
    checkQuality(minBaseQuality, "Min base quality");
    checkQuality(minVariantQuality, "Min variant quality");

    if (umi) validateUmiSettings(data);

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
      umi,
      // Suppressed without a UMI so the staleness gate ignores them on a non-UMI run.
      minReadsPerConsensus: umi ? data.minReadsPerConsensus : undefined,
      minUmiQuality: umi ? data.minUmiQuality : undefined,
      parentInputMode: data.parentInputMode,
      // Suppress the inactive mode's field so the staleness gate ignores it.
      parentSequence: data.parentInputMode === "fastaSequence" ? data.parentSequence : undefined,
      parentFileHandle: data.parentInputMode === "fastaFile" ? data.parentFileHandle : undefined,
      // vdjAutoDetect overrides the manual overlay: the workflow infers all parents'
      // regions from germline, so the manual parentRegions projection is suppressed.
      parentRegionsJson: data.vdjAutoDetect
        ? undefined
        : buildParentRegionsJson(data.parentRegions),
      vdjAutoDetect: data.vdjAutoDetect ? true : undefined,
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
      // Export-only-matched: OFF by default (the user opts in via the checkbox,
      // shown only when a known set is present). Forced false when no known set.
      exportOnlyKnown: hasKnownSet ? (data.exportOnlyKnown ?? false) : false,
      exportNt: data.exportNt,
      maxMutations,
      maxMutationFraction,
      maxIndels,
      maxAaMutations,
      maxAaMutationFraction,
      minBaseQuality,
      minVariantQuality,
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

  // The inverse of `init` above: the same fields, so a project exported as a
  // template and re-applied comes back with the run recipe it went out with.
  .templateParams((data) => ({
    tagPattern: data.tagPattern,
    parentInputMode: data.parentInputMode,
    parentSequence: data.parentSequence,
    parentRegions: data.parentRegions,
    vdjAutoDetect: data.vdjAutoDetect,
    exportNt: data.exportNt,
    exportOnlyKnown: data.exportOnlyKnown,
    maxMutations: data.maxMutations,
    maxMutationFraction: data.maxMutationFraction,
    substitutionsOnly: data.substitutionsOnly,
    maxAaMutations: data.maxAaMutations,
    maxAaMutationFraction: data.maxAaMutationFraction,
    minBaseQuality: data.minBaseQuality,
    minVariantQuality: data.minVariantQuality,
    minReadsPerConsensus: data.minReadsPerConsensus,
    minUmiQuality: data.minUmiQuality,
    perProcessMemGB: data.perProcessMemGB,
    perProcessCPUs: data.perProcessCPUs,
  }))

  .sections((ctx) => {
    const items: {
      type: "link";
      href:
        | "/"
        | "/qc"
        | "/mutation-histogram"
        | "/state-heatmap"
        | "/known-variants-nt"
        | "/known-variants-aa";
      label: string;
    }[] = [
      { type: "link", href: "/", label: "Main" },
      { type: "link", href: "/qc", label: "QC Report" },
      // Always listed: each plot's empty state carries its own call to action.
      { type: "link", href: "/mutation-histogram", label: "Mutation Distribution" },
      { type: "link", href: "/state-heatmap", label: "Residue Composition" },
    ];
    // NT known analysis runs only with an nt known set (--known); aa known
    // analysis runs with an aa set (--known-aa) or is derived from the nt set.
    // The NT page shows all designed nt entries (matched + undetected) in one table.
    if (ctx.data.knownNtFileHandle !== undefined)
      items.push({ type: "link", href: "/known-variants-nt", label: "Known Variants (NT)" });
    if (ctx.data.knownNtFileHandle !== undefined || ctx.data.knownAaFileHandle !== undefined)
      items.push({ type: "link", href: "/known-variants-aa", label: "Known Variants (AA)" });
    return items;
  })

  .title(() => "Amplicon Profiling")

  // Subtitle: custom label if the user set one, else the selected dataset's
  // name (snapshotted into data by the UI on selection), else a prompt. The
  // subtitle context is args-only — it can't resolve the dataset label live —
  // so the name must already be persisted in data here.
  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel || NO_DATASET_LABEL)

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
