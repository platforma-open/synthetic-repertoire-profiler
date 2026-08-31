---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
---

Upgrade mitool to 2.3.1-153-main

Adds nested region support on the tool side: a region in the `--parent-regions` overlay
may carry `children` that tile it exactly, one level deep, so a graft inside a canonical
region (a knottin inside CDR2) can be annotated without splitting the region away. The
per-position membership table gains a `subRegion` column alongside `region`, carrying the
narrowest containing span where `region` carries the widest.

No behaviour change here yet. The block does not emit nested partitions, and the
region-annotation aggregation selects `region` only, so the new column is read and
dropped. This bump exists so the block-side work can be built against it.
