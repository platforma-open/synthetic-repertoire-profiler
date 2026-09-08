import {
  ProgressPattern,
  ProgressPrefix,
} from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";

/** What the per-step progress accessor yields per [sampleId, step]. */
type StepInfo = { progressLine?: string; live: boolean };

export type StepProgressEntry = { key: (string | number)[]; value?: unknown };

/**
 * Per-sample pipeline status, from the per-step progress map.
 *
 * A sample's status is the furthest step it has reached, preferring a step that is still
 * live — the step keys carry an ordinal prefix (`1-parse`, `2-refine-tags`, …) so
 * "furthest" is a plain string comparison. A finished step's progress log stays frozen at
 * its last marker, which is why the `live` flag decides rather than the line itself.
 *
 * `done` comes from a separate signal (qc.json materialising), never from the log.
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
    // A live step always wins; otherwise the later step does.
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

  // Not every marker is `stage: pct%` — `sort` ends with a bare "Sorting finished" and
  // `refine-tags` opens with "Initialization: progress unknown". An unparseable line is
  // still the tool's own words, so show it rather than falling back to the step name.
  const m = line.match(ProgressPattern);
  const stage = m?.groups?.stage?.trim() || line || name;
  const percent = m?.groups?.progress;
  return {
    text: percent ? `${prefix} ${stage}: ${percent}%` : `${prefix} ${stage}`,
    percent,
    running: true,
  };
}

/** Steps a run has: parse + analyze, plus refine-tags/sort/consensus when a UMI is declared. */
export function totalPipelineSteps(hasUmi: boolean): number {
  return hasUmi ? 5 : 2;
}
