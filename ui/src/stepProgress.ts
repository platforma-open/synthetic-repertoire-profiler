import {
  ProgressPattern,
  ProgressPrefix,
} from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";

/** What the per-step progress accessor yields per [sampleId, step]. */
type StepInfo = { progressLine?: string; live: boolean };

export type StepProgressEntry = { key: (string | number)[]; value?: unknown };

/**
 * Per-sample pipeline status: the furthest step reached, preferring one still live. Step
 * keys carry an ordinal prefix (`1-parse`, `2-refine-tags`, …), so "furthest" is a string
 * comparison. Completion comes from `done`, not the log, which freezes when a step ends.
 *
 * The `[n/N]` position counts the steps this sample actually has, so it holds for a run
 * of any shape. The key's own prefix orders the steps and is never the numerator: a
 * non-UMI run is keyed `1-parse` and `5-analyze`, which would read `[5/2]`.
 */
export function pipelineStatus(
  sampleId: string,
  entries: StepProgressEntry[] | undefined,
  opts: { done: boolean },
): { text: string; percent?: string; running: boolean } {
  if (opts.done) return { text: "Done", running: false };

  const steps: string[] = [];
  let best: { step: string; info: StepInfo } | undefined;
  for (const e of entries ?? []) {
    if (String(e.key[0]) !== sampleId) continue;
    const step = String(e.key[1]);
    if (!steps.includes(step)) steps.push(step);
    const info = e.value as StepInfo | undefined;
    if (!info) continue;
    if (
      !best ||
      (info.live && !best.info.live) ||
      (info.live === best.info.live && step > best.step)
    )
      best = { step, info };
  }
  if (!best) return { text: "Queued", running: false };

  steps.sort();
  const name = best.step.split("-").slice(1).join("-");
  // Only once the whole step set is known — a lone step would read `[1/1]`.
  const prefix = steps.length > 1 ? `[${steps.indexOf(best.step) + 1}/${steps.length}] ` : "";

  if (!best.info.live) return { text: `${prefix}${name} complete`, running: true };

  const line = (best.info.progressLine ?? "").replace(ProgressPrefix, "").trim();
  if (!line) return { text: `${prefix}${name}`, running: true };

  // Not every marker is `stage: pct%` (`sort` ends with a bare "Sorting finished").
  const m = line.match(ProgressPattern);
  const stage = m?.groups?.stage?.trim() || line || name;
  const percent = m?.groups?.progress;
  return {
    text: percent ? `${prefix}${stage}: ${percent}%` : `${prefix}${stage}`,
    percent,
    running: true,
  };
}
