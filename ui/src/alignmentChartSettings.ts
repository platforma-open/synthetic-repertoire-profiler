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

// Human labels for the known not-aligned reason codes. Unknown codes fall back
// to the raw code so a new reason still renders (just unlabelled).
const categoryLabels: Record<string, string> = {
  Success: "Successfully aligned",
  NoSeedHits: "No seed hits",
  LowScore: "Low score",
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

  const categoryColors = {
    Success: viridis.getNthOf(2, 5),
    NoSeedHits: magma.getNthOf(3, 9),
    LowScore: magma.getNthOf(6, 9),
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
