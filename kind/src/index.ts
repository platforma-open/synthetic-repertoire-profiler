import { assertParamsObject, defineBlockKind } from "@platforma-sdk/block-kind";
import { name, version } from "../package.json" with { type: "json" };

/** How the user supplies the parent (alignment-reference) sequences. Both modes
 *  carry FASTA — paste a string, or upload a file. */
export type ParentInputMode = "fastaSequence" | "fastaFile";

/** Per-parent region scheme. `none` = no regions (default); `vdj` = a V-domain
 *  (antibody/TCR), seeded from the FR1→FR4 partition but free to insert, replace or
 *  rename a region for an engineered scaffold; `custom` = arbitrary named regions.
 *  Only `vdj` declares the run's modality as VDJ. */
export type RegionScheme = "none" | "vdj" | "custom";

/** A region in a parent's partition: a name + nucleotide length. Boundary
 *  offsets are derived cumulatively from the lengths (region-first entry).
 *
 *  A region may be tiled by `children` — sub-regions that partition it exactly, so a
 *  graft inside a canonical region (an insert sitting inside CDR2) can be named without
 *  splitting that region away. Nesting is two levels: a child carries none of its own.
 *  Absent or empty = an undivided region, which is how every partition written before
 *  this field existed reads. */
export type RegionDef = { name: string; length: number; children?: RegionDef[] };

/** Per-parent region scheme, keyed by the parent's FASTA id. */
export type ParentRegionConfig = {
  parentId: string;
  scheme: RegionScheme;
  /** Optional name for the whole-variant feature (e.g. `VDJRegion`). */
  completeFeatureName?: string;
  regions: RegionDef[];
};

/**
 * This block's init-params contract — what a creator or a project template
 * supplies to seed a new instance. A subset of the model's `BlockData`.
 *
 * The subset is the run recipe: the tag pattern, the parent (reference) setup,
 * the export toggles, the mutation and quality gates, and the per-process
 * resource overrides. A lab that re-profiles the same designed library run after
 * run can pin all of that in a template and only pick the dataset afterwards.
 *
 * Three groups of `BlockData` fields are deliberately left out.
 *
 * - **Uploaded files.** `parentFileHandle`, `knownNtFileHandle` and
 *   `knownAaFileHandle` are `ImportFileHandle`s — each names a blob in one
 *   project's storage and means nothing in another, so no template can carry
 *   one. `parentInputMode` is still a param: a template may say "the parents
 *   arrive as a file" and leave the upload to the user.
 * - **State derived from those files.** The known-set column mappings
 *   (`known{Nt,Aa}Columns`, the id / sequence / metadata picks, the import
 *   errors) are discovered by reading the uploaded TSV. Without the file there
 *   is nothing for them to refer to.
 * - **View state.** The input ref, the two block labels, the table grid states
 *   and the two graph states. `input` is a `PlRef` into one project's result
 *   pool; the rest exist for the UI alone.
 *
 * Every field is optional, because a block may be created without a template at
 * all — the model's `init` keeps its own default for each.
 */
export type BlockParams = {
  tagPattern?: string;

  parentInputMode?: ParentInputMode;
  parentSequence?: string;
  parentRegions?: ParentRegionConfig[];
  vdjAutoDetect?: boolean;

  exportNt?: boolean;
  exportOnlyKnown?: boolean;

  maxMutations?: number;
  maxMutationFraction?: number;
  maxAaMutations?: number;
  maxAaMutationFraction?: number;
  minBaseQuality?: number;
  minVariantQuality?: number;

  perProcessMemGB?: number;
  perProcessCPUs?: number;
};

const PARENT_INPUT_MODES: readonly ParentInputMode[] = ["fastaSequence", "fastaFile"];
const REGION_SCHEMES: readonly RegionScheme[] = ["none", "vdj", "custom"];

/**
 * The same contract at runtime, for params that arrive from a template file
 * rather than from typed code.
 *
 * Each field the contract names is read and checked here; nothing else is. A key
 * this function never reads is dropped rather than refused, so a misspelled key
 * in a template file is not caught here — it surfaces later as a block that
 * started on its defaults.
 *
 * The checks stop at the shape of a value and say nothing about whether it makes
 * sense. A region of length 0, an empty region name, a `vdj` scheme with the
 * wrong seven names, a quality threshold above the Phred ceiling: each of those
 * is a state the settings panel can be left in, and each is refused where it is
 * used — by `buildParentRegionsJson` and the model's `args` lambda. A parser
 * stricter than the panel would make this block export a settings file its own
 * kind then refuses to apply.
 */
