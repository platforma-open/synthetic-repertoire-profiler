---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
---

Size the state-matrix dedup by sample count instead of input bytes. It asked for one GiB per GiB of matrix, a whole node at 200 samples, while it needs 8 GiB there. It asks for 6 GiB plus 60 MiB per sample, at least 16 GiB.
