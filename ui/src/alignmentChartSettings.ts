import type { Color } from "@platforma-sdk/ui-vue";
import { Gradient } from "@platforma-sdk/ui-vue";
import type { Ref } from "vue";
import { computed, unref } from "vue";

import type {
  AlignReport,
  ParseReport,
} from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";
import { alignmentBarParts } from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";

export type { AlignReport, ParseReport };

// Human labels for the alignment outcome codes mitool writes to
// align.report.json (Success + the FragmentAligner.NotAlignedReason enum).
// Unknown codes fall back to the raw code so a new reason still renders.
const categoryLabels: Record<string, string> = {
  Success: "Successfully aligned",
  NoAlignment: "No alignment to parent",
  IncompleteParentCoverage: "Partial parent coverage",
  TooManyMutations: "Too many mutations",
  TooManyIndels: "Indels present",
  LowBaseQuality: "Low base quality",
  NoInput: "No usable sequence",
  NoPatternMatch: "No tag pattern match",
};

/** Build a stacked-bar value for PlAgChartStackedBarCell; parts as in alignmentBarParts. */
export function getAlignmentChartSettings(
  alignReport: AlignReport | undefined,
  parseReport?: ParseReport,
) {
  const data = alignmentBarParts(alignReport, parseReport);

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
    TooManyIndels: magma.getNthOf(4, 9),
    LowBaseQuality: magma.getNthOf(6, 9),
    NoInput: magma.getNthOf(7, 9),
    NoPatternMatch: magma.getNthOf(8, 9),
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
export function useAlignmentChartSettings(
  alignReportRef: Ref<AlignReport | undefined>,
  parseReportRef: Ref<ParseReport | undefined>,
) {
  return computed(() => getAlignmentChartSettings(unref(alignReportRef), unref(parseReportRef)));
}
