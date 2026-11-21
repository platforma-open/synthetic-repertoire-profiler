---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
---

Size the state-matrix import by sample count instead of 10 x its input. On a matrix above 19 GiB the import asked for more memory than a node has and waited for a whole free node.