function parseInitializationParams(value: unknown): BlockParams {
  assertParamsObject(value);

  const {
    tagPattern,
    parentInputMode,
    parentSequence,
    parentRegions,
    vdjAutoDetect,
    exportNt,
    exportOnlyKnown,
    maxMutations,
    maxMutationFraction,
    maxAaMutations,
    maxAaMutationFraction,
    minBaseQuality,
    minVariantQuality,
    perProcessMemGB,
    perProcessCPUs,
  } = value;

  return {
    tagPattern: optionalString(tagPattern, "tagPattern"),

    parentInputMode: optionalEnum(parentInputMode, PARENT_INPUT_MODES, "parentInputMode"),
    parentSequence: optionalString(parentSequence, "parentSequence"),
    parentRegions: optionalParentRegions(parentRegions),
    vdjAutoDetect: optionalBoolean(vdjAutoDetect, "vdjAutoDetect"),

    exportNt: optionalBoolean(exportNt, "exportNt"),
    exportOnlyKnown: optionalBoolean(exportOnlyKnown, "exportOnlyKnown"),

    maxMutations: optionalNumber(maxMutations, "maxMutations"),
    maxMutationFraction: optionalNumber(maxMutationFraction, "maxMutationFraction"),
    maxAaMutations: optionalNumber(maxAaMutations, "maxAaMutations"),
    maxAaMutationFraction: optionalNumber(maxAaMutationFraction, "maxAaMutationFraction"),
    minBaseQuality: optionalNumber(minBaseQuality, "minBaseQuality"),
    minVariantQuality: optionalNumber(minVariantQuality, "minVariantQuality"),

    perProcessMemGB: optionalNumber(perProcessMemGB, "perProcessMemGB"),
    perProcessCPUs: optionalNumber(perProcessCPUs, "perProcessCPUs"),
  };
}

/** Narrows a nested value the way `assertParamsObject` narrows the whole params
 *  object, but names the field it was reading — the message goes to whoever
 *  wrote the file, and "params must be an object" would point at the wrong line. */
function assertObjectAt(value: unknown, at: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`'${at}' must be an object.`);
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`'${field}' must be a string.`);
  return value;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`'${field}' must be true or false.`);
  return value;
}

/** `Number.isFinite` rather than `typeof`: YAML admits `.nan` and `.inf`, and no
 *  threshold or resource limit in this block has anything to do with either. */
function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`'${field}' must be a finite number.`);
  return value;
}

function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value))
    throw new Error(`'${field}' must be one of ${allowed.join(", ")}.`);
  return value as T;
}

function optionalParentRegions(value: unknown): ParentRegionConfig[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("'parentRegions' must be a list.");
  return value.map((entry, index) => parseParentRegionConfig(entry, `parentRegions[${index}]`));
}

function parseParentRegionConfig(value: unknown, at: string): ParentRegionConfig {
  assertObjectAt(value, at);

  const { parentId, scheme, completeFeatureName, regions } = value;

  if (typeof parentId !== "string")
    throw new Error(`'${at}.parentId' is required, and must be a string.`);
  const parsedScheme = optionalEnum(scheme, REGION_SCHEMES, `${at}.scheme`);
  if (parsedScheme === undefined) throw new Error(`'${at}.scheme' is required.`);
  if (!Array.isArray(regions)) throw new Error(`'${at}.regions' is required, and must be a list.`);

  return {
    parentId,
    scheme: parsedScheme,
    completeFeatureName: optionalString(completeFeatureName, `${at}.completeFeatureName`),
    regions: regions.map((region, i) => parseRegionDef(region, `${at}.regions[${i}]`, true)),
  };
}

/** `allowChildren` is false one level down, which is what makes nesting two levels
 *  deep a contract the parser enforces rather than a convention. Whether the children
 *  actually tile their region is a question about the values, not the envelope, so it
 *  is settled where they are used (`buildParentRegionsJson`) — a half-filled editor row
 *  is ordinary state, and a parser stricter than the states the UI can reach would make
 *  the block export a file its own kind refuses. */
function parseRegionDef(value: unknown, at: string, allowChildren: boolean): RegionDef {
  assertObjectAt(value, at);

  const { name: regionName, length, children } = value;
  if (typeof regionName !== "string")
    throw new Error(`'${at}.name' is required, and must be a string.`);
  if (typeof length !== "number" || !Number.isFinite(length))
    throw new Error(`'${at}.length' is required, and must be a finite number.`);

  if (children === undefined) return { name: regionName, length };
  if (!allowChildren)
    throw new Error(`'${at}.children' is not allowed — region nesting is two levels deep.`);
  if (!Array.isArray(children)) throw new Error(`'${at}.children' must be a list.`);

  return {
    name: regionName,
    length,
    children: children.map((child, i) => parseRegionDef(child, `${at}.children[${i}]`, false)),
  };
}

// Identity (`name`/`version`) comes from this package's own `package.json`, so
// the on-wire `{name}@{version}` reference can never drift from what npm
// publishes; the bundler inlines the JSON import.
export const kind = defineBlockKind<BlockParams>({
  name,
  version,
  parseInitializationParams,
});
