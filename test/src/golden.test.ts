/**
 * Golden test: the block's inputs and outputs must not change unless the golden is
 * regenerated on purpose.
 *
 * Chain: Samples & Data (3 samples, fixed ids) → Amplicon Profiling → Table. Table
 * publishes every result-pool column as one p-frame, which is how this test reads the
 * block's exports; the block's own p-frame outputs are read from its state.
 *
 * Two checks per run, against test/assets/golden/<scenario>.json:
 * - contract: the set of exported columns and each column's full spec;
 * - data: each column's sorted rows.
 *
 * Regenerate: UPDATE_GOLDEN=1 pnpm test, then pnpm run fmt in test/ (the golden is
 * written unformatted, and the format check runs before the tests). Regenerate only from a
 * build whose output is known to be right (the goldens were written from main at 3f61252),
 * and review the diff.
 */
import { SamplesAndDataBlockPointer } from "@platforma-open/milaboratories.samples-and-data";
import { TableBlockPointer } from "@platforma-open/milaboratories.table";
import type { PColumnSpec, PFrameHandle } from "@platforma-sdk/model";
import { wrapOutputs } from "@platforma-sdk/model";
import { awaitStableState, blockTest } from "@platforma-sdk/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SyntheticRepertoireProfilerBlockPointer } from "this-block";
import type { GoldenColumn, Replacements } from "./golden";
import { readFrame } from "./golden";

const ASSETS = path.resolve(__dirname, "../assets/golden");
const UPDATE = process.env.UPDATE_GOLDEN === "1";

const PATTERN = "^*CTTGTAAGGCCAGCG(R1:N{110})\\^*CCAGACATCCATCGT(R2:N{111})";
// FR/CDR-like custom scheme; lengths sum to the 219-nt parent.
const REGIONS = [
  { name: "FR1", length: 30 },
  { name: "CDR1", length: 24 },
  { name: "FR2", length: 45 },
  { name: "CDR2", length: 30 },
  { name: "FR3", length: 60 },
  { name: "CDR3", length: 30 },
];
// known_aa.tsv: K1-K4 occur in the reads, K5-K6 do not.
const KNOWN_AA = {
  knownAaColumns: [
    { header: "knownId", type: "String" },
    { header: "aaSequence", type: "String" },
    { header: "group", type: "String" },
    { header: "score", type: "Double" },
  ],
  knownAaIdColumn: "knownId",
  knownAaSequenceColumn: "aaSequence",
  knownAaMetadataColumns: ["group", "score"],
};

type Scenario = {
  name: string;
  args: Record<string, unknown>;
  // FASTQ file prefix: "" = base fixture, "umi_" = UMI fixture.
  fastqPrefix?: string;
  tagPattern?: string;
  // Upload known_aa.tsv as the known aa set.
  knownAa?: boolean;
  // Forces the variant aggregate's bucket count; the golden stays the scenario's own.
  aggBuckets?: number;
};

// Each scenario overrides the block defaults and has a golden of its own.
const SCENARIOS: Scenario[] = [
  { name: "defaults", args: {} },
  {
    // Stop and frame-shift variants kept; every nt table on.
    name: "nt-unfiltered",
    args: { filterNonProductive: false, exportNt: true, exportNtStateMatrix: true },
  },
  {
    name: "regions",
    args: {
      exportNt: true,
      parentRegions: ["P1", "P2"].map((parentId) => ({
        parentId,
        scheme: "custom",
        regions: REGIONS,
      })),
    },
  },
  { name: "known-aa", args: KNOWN_AA, knownAa: true },
  { name: "known-aa-only", args: { ...KNOWN_AA, exportOnlyKnown: true }, knownAa: true },
  {
    // 10-nt UMI before the R1 anchor; consensus needs 2 reads per molecule (default).
    name: "umi",
    args: {},
    fastqPrefix: "umi_",
    tagPattern: "^*(UMI:N{10})CTTGTAAGGCCAGCG(R1:N{110})\\^*CCAGACATCCATCGT(R2:N{111})",
  },
];

// Every scenario at the default bucket count and at K=4; `defaults` also at K=256, where
// most buckets are empty. `title` is display only: each run compares against `<name>.json`.
const RUNS: (Scenario & { title: string })[] = [
  ...SCENARIOS.map((s) => ({ ...s, title: s.name })),
  ...SCENARIOS.map((s) => ({ ...s, aggBuckets: 4, title: `${s.name} K=4` })),
  ...SCENARIOS.filter((s) => s.name === "defaults").map((s) => ({
    ...s,
    aggBuckets: 256,
    title: `${s.name} K=256`,
  })),
];

const SAMPLES = ["s1", "s2", "s3"] as const;
const sampleId = (s: string) => `GOLDEN${s.toUpperCase()}`.padEnd(24, "A");
const DATASET_ID = "GOLDENDATASETAAAAAAAAAAA";

type Golden = { exports: GoldenColumn[]; outputs: Record<string, GoldenColumn[]> };

// The frame outputs of the block under test that are part of the golden.
const FRAME_OUTPUTS = ["stateHeatmapPf", "mutationHistogramPf"] as const;

