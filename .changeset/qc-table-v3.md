---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
---

QC report and known-variant tables no longer fail with "Invalid sorting column" when a saved sort names a column the table no longer has (e.g. the sample name column after switching the input dataset). The stale sort is dropped instead.
