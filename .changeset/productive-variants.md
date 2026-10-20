---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.kind": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": minor
---

Mark non-productive variants and optionally remove them.

- Every nt and aa variant has a Productive column (`pl7.app/vdj/sequence/productive`, "true" / "false", a discrete filter), the same column the MiXCR blocks export. A variant is non-productive when mitool calls it frame-shifted or its translation carries a stop codon.
- New setting "Remove non-productive variants", on for new blocks and off for existing projects. When on, these variants leave the variant tables, abundances, linkers, known-set overlay, state matrices and histograms, and read fractions are recomputed over the variants that remain.
- QC Report: new Stop-Codon Variants, Reads and Reads (%) columns (and UMIs on a UMI run). They count from the unfiltered output, like the frame-shift columns.
- Block kind: `filterNonProductive` is a new init param.
