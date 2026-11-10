import { describe, expect, test } from "vitest";
import type { ParentRegionConfig, RegionDef } from "./index";
import {
  buildParentRegionsJson,
  buildRegionChains,
  duplicateRegionNames,
  expandScfvConfigs,
  featureNameError,
  hasAutoDetectRegion,
  parseParentFasta,
  regionLengthError,
  validateChainSet,
} from "./index";

const custom = (regions: RegionDef[], completeFeatureName?: string): ParentRegionConfig[] => [
  { parentId: "P1", scheme: "custom", completeFeatureName, regions },
];

function overlay(json: string | undefined) {
  if (json === undefined) throw new Error("expected an overlay, got undefined");
  return JSON.parse(json);
}

describe("featureNameError", () => {
  test.for([
    { name: "FR1", expected: undefined },
    { name: " My_Region_2 ", expected: undefined },
    { name: "", expected: "Name is required." },
    { name: "   ", expected: "Name is required." },
    { name: undefined, expected: "Name is required." },
    {
      name: "My Region (v2)",
      expected: "Invalid region name.\nOnly numbers, letters, and underscores are allowed.",
    },
    {
      name: "a-b",
      expected: "Invalid region name.\nOnly numbers, letters, and underscores are allowed.",
    },
  ])("$name → $expected", ({ name, expected }) => {
    expect(featureNameError(name)).toBe(expected);
  });

  test("names the sequence kind", () => {
    expect(featureNameError("a b", "sequence")).toMatch(/^Invalid sequence name\./);
  });
});

describe("regionLengthError", () => {
  test.for([
    { length: 1, ok: true },
    { length: 300, ok: true },
    { length: 0, ok: false },
    { length: -3, ok: false },
    { length: 1.5, ok: false },
    { length: Number.NaN, ok: false },
    { length: undefined, ok: false },
  ])("$length → ok=$ok", ({ length, ok }) => {
    expect(regionLengthError(length) === undefined).toBe(ok);
  });
});

describe("duplicateRegionNames", () => {
  test("none when all names differ", () => {
    expect(duplicateRegionNames([{ name: "A" }, { name: "B", children: [{ name: "C" }] }])).toEqual(
      new Set(),
    );
  });

  test("finds a repeat across regions and sub-regions, trimmed", () => {
    expect(
      duplicateRegionNames([
        { name: "A" },
        { name: "B", children: [{ name: " A " }, { name: "C" }] },
      ]),
    ).toEqual(new Set(["A"]));
  });

  test("ignores empty names, which have their own error", () => {
    expect(duplicateRegionNames([{ name: "" }, { name: " " }])).toEqual(new Set());
  });
});

