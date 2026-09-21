# @platforma-open/milaboratories.synthetic-repertoire-profiler.vdj-region-tools

## 1.1.2

### Patch Changes

- b1bedd5: - Variants over the amino-acid mutation limit are now removed from the results, not kept unlinked. Read and UMI fractions renormalise over what is left.
  - Separate checkboxes for the AA and NT state matrices. "Export nucleotide-level results" no longer controls the NT matrix.
  - Fixed VDJ auto-detect rejecting valid light-chain parents: the J half scored just below the inference threshold.
  - Removed the repeated percentage from the right of the Progress column.

## 1.1.1

### Patch Changes

- 21fab8d: Add an amino-acid mutation-load filter (count + fraction), mirroring the existing
  nucleotide filter. Feeds mitool's call-mutations step via
  `-Mcall-mutations.maxAaMutations` / `-Mcall-mutations.maxAaMutationFraction`;
  drops in-frame variants whose translated sequence diverges from the parent by more
  than the configured amino-acid edit count / fraction. Empty = off (default).

## 1.1.0

### Minor Changes

- fbe3553: Add whole-dataset "Auto-detect VDJ regions (germline)" option. When enabled, the workflow
  infers every parent's FR1–FR4 boundaries from germline (repseqio, reusing the
  mixcr-amplicon-alignment flow) and builds the `--parent-regions` overlay automatically,
  instead of the user entering region lengths by hand. Parents must be in-frame V-domains;
  detection fails per-parent with a clear message otherwise.
