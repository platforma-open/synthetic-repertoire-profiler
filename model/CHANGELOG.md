# @platforma-open/milaboratories.synthetic-repertoire-profiler.model

## 1.2.3

### Patch Changes

- c872b9d: Add the mandatory kind component and upgrade the SDK

  block-tools 2.14 makes a `kind/` package a mandatory fourth block component
  alongside model, workflow and ui. The kind carries the block's identity and its
  init-params contract — what a creator or a project template supplies to seed a
  new instance.

  This block's contract is the run recipe: the tag pattern, the parent (reference)
  setup and its region schemes, the export toggles, the mutation and quality gates,
  and the per-process resource overrides. Uploaded files, the known-set column
  mappings derived from them, and view state stay out of it.

  The model now declares its kind (`new DataModelBuilder({ kind })`,
  `BlockModelV3.create({ dataModel, kind })`), consumes the contract in `init`, and
  projects the same fields back out through the newly mandatory
  `.templateParams(...)`.

  Catalog bump: model / ui-vue 1.81 -> 1.82, test 1.82.4, block-tools 2.14.3,
  tengo-builder 4.0.23, package-builder 3.15.0, ts-builder 1.7.0. CI moves to
  node 22.x.

- Updated dependencies [c872b9d]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.kind@1.0.1

## 1.2.2

### Patch Changes

- 598c535: Add the "Residue Composition" page — a per-position residue heat map (position × residue) built in-block from the state matrix and the cross-sample per-variant read totals. Two value columns from one aggregation: pooled read count, and per-position residue frequency (the default view). One plot per parent, chosen with a Parent selector in the chart settings, with the parent-residue and region tracks riding under the position axis. Amino-acid level always, nucleotide level when nucleotide export is on.

  The composition plot's region track is its own column (carrying the alphabet domain) rather than the region column built for the downstream export, so it resolves on the plot the same way the parent-residue track does.

  Use the `triadic` categorical palette on the composition plot — the only one with enough colours (27) for a residue alphabet, so the residue tracks no longer repeat a colour every 9th residue.

## 1.2.1

### Patch Changes

- 5a3763d: Add a Mutation Count Histogram page — a bar chart (GraphMaker) of how many distinct variants carry each number of mutations
  Add quality filters parameters
  Infer tag pattern for single/two read datasets

## 1.2.0

### Minor Changes

- 45043de: Add an "Export only known variants" option to the Known Variants section. It is off by default and shown whenever a known set (nucleotide and/or amino-acid) is supplied. When enabled, the exported variant repertoire is restricted to variants that matched a known entry — nucleotide variants with `assignStatus == ASSIGNED`, amino-acid variants carrying a `knownAaKey`. The filter applies across the whole exported `variants` frame (per-sample abundance, per-variant properties, state matrices, linkers, and distance-to-known columns); read counts and fractions keep their original basis (fraction of all reads), unmatched rows are simply dropped. A level with no match signal (e.g. nucleotide when only an amino-acid set is given) exports empty. The block-local Known Variants / Unmatched tables and the QC report are unaffected — they always reflect the full analysis.

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

## 1.0.3

### Patch Changes

- c4c61c4: Add an optional per-fragment mutation-load filter to Advanced Settings: "Max mutations" and "Max mutation fraction".

  Both are off by default. When set, they are passed to mitool's align step (`-Malign.filter.maxMutations` / `-Malign.filter.maxMutationFraction`), rejecting an alignment that exceeds the cap as a likely misalignment / off-target read. The two gates are applied independently.

  Also fix the Alignments chart in the sample report: the not-aligned reasons now use the correct mitool codes (`NoAlignment`, `IncompleteParentCoverage`, `TooManyMutations`, `LowBaseQuality`, `NoInput`), each with a human-readable label and a distinct color. Previously the stale label map matched no real code, so every reason showed its raw code in a single fallback color.

## 1.0.2

### Patch Changes

- f57f858: Make nucleotide-level export opt-in via a single "Export nucleotide-level results" checkbox (off by default).

  Replaces the previous "Produce nucleotide-level state matrix" toggle (`ntStateMatrix`, migrated forward to `exportNt`). When enabled, the workflow now computes AND exports the nt state matrix (previously the flag computed it but nothing was ever saved), plus every other nt-related column in the exported `variants` frame: nt variants and sequences, per-sample nt abundance, parent→nt and nt↔aa linkers, and the nt known-set overlay. When off (default), only amino-acid-level columns are exported.

  Behavior change: downstream blocks no longer receive nucleotide-level columns unless the checkbox is enabled. The block's own Known Variants (NT) / Unmatched (NT) tables are unaffected — they remain driven by the uploaded known-nt set.

## 1.0.1

### Patch Changes

- 3c31df9: Gene annotation fixes