describe("buildParentRegionsJson", () => {
  const lengths = new Map([["P1", 10]]);

  test("nothing configured → undefined", () => {
    expect(buildParentRegionsJson(undefined)).toBeUndefined();
    expect(
      buildParentRegionsJson([{ parentId: "P1", scheme: "none", regions: [] }]),
    ).toBeUndefined();
  });

  test.for([
    { total: 9, throws: false },
    { total: 10, throws: false },
    { total: 11, throws: true },
  ])("regions totalling $total nt on a 10 nt parent: throws=$throws", ({ total, throws }) => {
    const configs = custom([
      { name: "A", length: 4 },
      { name: "B", length: total - 4 },
    ]);
    const run = () => buildParentRegionsJson(configs, lengths);
    if (throws) expect(run).toThrow(/longer than parent P1 \(10 nt\)/);
    else expect(run).not.toThrow();
  });

  test("no parent length (file mode) → overrun is left to mitool", () => {
    expect(() => buildParentRegionsJson(custom([{ name: "A", length: 99 }]))).not.toThrow();
  });

  test("emits cumulative offsets", () => {
    const json = buildParentRegionsJson(
      custom([
        { name: "A", length: 4 },
        { name: "B", length: 6 },
      ]),
    );
    expect(overlay(json)).toEqual({
      version: 1,
      parents: {
        P1: {
          scheme: "custom",
          regions: [
            { name: "A", begin: 0, end: 4 },
            { name: "B", begin: 4, end: 10 },
          ],
        },
      },
    });
  });

  test.for([
    { name: "bad name", error: /Invalid region name/ },
    { name: "", error: /Name is required/ },
  ])("rejects region name '$name'", ({ name, error }) => {
    expect(() => buildParentRegionsJson(custom([{ name, length: 3 }]))).toThrow(error);
  });

  test.for([0, -1, 2.5])("rejects length %s", (length) => {
    expect(() => buildParentRegionsJson(custom([{ name: "A", length }]))).toThrow(
      /Whole number > 0/,
    );
  });

  test("rejects duplicate names across regions and sub-regions", () => {
    expect(() =>
      buildParentRegionsJson(
        custom([
          { name: "A", length: 3 },
          { name: "B", length: 3, children: [{ name: "A", length: 3 }] },
        ]),
      ),
    ).toThrow("Region name 'A' (parent P1): Names must be unique.");
  });

  test.for([undefined, "", "   "])("full sequence name %j is optional", (af) => {
    const json = buildParentRegionsJson(custom([{ name: "A", length: 3 }], af));
    expect(overlay(json).parents.P1.completeFeatureName).toBeUndefined();
  });

  test("rejects an invalid full sequence name", () => {
    expect(() => buildParentRegionsJson(custom([{ name: "A", length: 3 }], "VDJ Region"))).toThrow(
      /Invalid sequence name/,
    );
  });

  test("sub-regions that tile their region get absolute offsets", () => {
    const json = buildParentRegionsJson(
      custom([
        { name: "A", length: 2 },
        {
          name: "B",
          length: 5,
          children: [
            { name: "B_N", length: 2 },
            { name: "B_C", length: 3 },
          ],
        },
      ]),
    );
    expect(overlay(json).parents.P1.regions[1].children).toEqual([
      { name: "B_N", begin: 2, end: 4 },
      { name: "B_C", begin: 4, end: 7 },
    ]);
  });

  test.for([4, 6])("sub-regions totalling %i nt in a 5 nt region are rejected", (childTotal) => {
    const configs = custom([
      {
        name: "B",
        length: 5,
        children: [
          { name: "B_N", length: 2 },
          { name: "B_C", length: childTotal - 2 },
        ],
      },
    ]);
    expect(() => buildParentRegionsJson(configs)).toThrow(/must tile it exactly/);
  });

  test("carries the ignored flag, and only when true", () => {
    const json = buildParentRegionsJson(
      custom([
        { name: "VH", length: 3 },
        { name: "LINK", length: 3, ignored: true },
      ]),
    );
    // VH has no `ignored` key (byte-identical to an older config); LINK carries it.
    expect(overlay(json).parents.P1.regions).toEqual([
      { name: "VH", begin: 0, end: 3 },
      { name: "LINK", begin: 3, end: 6, ignored: true },
    ]);
  });

  test("rejects an ignored region with sub-regions", () => {
    expect(() =>
      buildParentRegionsJson(
        custom([{ name: "LINK", length: 6, ignored: true, children: [{ name: "X", length: 6 }] }]),
      ),
    ).toThrow(/ignored and cannot have sub-regions/);
  });

  test("carries the autoDetect flag, and only when true", () => {
    const json = buildParentRegionsJson(
      custom([
        { name: "VH", length: 3, autoDetect: true },
        { name: "VL", length: 3 },
      ]),
    );
    // VH carries autoDetect; VL has no such key (byte-identical to an older config).
    expect(overlay(json).parents.P1.regions).toEqual([
      { name: "VH", begin: 0, end: 3, autoDetect: true },
      { name: "VL", begin: 3, end: 6 },
    ]);
  });

  test("rejects an auto-detect region that is also ignored or subdivided", () => {
    expect(() =>
      buildParentRegionsJson(custom([{ name: "VH", length: 3, autoDetect: true, ignored: true }])),
    ).toThrow(/ignored and cannot be auto-detected/);
    expect(() =>
      buildParentRegionsJson(
        custom([{ name: "VH", length: 3, autoDetect: true, children: [{ name: "X", length: 3 }] }]),
      ),
    ).toThrow(/auto-detected and cannot have sub-regions/);
  });
});

