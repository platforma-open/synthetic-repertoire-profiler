---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
---

Split the variant aggregate into key-bucket jobs so its memory stays bounded as the sample count grows.
