---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.kind': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': patch
---

New Advanced Setting: **Min variant reads**

Discards a variant supported by fewer than this many reads. Off by default, so an existing project keeps every variant it kept before.

The gate removes the low-count tail of sequencing and PCR errors directly. The existing **Min variant quality** reaches that tail only indirectly: quality accumulates over the reads supporting a variant, so a thin variant tends to fail it — but the threshold is a Phred value, and it tightens as the parent gets longer. On a long parent the quality gate can take real variants with the errors. A read count does not have that problem.

The setting applies at mitool's assemble step (`-Massemble.minVariantReads`), before mutation calling. A variant cut here never reaches translation, the state matrix, or the known-set assignment.

The gate counts reads, not molecules. On a UMI run the count is read support after consensus, so PCR duplicates still contribute.

The assemble report names the gate whenever it is armed and gives the variants and the reads it dropped, so a large drop is never a mystery.

The QC Report table carries the same drop in three new columns: **Low-Coverage Variants**, **Low-Coverage Reads** and **Low-Coverage Reads (%)**. They matter because every other number in that table is computed over the variants that survived — the alignment chart can read 100% while the gate quietly removes two thirds of the reads a step later. The percentage is taken over the reads entering assembly, not over the QC row's own read total, which is post-gate.

Requires mitool with `assemble.minVariantReads`, pinned in this release.
