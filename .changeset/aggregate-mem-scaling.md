---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
---

Scale cross-sample aggregation memory with sample count instead of a flat cap. The `aggregate-variants`/`aggregate-known`/`aggregate-linkers`/`aggregate-state-matrix`/`aggregate-region-annotation` ptabler runs concatenate every per-sample frame before the groupBy, so peak memory grows with the number of samples; the previous flat 2–4 GiB cap OOM-killed the ptabler process (SIGKILL surfaced as "Exited with code -1") on large runs. This regressed with the all-String TSV reads (`inferSchema: false`), which raise the memory footprint of numeric-heavy columns. Memory now follows mixcr-amplicon-alignment's sizing — floor plus per-sample increment, clamped — with a lower floor since per-variant tables are smaller than per-clonotype ones, and each run is placed on the medium queue.
