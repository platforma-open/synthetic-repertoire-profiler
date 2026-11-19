---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
---

Request less memory for steps that asked for 10 x their input: the variant aggregate now asks for 5 x, the linker aggregate and the per-sample tables step for 3 x. On a run of 3 samples with 4M variants each they asked for 96, 88 and 64 GiB and used 18, 3 and 5 GiB. The composition heat map and the state-matrix dedup stream the matrix and ask for 1 x: a 25 GiB matrix ran in a 12 GiB limit.