describe("buildRegionChains", () => {
  const cfg = (regions: RegionDef[]): ParentRegionConfig[] => [
    { parentId: "P1", scheme: "custom", regions },
  ];

  test("none when no region is tagged", () => {
    expect(buildRegionChains(cfg([{ name: "A", length: 3 }]))).toEqual({});
    expect(buildRegionChains(undefined)).toEqual({});
  });

  test("a parent-level chain applies to every region (vdj scheme)", () => {
    expect(
      buildRegionChains([
        {
          parentId: "P1",
          scheme: "vdj",
          chain: "IGHeavy",
          regions: [
            { name: "FR1", length: 3 },
            { name: "CDR1", length: 3 },
            { name: "LINK", length: 3, ignored: true },
          ],
        },
      ]),
    ).toEqual({ FR1: "IGHeavy", CDR1: "IGHeavy" });
  });

  test("a chain left over on a non-vdj config is ignored", () => {
    expect(
      buildRegionChains([
        { parentId: "P1", scheme: "custom", chain: "IGHeavy", regions: [{ name: "A", length: 3 }] },
      ]),
    ).toEqual({});
  });

  test("maps tagged regions, and sub-regions inherit the parent's chain", () => {
    expect(
      buildRegionChains(
        cfg([
          { name: "VH", length: 3, chain: "IGHeavy" },
          { name: "LINK", length: 3, ignored: true },
          {
            name: "VL",
            length: 6,
            chain: "IGLight",
            children: [
              { name: "VL_N", length: 3 },
              { name: "VL_C", length: 3, chain: "IGHeavy" },
            ],
          },
        ]),
      ),
    ).toEqual({ VH: "IGHeavy", VL: "IGLight", VL_N: "IGLight", VL_C: "IGHeavy" });
  });

  test("an ignored region's chain is dropped", () => {
    expect(
      buildRegionChains(cfg([{ name: "LINK", length: 3, ignored: true, chain: "IGHeavy" }])),
    ).toEqual({});
  });

  test("an auto-detect domain expands to its container plus seven prefixed FR/CDR columns", () => {
    expect(
      buildRegionChains(
        cfg([
          { name: "VH", length: 360, chain: "IGHeavy", autoDetect: true },
          { name: "LINK", length: 45, ignored: true },
          { name: "VL", length: 321, chain: "IGLight", autoDetect: true },
        ]),
      ),
    ).toEqual({
      VH: "IGHeavy",
      VL: "IGLight",
      VH_FR1: "IGHeavy",
      VH_CDR1: "IGHeavy",
      VH_FR2: "IGHeavy",
      VH_CDR2: "IGHeavy",
      VH_FR3: "IGHeavy",
      VH_CDR3: "IGHeavy",
      VH_FR4: "IGHeavy",
      VL_FR1: "IGLight",
      VL_CDR1: "IGLight",
      VL_FR2: "IGLight",
      VL_CDR2: "IGLight",
      VL_FR3: "IGLight",
      VL_CDR3: "IGLight",
      VL_FR4: "IGLight",
    });
  });

  test("an auto-detect domain with no chain contributes no column", () => {
    expect(buildRegionChains(cfg([{ name: "VH", length: 360, autoDetect: true }]))).toEqual({});
  });
});

