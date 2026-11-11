---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.kind": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.vdj-region-tools": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": minor
---

Add scFv support. Tag regions with a chain, auto-detect FR/CDR per chain, or pick the scFv scheme and paste the linker. Add a per-region "Ignore mutations" option for linkers and other noise regions. Per-chain sequence columns carry `pl7.app/vdj/chain`, and whole-VH/VL sequences are exported. Downstream blocks read the new column shape.
