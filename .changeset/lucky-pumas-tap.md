---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.kind": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.vdj-region-tools": patch
---

- Variants over the amino-acid mutation limit are now removed from the results, not kept unlinked. Read and UMI fractions renormalise over what is left.
- Separate checkboxes for the AA and NT state matrices. "Export nucleotide-level results" no longer controls the NT matrix.
- Fixed VDJ auto-detect rejecting valid light-chain parents: the J half scored just below the inference threshold.
- Removed the repeated percentage from the right of the Progress column.
