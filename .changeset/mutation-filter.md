---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': patch
---

Add an optional per-fragment mutation-load filter to Advanced Settings: "Max mutations" and "Max mutation fraction".

Both are off by default. When set, they are passed to mitool's align step (`-Malign.filter.maxMutations` / `-Malign.filter.maxMutationFraction`), rejecting an alignment that exceeds the cap as a likely misalignment / off-target read. The two gates are applied independently.

Also fix the Alignments chart in the sample report: the not-aligned reasons now use the correct mitool codes (`NoAlignment`, `IncompleteParentCoverage`, `TooManyMutations`, `LowBaseQuality`, `NoInput`), each with a human-readable label and a distinct color. Previously the stale label map matched no real code, so every reason showed its raw code in a single fallback color.