describe("expandScfvConfigs", () => {
  // heavy(6) + linker(6) + light(9), the linker unique in the middle.
  const seq = "AAACCC" + "GGTTCA" + "TTTGGGCCC";
  const seqs = new Map([["P1", seq]]);
  const scfv = (regions: RegionDef[], linker = "GGTTCA"): ParentRegionConfig[] => [
    { parentId: "P1", scheme: "scfv", linker, regions },
  ];
  const domains: RegionDef[] = [
    { name: "VH", length: 0, chain: "IGHeavy" },
    { name: "VL", length: 0, chain: "IGLight" },
  ];

  test("expands to an auto-detect custom config split at the linker", () => {
    const [out] = expandScfvConfigs(scfv(domains), seqs)!;
    expect(out.scheme).toBe("custom");
    expect(out.regions).toEqual([
      { name: "VH", length: 6, chain: "IGHeavy", autoDetect: true },
      { name: "Linker", length: 6, ignored: true },
      { name: "VL", length: 9, chain: "IGLight", autoDetect: true },
    ]);
  });

  test("order is preserved (light first swaps the domains)", () => {
    const lightFirst: RegionDef[] = [
      { name: "VL", length: 0, chain: "IGLight" },
      { name: "VH", length: 0, chain: "IGHeavy" },
    ];
    const [out] = expandScfvConfigs(scfv(lightFirst), seqs)!;
    expect(out.regions[0]).toMatchObject({ name: "VL", chain: "IGLight" });
    expect(out.regions[2]).toMatchObject({ name: "VH", chain: "IGHeavy" });
  });

  test("a non-scfv config passes through unchanged", () => {
    const custom: ParentRegionConfig[] = [
      { parentId: "P1", scheme: "custom", regions: [{ name: "A", length: 3 }] },
    ];
    // The non-scfv element is returned by reference, untouched.
    expect(expandScfvConfigs(custom, seqs)![0]).toBe(custom[0]);
  });

  test.for([
    { linker: "", error: /linker sequence is required/ },
    { linker: "GGXTCA", error: /plain nucleotides/ },
    { linker: "AAAAAA", error: /not found/ },
    { linker: "CCC", error: /more than once/ },
  ])("rejects linker '$linker'", ({ linker, error }) => {
    expect(() => expandScfvConfigs(scfv(domains, linker), seqs)).toThrow(error);
  });

  test("requires the pasted parent sequence", () => {
    expect(() => expandScfvConfigs(scfv(domains), new Map())).toThrow(/paste the parent sequence/);
  });

  test("needs exactly two domains", () => {
    expect(() => expandScfvConfigs(scfv([domains[0]]), seqs)).toThrow(/exactly two domains/);
  });
});

describe("hasAutoDetectRegion", () => {
  const cfg = (regions: RegionDef[]): ParentRegionConfig[] => [
    { parentId: "P1", scheme: "custom", regions },
  ];

  test("true only when a non-ignored region asks for it", () => {
    expect(hasAutoDetectRegion(undefined)).toBe(false);
    expect(hasAutoDetectRegion(cfg([{ name: "VH", length: 3 }]))).toBe(false);
    expect(hasAutoDetectRegion(cfg([{ name: "VH", length: 3, autoDetect: true }]))).toBe(true);
    // An ignored region's autoDetect is meaningless and does not activate the path.
    expect(
      hasAutoDetectRegion(cfg([{ name: "LINK", length: 3, ignored: true, autoDetect: true }])),
    ).toBe(false);
  });
});

describe("validateChainSet", () => {
  test("zero or one chain is fine", () => {
    expect(() => validateChainSet([])).not.toThrow();
    expect(() => validateChainSet(["IGHeavy"])).not.toThrow();
    expect(() => validateChainSet(["IGHeavy", "IGHeavy"])).not.toThrow();
  });

  test("a two-chain receptor is fine", () => {
    expect(() => validateChainSet(["IGHeavy", "IGLight"])).not.toThrow();
    expect(() => validateChainSet(["TCRBeta", "TCRAlpha"])).not.toThrow();
  });

  test("two chains from different receptors are refused", () => {
    expect(() => validateChainSet(["IGHeavy", "TCRBeta"])).toThrow(/one receptor/);
  });

  test("three or more chains are refused", () => {
    expect(() => validateChainSet(["IGHeavy", "IGLight", "TCRBeta"])).toThrow(/3 chains/);
  });
});

describe("parseParentFasta", () => {
  test("id is the first header token; body is joined and upper-cased", () => {
    expect(parseParentFasta(">P1 some description\r\nacgt\nAC\n\n>P2\nGG\n")).toEqual([
      { id: "P1", sequence: "ACGTAC" },
      { id: "P2", sequence: "GG" },
    ]);
  });

  test("empty input → no parents", () => {
    expect(parseParentFasta(undefined)).toEqual([]);
    expect(parseParentFasta("")).toEqual([]);
  });
});
