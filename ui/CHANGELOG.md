# @platforma-open/milaboratories.synthetic-repertoire-profiler.ui

## 1.2.8

### Patch Changes

- cb87c08: New Advanced Setting: **Substitutions only**

  Keeps only variants whose differences from the parent are substitutions. Off by default.

  A read is dropped at alignment if it carries an insertion or a deletion, so no indel-bearing variant is ever built and neither the nucleotide nor the amino-acid export can contain one. This is the control a designed library or a mutational scan needs: the existing mutation-load filters count all edit operations together, so no setting of them admits a heavy substitution load while still rejecting indels.

  The rejection is visible in two places. The Alignments chart gains an **Indels present** band alongside the other alignment-failure reasons, and the QC table gains **NT Indel Reads** with its percentage.

  Two effects to expect when the setting is on. A read whose indel is only a sequencing error is dropped as well, so its variant loses that read support — on noisy data this can be a large share. And the frame-shift counts fall to near zero, because those reads are now removed before variants are built and are counted among the alignment outcomes instead.

  Requires mitool 2.3.1-162-main, pinned in this release.

  Fix: upgrading a project from block 1.2.8 to 1.2.9 broke the block with `Service or input field not found stepLogs`

  1.2.9 renamed the workflow's `logs` output to `stepLogs`. A project computed under 1.2.8 has outputs carrying `logs` and no `stepLogs`, and the model resolved the new name with the throwing form — which failed the whole model render, not just the logs view, leaving the upgraded block unusable.

  The two outputs that read that field now tolerate its absence, so an upgraded project opens normally. The Logs and Progress views are empty until the run completes, which the upgrade already requires.

- Updated dependencies [cb87c08]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.model@1.2.6

## 1.2.7

### Patch Changes

- 63078d4: Support UMI (molecular barcode) libraries

  A tag pattern carrying a UMI used to be refused outright. It now drives a molecule-level
  analysis: between `parse` and `repertoire analyze` the workflow runs mitool's
  `refine-tags` → `sort` → `consensus`, so each molecule contributes one consensus read
  instead of every PCR duplicate contributing its own.

  Abundance is then reported in molecules. `uniqueMoleculeCount` and its fraction land per
  sample and per variant at both the nucleotide and amino-acid level, with cross-sample
  totals, a known-set equivalent, and a molecule-weighted QC table led by reads-per-molecule.
  On such a run molecules are the primary, anchored abundance and read counts become
  secondary. A run without a UMI is unchanged throughout — no molecule column is emitted at
  all.

  Two settings appear under the pattern that creates the need for them, both required once a
  UMI is declared: reads a molecule needs before it yields a consensus, and the quality below
  which a barcode is discarded. A pattern the run gate would refuse now reports its reason on
  the pattern field itself, so a mistyped pattern shows up before a run rather than during
  one. Two UMI halves stay two grouping keys — the pair identifies the molecule, without
  being concatenated.

  The Progress column now names the pre-processing step a sample is in rather than sitting at
  "Queued" until the last command. The sample panel's Logs view carries one log per command,
  picked by step, so a failure in barcode correction or consensus has something to read. It
  replaces the separate Reports tab: a step's report text was already printed into its log,
  so the two tabs showed the same numbers under overlapping step lists.

  Requires mitool 2.3.1-155-main, which fills the per-variant molecule count.

- Updated dependencies [63078d4]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.model@1.2.5

## 1.2.6

### Patch Changes

- 6406b12: Let the user edit the region list in the VDJ scheme

  The VDJ scheme locked the region list to FR1, CDR1, FR2, CDR2, FR3, CDR3, FR4 and allowed
  only the lengths to be edited. An engineered V-domain does not always fit that layout: a
  grafted insert sits between two canonical regions, or in place of one. Such a parent had to fall back to the custom scheme, which drops the VDJ modality
  from the whole run.

  The VDJ scheme now seeds from those seven names but lets the user add, remove and rename
  regions, the same as the custom scheme. A "Reset to FR1–FR4" button reseeds the
  conventional partition. Switching schemes still clears the list, unchanged.

  Also fixes the amino-acid preview. A region was marked in-frame from its own length alone,
  so once an earlier region shifted the frame the editor showed a translation read at the
  wrong offset. It now applies the workflow's rule — both ends on a codon boundary — and
  warns per parent which regions will have no amino-acid columns.

  Requires a mitool release carrying the matching validator change (MILAB-6853); mitool
  rejected a non-canonical VDJ region list too.

- Updated dependencies [6406b12]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.model@1.2.4

## 1.2.5

### Patch Changes

- 33be919: Export the parent's residue per position, and the parent sequence, instead of guessing the residue

  No column carried the parent's residue at each position, so consumers derived it by a majority vote
  over the state matrix: a matrix cell defaults to the parent residue, so the state carried by the most
  distinct variants was taken to be the parent's. That vote counts variants rather than reads, so it is
  wrong wherever most distinct variants are mutated at a position — a small designed set or a
  single-site library. Ties broke lexicographically, and a deletion is `-`, which sorts before every
  letter, so a tie reported a gap as the parent residue.

  A wrong residue is not a local error. The companion heat-map block locates a single mutant at the one
  position where its state differs from the parent's, so a wrong residue at one position makes every
  single mutant differ there too, and each one is painted an extra cell.

  mitool now writes the real thing. It already held both parent sequences and already used them —
  `RepertoireTsvExporter` builds them from the `--parents` FASTA and the per-parent reading frame, and
  `StateMatrix.expand` seeds every default cell from that same object. So the new tables cannot
  disagree with the matrix, which computing them a second time block-side could not have guaranteed.

  New exported columns, per level (the `pl7.app/alphabet` domain distinguishes nt from aa):

  - `pl7.app/repertoire/parentResidue`, keyed `[parentId, position]`
  - `pl7.app/repertoire/parentSequence`, keyed `[parentId]` — deliberately not `pl7.app/sequence`,
    which the per-variant sequence already uses with `{feature: amplicon-sequence, alphabet}`

  The nt pair rides the nt state-matrix toggle, like everything else nt. The in-block composition heat
  map now takes its parent track from the same columns the export carries, so the plot and the export
  cannot show a different parent. `compute-state-heatmap` no longer computes the vote, and the dead
  `aggregate-state-composition` template — a second, unreferenced copy of it — is deleted.

  Requires mitool 2.3.1-148-main. That release also switches the `mutations` designator in
  `pl7.app/repertoire/mutations` from milib's 0-based positions to 1-based, so it agrees with the
  position axis of the state matrix, the parent tables and the region annotation. The column travels as
  an opaque string, so nothing in the block parses it — the change is what the user reads in the
  Mutations cell.

