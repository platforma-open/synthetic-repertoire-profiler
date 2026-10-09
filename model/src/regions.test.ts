import { describe, expect, test } from "vitest";
import type { ParentRegionConfig, RegionDef } from "./index";
import {
  buildParentRegionsJson,
  duplicateRegionNames,
  featureNameError,
  parseParentFasta,
  regionLengthError,
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
      /whole number greater than 0/,
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