blockTest.for(RUNS)(
  "golden $title: exports and frame outputs match their golden",
  { timeout: 900_000 },
  async (scenario, { rawPrj, ml, helpers, tmpFolder, expect }) => {
    const EXPECTED = path.join(ASSETS, `${scenario.name}.json`);
    const sndId = await rawPrj.addBlock("Samples & Data", SamplesAndDataBlockPointer);
    const apId = await rawPrj.addBlock(
      "Amplicon Profiling",
      SyntheticRepertoireProfilerBlockPointer,
    );
    const tableId = await rawPrj.addBlock("Table", TableBlockPointer);

    const prefix = scenario.fastqPrefix ?? "";
    const data: Record<string, { R1: string; R2: string }> = {};
    const labels: Record<string, string> = {};
    for (const s of SAMPLES) {
      data[sampleId(s)] = {
        R1: await helpers.getLocalFileHandle(path.join(ASSETS, `${prefix}${s}_R1.fastq.gz`)),
        R2: await helpers.getLocalFileHandle(path.join(ASSETS, `${prefix}${s}_R2.fastq.gz`)),
      };
      labels[sampleId(s)] = s;
    }
    await rawPrj.mutateBlockStorage(sndId, {
      operation: "update-block-data",
      value: {
        metadata: [],
        sampleIds: SAMPLES.map(sampleId),
        sampleLabelColumnLabel: "Sample",
        sampleLabels: labels,
        datasets: [
          {
            id: DATASET_ID,
            label: "Golden",
            content: { type: "Fastq", readIndices: ["R1", "R2"], gzipped: true, data },
          },
        ],
        h5adFilesToPreprocess: [],
        seuratFilesToPreprocess: [],
        suggestedImport: false,
      },
    });
    await rawPrj.runBlock(sndId);
    await helpers.awaitBlockDone(sndId, 120_000);

    const apState = await awaitStableState(rawPrj.getBlockState(apId), 60_000);
    // blockStorage wraps the block data in `__data`; update-block-data takes the data
    // itself, so spread the inner object or every default lands one level too deep.
    const apData = (apState.blockStorage as { __data: Record<string, unknown> }).__data;
    if (apData?.parentInputMode === undefined) throw new Error("unexpected blockStorage shape");
    const knownAa = scenario.knownAa
      ? { knownAaFileHandle: await helpers.getLocalFileHandle(path.join(ASSETS, "known_aa.tsv")) }
      : {};
    await rawPrj.mutateBlockStorage(apId, {
      operation: "update-block-data",
      value: {
        ...apData,
        input: { __isRef: true, blockId: sndId, name: `pf.dataset.${DATASET_ID}` },
        parentInputMode: "fastaSequence",
        parentSequence: readFileSync(path.join(ASSETS, "parents.fasta"), "utf8"),
        tagPattern: scenario.tagPattern ?? PATTERN,
        runMode: "full",
        ...knownAa,
        aggBuckets: scenario.aggBuckets,
        ...scenario.args,
      },
    });
    await rawPrj.runBlock(apId);
    const apDone = await helpers.awaitBlockDoneAndGetStableBlockState(apId, 600_000);
    const apOutputs = wrapOutputs(apDone.outputs as Parameters<typeof wrapOutputs>[0]) as Record<
      string,
      unknown
    >;

    const tableState = await awaitStableState(rawPrj.getBlockState(tableId), 120_000);
    const tableOutputs = wrapOutputs(tableState.outputs as Parameters<typeof wrapOutputs>[0]) as {
      pFrame?: PFrameHandle;
    };
    if (tableOutputs.pFrame === undefined) throw new Error("Table block produced no pFrame output");

    const ids: Replacements = {
      [apId]: "<apBlock>",
      [sndId]: "<sndBlock>",
      [tableId]: "<tableBlock>",
      [ASSETS]: "<assets>",
    };
    const driver = ml.driverKit.pFrameDriver;
    // Keep only columns this block produced: their specs name the block id after the
    // producer-identity rules, or carry its trace.
    const fromAp = (spec: PColumnSpec) => JSON.stringify(spec).includes(apId);

    const actual: Golden = {
      exports: await readFrame(driver, tableOutputs.pFrame, ids, fromAp),
      outputs: {},
    };
    for (const name of FRAME_OUTPUTS) {
      const handle = apOutputs[name];
      if (typeof handle !== "string")
        throw new Error(`block output ${name} is not a p-frame handle`);
      actual.outputs[name] = await readFrame(driver, handle as PFrameHandle, ids);
    }

    if (UPDATE || !existsSync(EXPECTED)) {
      writeFileSync(EXPECTED, `${JSON.stringify(actual, null, 1)}\n`);
      if (!UPDATE) throw new Error(`no golden at ${EXPECTED}; wrote one, review and commit it`);
      return;
    }
    const expected = JSON.parse(readFileSync(EXPECTED, "utf8")) as Golden;
    // Written to the test temp folder, which is kept when the test fails, for diffing.
    writeFileSync(
      path.join(tmpFolder, `${scenario.name}.actual.json`),
      `${JSON.stringify(actual, null, 1)}\n`,
    );

    // Contract: same exported columns, same specs.
    expect(actual.exports.map((c) => c.key)).toEqual(expected.exports.map((c) => c.key));
    for (const [i, c] of actual.exports.entries())
      expect(c.spec, `spec of ${c.key}`).toEqual(expected.exports[i].spec);
    // Data: same rows for every exported column and every frame output.
    for (const [i, c] of actual.exports.entries())
      expect(c.rows, `rows of ${c.key}`).toEqual(expected.exports[i].rows);
    for (const name of FRAME_OUTPUTS) {
      expect(
        actual.outputs[name].map((c) => c.key),
        `columns of ${name}`,
      ).toEqual(expected.outputs[name].map((c) => c.key));
      for (const [i, c] of actual.outputs[name].entries()) {
        expect(c.spec, `${name} spec of ${c.key}`).toEqual(expected.outputs[name][i].spec);
        expect(c.rows, `${name} rows of ${c.key}`).toEqual(expected.outputs[name][i].rows);
      }
    }
  },
);