## 1.2.4

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
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.model@1.2.3

## 1.2.3

### Patch Changes

- 598c535: Add the "Residue Composition" page — a per-position residue heat map (position × residue) built in-block from the state matrix and the cross-sample per-variant read totals. Two value columns from one aggregation: pooled read count, and per-position residue frequency (the default view). One plot per parent, chosen with a Parent selector in the chart settings, with the parent-residue and region tracks riding under the position axis. Amino-acid level always, nucleotide level when nucleotide export is on.

  The composition plot's region track is its own column (carrying the alphabet domain) rather than the region column built for the downstream export, so it resolves on the plot the same way the parent-residue track does.

  Use the `triadic` categorical palette on the composition plot — the only one with enough colours (27) for a residue alphabet, so the residue tracks no longer repeat a colour every 9th residue.

- Updated dependencies [598c535]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.model@1.2.2

## 1.2.2

### Patch Changes

- 903df6e: Size every ptabler step from input volume instead of sample count

  The cross-sample aggregations sized their RAM/CPU from the number of samples
  (`aggregate-resources.forSamples`), which floored at 8 GiB regardless of dataset
  size. The state-matrix aggregation has one row per variant per position, so it
  scales with the variant count, not the sample count — a run with several million
  variants was OOM-killed at the 8 GiB floor.

  All `pt.workflow()` steps and Xsv imports are now left unsized, so workflow-tengo
  sizes them from actual input volume (`ram = between(2 GiB + 4 × size, 2 GiB,
64 GiB)`). An explicit `.mem()`/`.cpu()` suppresses that formula, which is why the
  previous per-sample budgets never took effect on large repertoires.

## 1.2.1

### Patch Changes

- 5a3763d: Add a Mutation Count Histogram page — a bar chart (GraphMaker) of how many distinct variants carry each number of mutations
  Add quality filters parameters
  Infer tag pattern for single/two read datasets
- Updated dependencies [5a3763d]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.model@1.2.1

## 1.2.0

### Minor Changes

- 45043de: Add an "Export only known variants" option to the Known Variants section. It is off by default and shown whenever a known set (nucleotide and/or amino-acid) is supplied. When enabled, the exported variant repertoire is restricted to variants that matched a known entry — nucleotide variants with `assignStatus == ASSIGNED`, amino-acid variants carrying a `knownAaKey`. The filter applies across the whole exported `variants` frame (per-sample abundance, per-variant properties, state matrices, linkers, and distance-to-known columns); read counts and fractions keep their original basis (fraction of all reads), unmatched rows are simply dropped. A level with no match signal (e.g. nucleotide when only an amino-acid set is given) exports empty. The block-local Known Variants / Unmatched tables and the QC report are unaffected — they always reflect the full analysis.

### Patch Changes

- Updated dependencies [45043de]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.model@1.2.0

## 1.1.1

### Patch Changes

- 21fab8d: Add an amino-acid mutation-load filter (count + fraction), mirroring the existing
  nucleotide filter. Feeds mitool's call-mutations step via
  `-Mcall-mutations.maxAaMutations` / `-Mcall-mutations.maxAaMutationFraction`;
  drops in-frame variants whose translated sequence diverges from the parent by more
  than the configured amino-acid edit count / fraction. Empty = off (default).
- Updated dependencies [21fab8d]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.model@1.1.1

## 1.1.0

### Minor Changes

- fbe3553: Add whole-dataset "Auto-detect VDJ regions (germline)" option. When enabled, the workflow
  infers every parent's FR1–FR4 boundaries from germline (repseqio, reusing the
  mixcr-amplicon-alignment flow) and builds the `--parent-regions` overlay automatically,
  instead of the user entering region lengths by hand. Parents must be in-frame V-domains;
  detection fails per-parent with a clear message otherwise.

### Patch Changes

- Updated dependencies [fbe3553]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.model@1.1.0

## 1.0.3

### Patch Changes

- c4c61c4: Add an optional per-fragment mutation-load filter to Advanced Settings: "Max mutations" and "Max mutation fraction".

  Both are off by default. When set, they are passed to mitool's align step (`-Malign.filter.maxMutations` / `-Malign.filter.maxMutationFraction`), rejecting an alignment that exceeds the cap as a likely misalignment / off-target read. The two gates are applied independently.

  Also fix the Alignments chart in the sample report: the not-aligned reasons now use the correct mitool codes (`NoAlignment`, `IncompleteParentCoverage`, `TooManyMutations`, `LowBaseQuality`, `NoInput`), each with a human-readable label and a distinct color. Previously the stale label map matched no real code, so every reason showed its raw code in a single fallback color.

- Updated dependencies [c4c61c4]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.model@1.0.3

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
