---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
---

Raise the memory floor of the analyze step from 8 to 12 GiB. A sample with many distinct variants in highly similar reads has a small input file, so it ran at the floor and could be killed for memory.
