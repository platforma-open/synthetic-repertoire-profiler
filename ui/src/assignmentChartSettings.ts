import type { Color } from "@platforma-sdk/ui-vue";
import { Gradient } from "@platforma-sdk/ui-vue";
import type { Ref } from "vue";
import { computed, unref } from "vue";

/** Per-sample known-set assignment, as written by mitool's `assign.report.json`.
 *  Only the nt-level read buckets the Assignment bar needs are typed. */
export type AssignReport = {
  ntAssigned?: { variants?: number; reads?: number };
  ntUnassigned?: { variants?: number; reads?: number };
  ntAmbiguous?: { variants?: number; reads?: number };
};

/** Stacked-bar value (Assigned / Unassigned / Ambiguous reads) for the sample
 *  report panel. Only rendered when a known set was supplied (assign ran). */
export function getAssignmentChartSettings(assignReport: AssignReport | undefined) {
  const buckets: { category: string; label: string; value: number }[] = [
    {
      category: "Assigned",
      label: "Assigned (known)",
      value: assignReport?.ntAssigned?.reads ?? 0,
    },
    {
      category: "Unassigned",
      label: "Unassigned (novel)",
      value: assignReport?.ntUnassigned?.reads ?? 0,
    },
    { category: "Ambiguous", label: "Ambiguous", value: assignReport?.ntAmbiguous?.reads ?? 0 },
  ];
  const data = assignReport === undefined ? [] : buckets.filter((b) => b.value > 0);
  const total = data.reduce((x, y) => x + y.value, 0);

  const viridis = Gradient("viridis");
  const magma = Gradient("magma");
  const colors: Record<string, Color> = {
    Assigned: viridis.getNthOf(2, 5),
    Unassigned: magma.getNthOf(4, 9),
    Ambiguous: magma.getNthOf(7, 9),
  };

  return {
    title: "Assignment",
    data: data.map(({ category, label, value }) => ({
      label,
      value,
      color: colors[category] ?? magma.getNthOf(1, 9),
      description: [
        label,
        "Fraction: " + (total > 0 ? Math.round((value * 100) / total) : 0) + "%",
      ].join("\n"),
    })),
  };
}

export function useAssignmentChartSettings(assignReportRef: Ref<AssignReport | undefined>) {
  return computed(() => getAssignmentChartSettings(unref(assignReportRef)));
}
