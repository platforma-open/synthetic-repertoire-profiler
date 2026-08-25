# @platforma-open/milaboratories.synthetic-repertoire-profiler.workflow

## 1.2.7

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

## 1.2.6

### Patch Changes

- 5277d15: Chunk the cross-sample state-matrix dedup by position, to bound its peak memory

  The state matrix is dense: mitool writes one row per (variant, parent position),
  unmutated positions included. So `aggregate-state-matrix` was deduping
  `distinctVariants x parentLength` rows in one job, and a dedup hash table is
  Theta(distinct rows) whatever operator is used. Polars does not spill it — ptabler's
  `--spill-dir` reaches `pframe_source` and the duckdb sort in `write_frame`, not
  `collect_all`. Measured on polars 1.33.1 (the version ptabler ships): ~200 bytes of
  peak RSS per distinct row. A 127-aa parent with 12M distinct aa variants is ~1.5G
  rows and ~305 GB, far past the 64 GiB ceiling pt's auto-sizing can request.

  `position` is part of the dedup key, so any partition of the position axis splits the
  work into independent jobs with an identical result: two rows that are duplicates of
  each other share a position, so they always land in the same chunk. Each per-sample
  job now writes its state matrix as 16 disjoint slices, and the cross-sample dedup runs
  once per slice — peak RAM drops by 16x.

  The chunk key is a hex prefix of `sha256(position)`, NOT an arithmetic function of the
  label. `position` is deliberately a String axis (column-specs positionAxisSpec, "String
  value (v2 IMGT-readiness)"), so nothing may assume the label parses as a number — IMGT
  labels like `111A` or `112.1` are the point of the String type. A derived index is the
  other option, but it would have to be computed identically in every per-sample job; a
  per-sample dense-rank is not, because a sample missing a position shifts every rank
  after it, which would split duplicate rows across chunks and silently stop the dedup
  from deduping. A hash of the label is stateless and cannot drift between jobs.

  The last chunk takes the complement of all the others rather than a 16th equality, so
  the partition is total and disjoint by construction — independent of what the hash
  encoding actually emits. In the worst case (a constant hash) every row lands in one
  chunk: still correct, just no memory benefit. Enumerating 16 equalities instead would
  send any unmatched row to no chunk at all.

  The split is done in the per-sample job, not in the aggregate. Doing it in the
  aggregate would make each of the 16 jobs re-scan every sample's full state matrix,
  because mitool writes variant-major and `position` therefore has no locality that
  row-group pruning could exploit. Splitting per sample costs one extra pass over
  per-sample data (polars shares the scan across the 16 sinks) and leaves total I/O
  unchanged.

  The chunks are disjoint and already deduped, so `merge-state-matrix` recombines them
  with a plain streaming concat. Row order does not matter: `xsv.importFile` sorts by
  axes when it builds the PColumn.

  Also replaces `groupBy().agg(first())` + `sort()` with `unique({ keep: "any" })`.
  ptabler hardcodes `maintain_order: true` on groupBy, and an ordered group-by cannot
  run incrementally under the streaming engine. `keep: "any"` is exact here — the state
  matrix is a pure function of the variant, so every duplicate row carries an identical
  state.

  Per-sample outputs `aaStateMatrixTsv` / `ntStateMatrixTsv` are replaced by
  `aaStateMatrixChunks` / `ntStateMatrixChunks` (ResourceMap keyed by chunk). The
  whole-file `aaStateMatrixTsv` block output is dropped; nothing read it.

  Size the state-matrix pt runs explicitly and move them to the heavy queue

  The chunked dedup succeeded at ~1M variants but the MERGE step OOMed at ~2.5M on a
  K8s backend — the one step whose peak should be O(row group), since it is lazy scans
  into a lazy vertical concat into a sink. Two things were starving it, both inherited
  from the original `inMediumQueue()` + unsized `pt.workflow()`:

  - The queue caps the request. `medium` tops out near a third of host RAM (~12.7 GiB on
    a 32 GB host); `heavy` gets 2-3x that and is the exec default. "If you request more
    memory than a queue can provide, your request will be capped at the queue's limit."
  - The unsized pt formula is `between(2 GiB + 4 x size, 2 GiB, 64 GiB)` with a
    `staticFallback("4GiB")`. A batch executor that cannot evaluate resource formulas
    takes the 4 GiB fallback, and a step whose inputs are futures from other execs can
    measure size 0 and land on the 2 GiB floor.

  `aggregate-state-matrix`, `merge-state-matrix` and `compute-state-heatmap` now run on
  the heavy queue with an explicit STATIC memory request: 48 GiB for the per-chunk dedup,
  16 GiB for the merge, 32 GiB for the composition heat map.

  Static rather than a formula, because `pt.workflow().mem()` cannot carry one.
  Its value is handed to the separate `pt.workflow-run` template as a metaInput, so it
  crosses a template boundary as JSON; an `exec.formula` is a Tengo object with an AST
  behind it and arrives as a structure `resources()` rejects ("RAM amount should be a
  number or string"). The SDK's own data-driven formula works only because it is built
  INSIDE workflow-run, on the near side of that boundary.

  Over-requesting is safe: "if you request more memory than a queue can provide, your
  request will be capped at the queue's limit", so a generous request degrades to the
  queue cap rather than failing to schedule.

  Fix a null-position hole in the chunk partition

  An empty TSV field parses as NULL, not "". `hash(null)` is null, and in three-valued
  logic `null != "x"` evaluates to NULL rather than true — so a null chunk key failed the
  equality branches AND the complement branch, and the row was dropped from every chunk.
  The complement makes the partition total over unexpected NON-NULL values; it cannot
  cover nulls, which is exactly where it looks like it should. `chunkKeyExpr` now
  fillNulls to the last key, routing such rows into the catch-all branch.

  Not reachable from mitool, which always writes `${i + 1}` — but the partition is now
  total by construction rather than by trusting the producer.

## 1.2.5

### Patch Changes

- 598c535: Add the "Residue Composition" page — a per-position residue heat map (position × residue) built in-block from the state matrix and the cross-sample per-variant read totals. Two value columns from one aggregation: pooled read count, and per-position residue frequency (the default view). One plot per parent, chosen with a Parent selector in the chart settings, with the parent-residue and region tracks riding under the position axis. Amino-acid level always, nucleotide level when nucleotide export is on.

  The composition plot's region track is its own column (carrying the alphabet domain) rather than the region column built for the downstream export, so it resolves on the plot the same way the parent-residue track does.

  Use the `triadic` categorical palette on the composition plot — the only one with enough colours (27) for a residue alphabet, so the residue tracks no longer repeat a colour every 9th residue.

## 1.2.4

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

## 1.2.3

### Patch Changes

- 428f260: Declare the run's modality on the entity axes.

  One pipeline produces repertoires of genuinely different kinds — a VDJ one from
  antibody/TCR parents, a general amplicon one from designed libraries, phage pools
  and deep mutational scans — and nothing in the output said which. Everything this
  block emits sits on the modality-neutral `pl7.app/variantKey` axis, so a consumer
  had no evidence of what was made.

  The `variantKey` and `knownVariantKey` axes (both alphabets) and the File/Log-valued
  run-scoped outputs now carry a dedicated `pl7.app/modality: vdj | amplicon` domain
  key alongside the unchanged `pl7.app/repertoire/extractionRunId`. Run scoping and
  modality stay separate keys: the run-scoping key is never renamed, so consumers that
  read its presence as meaning `amplicon` are not regressed by a VDJ run.

  Modality is derived from the region configuration — `vdj` when germline
  auto-detection is on or any parent uses the `vdj` region scheme, `amplicon`
  otherwise — not from a control of its own, so it cannot contradict the regions it
  describes. A run has exactly one modality and both entity axes always declare the
  same value.

## 1.2.2

### Patch Changes

- 5a3763d: Add a Mutation Count Histogram page — a bar chart (GraphMaker) of how many distinct variants carry each number of mutations
  Add quality filters parameters
  Infer tag pattern for single/two read datasets

## 1.2.1

### Patch Changes

- 132440a: Scale cross-sample aggregation memory with sample count instead of a flat cap. The `aggregate-variants`/`aggregate-known`/`aggregate-linkers`/`aggregate-state-matrix`/`aggregate-region-annotation` ptabler runs concatenate every per-sample frame before the groupBy, so peak memory grows with the number of samples; the previous flat 2–4 GiB cap OOM-killed the ptabler process (SIGKILL surfaced as "Exited with code -1") on large runs. This regressed with the all-String TSV reads (`inferSchema: false`), which raise the memory footprint of numeric-heavy columns. Memory now follows mixcr-amplicon-alignment's sizing — floor plus per-sample increment, clamped — with a lower floor since per-variant tables are smaller than per-clonotype ones, and each run is placed on the medium queue.

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
- Updated dependencies [21fab8d]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.vdj-region-tools@1.1.1

## 1.1.0

### Minor Changes

- fbe3553: Add whole-dataset "Auto-detect VDJ regions (germline)" option. When enabled, the workflow
  infers every parent's FR1–FR4 boundaries from germline (repseqio, reusing the
  mixcr-amplicon-alignment flow) and builds the `--parent-regions` overlay automatically,
  instead of the user entering region lengths by hand. Parents must be in-frame V-domains;
  detection fails per-parent with a clear message otherwise.

### Patch Changes

- Updated dependencies [fbe3553]
  - @platforma-open/milaboratories.synthetic-repertoire-profiler.vdj-region-tools@1.1.0

## 1.0.4

### Patch Changes

- a91eb74: Align column labels with other block. The variant display-id column is now "Variant Id" (was "Variant") and the known-set display id is "Known Variant Id"; shared abundance columns adopt the reference wording: "Supporting Reads", "Mean Fraction of Reads", "Number of Reads", "Number of Samples". The per-variant mutation-count column is now labeled "Nt mutations" / "AA mutations" (was "Mutation count"), matching the reference's Nt/AA alphabet-prefix convention. Alphabet markers on sequence-style columns and key axes now use the reference's " aa" / " nt" suffix (e.g. "CDR3 aa", "Variant nt") instead of the parenthesized "(aa)" / "(nt)" form.

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
