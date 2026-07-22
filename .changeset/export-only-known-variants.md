---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': minor
---

Add an "Export only known variants" option to the Known Variants section. It is off by default and shown whenever a known set (nucleotide and/or amino-acid) is supplied. When enabled, the exported variant repertoire is restricted to variants that matched a known entry — nucleotide variants with `assignStatus == ASSIGNED`, amino-acid variants carrying a `knownAaKey`. The filter applies across the whole exported `variants` frame (per-sample abundance, per-variant properties, state matrices, linkers, and distance-to-known columns); read counts and fractions keep their original basis (fraction of all reads), unmatched rows are simply dropped. A level with no match signal (e.g. nucleotide when only an amino-acid set is given) exports empty. The block-local Known Variants / Unmatched tables and the QC report are unaffected — they always reflect the full analysis.
