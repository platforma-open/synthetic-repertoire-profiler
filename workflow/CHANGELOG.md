# @platforma-open/milaboratories.synthetic-repertoire-profiler.workflow

## 1.2.13

### Patch Changes

- 1f07754: Add a Preview run mode, matching the one in the MiXCR clonotyping block.

  A new **Run mode** control offers Preview or Full run. Preview reveals a **Reads
  per sample limit** field and caps how much of each sample the pipeline reads. It
  is there to check that the tag pattern, the parents and the filters are right
  before paying for the whole dataset.

  The cap reaches `mitool parse` as `-n`. mitool takes the FIRST reads of the input
  files — it is not a random sample. So a preview on a multi-lane sample can miss
  the later lanes entirely, and it carries the quality profile of the start of the
  run. The tooltip says so.

  Preview matters more when the tag pattern carries a UMI. Cutting reads also cuts
  reads per molecule, so molecules that would clear "Min reads per UMI" in a full
  run are dropped. The loss in molecules is larger than the loss in reads. The
  panel defaults the limit to 1,000,000 reads with a UMI against 100,000 without,
  and shows a warning explaining the effect.

  A full run projects no limit at all, so switching to Preview and back reproduces
  the original recipe byte for byte, and cached full-run samples still match.
  Existing projects migrate to Full run. Preview is deliberately not part of the
  block kind's init params: a template is a recipe for a real run, and a saved
  preview would hand every block made from it a partial answer.

## 1.2.12

### Patch Changes

- 7fc1a76: Expose the frame-shift guard in Advanced Settings — a new "Frame Shift" group with
  the guard's mode and its amino-acid threshold.

  Both settings were fixed at mitool's defaults before this change: AA mismatch mode
  at a threshold of 10. That is still the default, and leaving either field empty
  keeps it.

  **Frame shift mode** picks how a variant is judged to have lost its reading frame.
  Both modes first check whether the frame is actually broken, so a variant whose
  insertions and deletions cancel to a multiple of three is never flagged, however
  many substitutions it carries — a randomized library is safe under either. Triplet
  stops at that check. AA mismatch adds one rescue step: a frame-broken variant whose
  protein still lands close to the parent is kept, which is what a small indel near
  the end of the sequence produces.

  **Max AA mismatches** is how far that protein may sit from the parent before the
  variant is discarded. Only variants that already broke the frame are tested, so
  raising it never admits more substitutions. Triplet ignores the field, and the
  panel disables it in that mode. The count is absolute rather than a fraction, so it
  is worth reviewing when parents are much longer or shorter than a few tens of
  residues.

## 1.2.11

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

## 1.2.10

### Patch Changes

- edd439e: Export which regions each parent subdivides

  A region partition may split a region one level deep, so a span named for a canonical
  region (CDR2, say) can be a container holding an insert plus its flanks. Nothing downstream
  could tell that apart from an ordinary CDR2, and a consumer whose behaviour depends on
  region identity — the sequence liabilities scan, whose conserved-cysteine rules assume a
  canonical immunoglobulin region — would read a graft as the region its name claims.

  Adds `pl7.app/repertoire/subdividedRegions`, keyed `[parentId]`: a comma-separated list of
  that parent's regions that hold sub-regions. Rows exist only for parents that subdivide
  something, and the column is emitted only when at least one parent does — so a run without
  sub-regions is unchanged, and the column's mere presence answers "does this dataset hold
  non-canonical regions" from the spec alone, with no data read.

  Keyed per parent rather than per variant because the fact is a property of the reference,
  not of any one variant: two scaffolds in the same run can put their insert in different
  regions, and a run-wide flag could not distinguish them. A consumer resolves it per variant
  through the existing parent to variant linker (`pl7.app/repertoire/parentLink`).

  The column carries the run scope in its domain, unlike the other parent-keyed columns. Those
  are reached by walking the exported frame; this one is meant to be discovered from the result
  pool, and the parent axis deliberately carries no domain, so without the run scope two
  profiler runs in one project would be indistinguishable.

  The list names containers, not the sub-regions inside them — that is what identifies the
  region holding the insert. The insert's own sequence needs nothing new: every sub-region is
  already an ordinary span downstream with a sequence column of its own.

## 1.2.9

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

## 1.2.8

### Patch Changes

- ddaa43f: Upgrade mitool to 2.3.1-153-main

  Adds nested region support on the tool side: a region in the `--parent-regions` overlay
  may carry `children` that tile it exactly, one level deep, so a graft inside a canonical
  region (an insert sitting inside CDR2) can be annotated without splitting the region away. The
  per-position membership table gains a `subRegion` column alongside `region`, carrying the
  narrowest containing span where `region` carries the widest.

  No behaviour change here yet. The block does not emit nested partitions, and the
  region-annotation aggregation selects `region` only, so the new column is read and
  dropped. This bump exists so the block-side work can be built against it.

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
