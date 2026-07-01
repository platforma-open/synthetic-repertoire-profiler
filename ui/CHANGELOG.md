# @platforma-open/milaboratories.synthetic-repertoire-profiler.ui

## 1.0.2

### Patch Changes

- f57f858: Make nucleotide-level export opt-in via a single "Export nucleotide-level results" checkbox (off by default).

  Replaces the previous "Produce nucleotide-level state matrix" toggle (`ntStateMatrix`, migrated forward to `exportNt`). When enabled, the workflow now computes AND exports the nt state matrix (previously the flag computed it but nothing was ever saved), plus every other nt-related column in the exported `variants` frame: nt variants and sequences, per-sample nt abundance, parent→nt and nt↔aa linkers, and the nt known-set overlay. When off (default), only amino-acid-level columns are exported.

  Behavior change: downstream blocks no longer receive nucleotide-level columns unless the checkbox is enabled. The block's own Known Variants (NT) / Unmatched (NT) tables are unaffected — they remain driven by the uploaded known-nt set.

- Updated dependencies [f57f858]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.model@1.0.2

## 1.0.1

### Patch Changes

- 3c31df9: Gene annotation fixes
- Updated dependencies [3c31df9]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.model@1.0.1
