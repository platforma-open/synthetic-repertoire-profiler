---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
---

Show which pre-processing step a sample is in

The Progress column only ever read the `analyze` log, so on a UMI run a sample sat at
"Queued" through parse, barcode correction, sorting and consensus — three commands and
most of the wall-clock — and only came alive at the last step.

Each mitool command now publishes its own log, keyed by an ordered step name
(`1-parse`, `2-refine-tags`, `3-sort`, `4-consensus`, `5-analyze`). The column reports
the furthest step a sample has reached, preferring one that is still live, as
`[2/5] Correcting UMI: 40.0%`. The step count adapts: a run without a UMI has two steps,
not five. Completion still comes from `qc.json` materialising rather than from the log,
which freezes at whatever stage it last printed.

The sample Logs view gains a step picker for the same reason. It showed the analyze log
alone, so a failure in barcode correction or consensus left nothing to read — on a UMI
run those are three commands upstream of anything the view could display.
