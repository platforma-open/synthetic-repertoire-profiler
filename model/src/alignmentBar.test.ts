import { describe, expect, test } from "vitest";
import { alignmentBarParts } from "./index";

const align = { aligned: 90, notAligned: 10, notAlignedReasons: { NoAlignment: 10, NoInput: 0 } };

describe("alignmentBarParts", () => {
  test("no align report yet: empty bar", () => {
    expect(alignmentBarParts(undefined, { parseReport: { total: 200, matched: 100 } })).toEqual([]);
  });

  test("run from an older block version: no parse report, bar as before", () => {
    expect(alignmentBarParts(align)).toEqual([
      { category: "Success", value: 90 },
      { category: "NoAlignment", value: 10 },
    ]);
    expect(alignmentBarParts(align, undefined)).toEqual(alignmentBarParts(align));
  });

  test("parse report still loading or of an unexpected shape: no extra part", () => {
    for (const p of [null, {}, { parseReport: {} }, { parseReport: { total: 200 } }])
      expect(alignmentBarParts(align, p)).toEqual(alignmentBarParts(align));
    const wrongTypes = { parseReport: { total: "200", matched: "100" } } as unknown as {
      parseReport: { total: number; matched: number };
    };
    expect(alignmentBarParts(align, wrongTypes)).toEqual(alignmentBarParts(align));
  });

  test("every read matched: no extra part", () => {
    expect(alignmentBarParts(align, { parseReport: { total: 100, matched: 100 } })).toEqual(
      alignmentBarParts(align),
    );
  });

  test("reads lost at parse are added as NoPatternMatch", () => {
    expect(alignmentBarParts(align, { parseReport: { total: 200, matched: 100 } })).toEqual([
      { category: "Success", value: 90 },
      { category: "NoAlignment", value: 10 },
      { category: "NoPatternMatch", value: 100 },
    ]);
  });
});
