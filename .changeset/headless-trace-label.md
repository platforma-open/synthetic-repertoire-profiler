---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
---

Compute the block label without the UI

The trace label is now the custom block label or "Amplicon Profiling", computed by the
model, so it no longer depends on the block having been configured in the UI and a block
created without it gets the same label. The input dataset name moves to the subtitle only,
written when the user picks the dataset; it was already part of the inherited upstream
trace. Existing blocks show as stale once after the update because the arguments change
shape.
