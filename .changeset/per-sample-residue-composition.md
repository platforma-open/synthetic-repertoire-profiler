---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": minor
---

Per-sample residue composition. The Residue Composition page gets two tabs: "All samples" shows the pooled map as before, and "Per sample" shows one map per sample, one per row, with sample metadata available to filter and facet by. Each sample's composition is computed in that sample's own job, and the pooled map is now the sum of these, so it no longer reads the merged state matrix. The pooled values and the exported state matrix are unchanged. SDK and graph-maker updated.
