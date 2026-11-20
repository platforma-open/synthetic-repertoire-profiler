---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
---

Deduplicate the state matrix by variant. The cross-sample dedup held every distinct matrix row in memory, split over 16 jobs per level after a chunking job per sample. One job per level now takes the rows of each variant and parent from the first sample that holds that pair, so the matrix streams through and only the pair list is held. The exported matrix is unchanged.
