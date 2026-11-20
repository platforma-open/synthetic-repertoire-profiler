---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
---

Import each per-sample table once for all samples. Every sample ran its own import job per table, so a run with hundreds of small samples spent most of its time on hundreds of short jobs. One job per table now concatenates the per-sample files and one import partitions the result by sample. The per-sample state-matrix chunk job is skipped when both matrix exports are off.
