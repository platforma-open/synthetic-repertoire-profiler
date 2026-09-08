---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.kind': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': patch
---

Support UMI (molecular barcode) libraries

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
which a barcode is discarded. The panel also reads the declared UMI back, so a mistyped
pattern shows up before a run rather than during one. Two UMI halves stay two grouping
keys — the pair identifies the molecule, without being concatenated.

The Progress column now names the pre-processing step a sample is in rather than sitting at
"Queued" until the last command. The sample panel's Logs view carries one log per command,
picked by step, so a failure in barcode correction or consensus has something to read. It
replaces the separate Reports tab: a step's report text was already printed into its log,
so the two tabs showed the same numbers under overlapping step lists.

Requires mitool 2.3.1-155-main, which fills the per-variant molecule count.
