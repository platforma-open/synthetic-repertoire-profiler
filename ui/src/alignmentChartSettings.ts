import type { Color } from "@platforma-sdk/ui-vue";
import { Gradient } from "@platforma-sdk/ui-vue";
import type { Ref } from "vue";
import { computed, unref } from "vue";

/** Per-sample alignment outcome, as written by mitool's `align.report.json`.
 *  Only the fields the Alignments bar needs are typed; the rest is ignored. */
export type AlignReport = {
  aligned?: number;
  notAligned?: number;
  notAlignedReasons?: Record<string, number>;
};

// Human labels for the alignment outcome codes mitool writes to
// align.report.json (Success + the FragmentAligner.NotAlignedReason enum).
// Unknown codes fall back to the raw code so a new reason still renders.
const categoryLabels: Record<string, string> = {
  Success: "Successfully aligned",
  NoAlignment: "No alignment to parent",
  IncompleteParentCoverage: "Partial parent coverage",
  TooManyMutations: "Too many mutations",
  LowBaseQuality: "Low base quality",
  NoInput: "No usable sequence",
};

/** Build a stacked-bar value (Aligned + each not-aligned reason) for
 *  PlAgChartStackedBarCell. */
export function getAlignmentChartSettings(alignReport: AlignReport | undefined) {
  const data = (() => {
    if (alignReport === undefined) return [];
    const aligned = alignReport.aligned ?? 0;
    const reasons = alignReport.notAlignedReasons ?? {};
    const result = [{ category: "Success", value: aligned }];
    for (const [reason, count] of Object.entries(reasons)) {
      if (count > 0) result.push({ category: reason, value: count });
    }
    return result;
  })();

  const total = data.reduce((x, y) => x + y.value, 0);

  const viridis = Gradient("viridis");
  const magma = Gradient("magma");

  // Green for the aligned share; a distinct magma shade per not-aligned reason
  // (light→dark), so the legend reads at a glance like the mixcr reports.
  const categoryColors = {
    Success: viridis.getNthOf(2, 5),
    NoAlignment: magma.getNthOf(1, 9),
    IncompleteParentCoverage: magma.getNthOf(3, 9),
    TooManyMutations: magma.getNthOf(5, 9),
    LowBaseQuality: magma.getNthOf(6, 9),
    NoInput: magma.getNthOf(7, 9),
  } as Record<string, Color>;

  return {
    title: "Alignments",
    data: data.map(({ category, value }) => ({
      label: categoryLabels[category] ?? category,
      value,
      color: categoryColors[category] ?? magma.getNthOf(1, 9),
      description: [
        categoryLabels[category] ?? category,
        "Fraction: " + (total > 0 ? Math.round((value * 100) / total) : 0) + "%",
      ].join("\n"),
    })),
  };
}

/** Reactive wrapper for the full-size chart in the sample report panel. */
export function useAlignmentChartSettings(alignReportRef: Ref<AlignReport | undefined>) {
  return computed(() => getAlignmentChartSettings(unref(alignReportRef)));
}
