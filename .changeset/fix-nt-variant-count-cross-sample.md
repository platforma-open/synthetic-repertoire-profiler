---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
---

Fix "Synonymous nt variants" (`pl7.app/ntVariantCount`) reporting one sample's count

The column carried mitool's per-sample `ntVariantCount` through the cross-sample
aggregation with `.first()`, so it published whichever sample came first instead of a
dataset-wide count. It is now recounted as the distinct nt variants encoding each aa
variant across all samples — the same set the `ntToAa` linker already holds.
