---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
---

Size the state-matrix import at 3 x its input instead of 10 x. On a matrix above 19 GiB the import asked for more memory than a node has and waited for a whole free node; it peaked at 28 GiB on a 25 GiB matrix.
