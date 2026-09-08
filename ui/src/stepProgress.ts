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
 */
export function pipelineStatus(
  sampleId: string,
  entries: StepProgressEntry[] | undefined,
  opts: { done: boolean; totalSteps: number },
): { text: string; percent?: string; running: boolean } {
  if (opts.done) return { text: "Done", running: false };

  let best: { step: string; info: StepInfo } | undefined;
  for (const e of entries ?? []) {
    if (String(e.key[0]) !== sampleId) continue;
    const step = String(e.key[1]);
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

  const ordinal = best.step.split("-")[0];
  const name = best.step.split("-").slice(1).join("-");
  const prefix = `[${ordinal}/${opts.totalSteps}]`;

  if (!best.info.live) return { text: `${prefix} ${name} complete`, running: true };

  const line = (best.info.progressLine ?? "").replace(ProgressPrefix, "").trim();
  if (!line) return { text: `${prefix} ${name}`, running: true };

  // Not every marker is `stage: pct%` (`sort` ends with a bare "Sorting finished").
  const m = line.match(ProgressPattern);
  const stage = m?.groups?.stage?.trim() || line || name;
  const percent = m?.groups?.progress;
  return {
    text: percent ? `${prefix} ${stage}: ${percent}%` : `${prefix} ${stage}`,
    percent,
    running: true,
  };
}

/** parse + analyze, plus refine-tags/sort/consensus when a UMI is declared. */
export function totalPipelineSteps(hasUmi: boolean): number {
  return hasUmi ? 5 : 2;
}
