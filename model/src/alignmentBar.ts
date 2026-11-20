/** Per-sample alignment outcome, as written by mitool's `align.report.json`.
 *  Only the fields the Alignments bar needs are typed; the rest is ignored. */
export type AlignReport = {
  aligned?: number;
  notAligned?: number;
  notAlignedReasons?: Record<string, number>;
};

/** The two counts the Alignments bar needs from mitool's `parse.report.json`. */
export type ParseReport = {
  parseReport?: { total?: number; matched?: number };
};

export type AlignmentBarPart = { category: string; value: number };

/**
 * The parts of the Alignments bar: aligned reads, each not-aligned reason, and the
 * reads that did not match the tag pattern.
 *
 * A run made by a block version that did not write `parse.report.json` has no parse
 * report; its bar then has no "NoPatternMatch" part. Pass `parseReport` only on a run
 * without a UMI: with a UMI, align counts molecules, and reads lost at parse would mix
 * units in one bar.
 */
export function alignmentBarParts(
  alignReport: AlignReport | undefined,
  parseReport?: ParseReport | null,
): AlignmentBarPart[] {
  if (alignReport === undefined || alignReport === null) return [];
  const parts: AlignmentBarPart[] = [{ category: "Success", value: alignReport.aligned ?? 0 }];
  for (const [reason, count] of Object.entries(alignReport.notAlignedReasons ?? {}))
    if (count > 0) parts.push({ category: reason, value: count });

  const total = parseReport?.parseReport?.total;
  const matched = parseReport?.parseReport?.matched;
  if (typeof total === "number" && typeof matched === "number" && total > matched)
    parts.push({ category: "NoPatternMatch", value: total - matched });
  return parts;
}
