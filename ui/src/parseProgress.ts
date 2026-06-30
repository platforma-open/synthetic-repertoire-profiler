import {
  ProgressPattern,
  ProgressPrefix,
} from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";

export type ParsedProgress = {
  raw?: string;
  stage?: string;
  percentage?: string;
  eta?: string;
  etaLabel?: string;
};

// Examples (prefix already present on the wire): "[==PROGRESS==]Aligning: 60.4%  ETA: 00:00:01",
// "[==PROGRESS==]Assembling variants: 92.9%", "Queued", "Done".
export function parseProgressString(progressString: string | undefined | null): ParsedProgress {
  // Strip the marker prefix the tool prepends; "Queued"/"Done" carry no prefix.
  // Empty / not-yet-reported → "Queued" (a running sample with no progress line
  // yet stays Queued — not "Unknown").
  const raw = (progressString ?? "").split(ProgressPrefix).join("").trim() || "Queued";
  const res: ParsedProgress = { raw };
  if (!raw) return res;

  const match = raw.match(ProgressPattern);
  if (match) {
    const { stage, progress, eta } = match.groups!;
    res.stage = stage;
    res.percentage = progress;
    res.eta = eta;
  } else {
    res.stage = raw;
  }
  if (res.eta) res.etaLabel = `ETA: ${res.eta}`;
  return res;
}
