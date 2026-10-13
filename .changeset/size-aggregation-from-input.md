---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler": minor
---

Size the cross-sample aggregation from its input. The variant, linker and known-set aggregates, the state-matrix dedup and merge, and the composition heat map now use ptabler's input-size rule (4 GiB + 10 x input, no upper limit) with a 16 GiB floor, on the heavy queue. They no longer take a fixed 64, 48, 32 or 16 GiB. "Memory for aggregation" now applies only on a backend that cannot report input sizes, where it raises the flat 16 GiB grant, as in mixcr-clonotyping. SDK: workflow-tengo 6.15.0.
