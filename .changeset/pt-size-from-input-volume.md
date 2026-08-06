---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': patch
---

Size every ptabler step from input volume instead of sample count

The cross-sample aggregations sized their RAM/CPU from the number of samples
(`aggregate-resources.forSamples`), which floored at 8 GiB regardless of dataset
size. The state-matrix aggregation has one row per variant per position, so it
scales with the variant count, not the sample count — a run with several million
variants was OOM-killed at the 8 GiB floor.

All `pt.workflow()` steps and Xsv imports are now left unsized, so workflow-tengo
sizes them from actual input volume (`ram = between(2 GiB + 4 × size, 2 GiB,
64 GiB)`). An explicit `.mem()`/`.cpu()` suppresses that formula, which is why the
previous per-sample budgets never took effect on large repertoires.
