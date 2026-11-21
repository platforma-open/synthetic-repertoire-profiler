---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
---

Runs with thousands of samples:

- The variant aggregate is split into smaller jobs, so its memory stays bounded as the sample count grows.
- Heat maps, imports, known-set tables and UMI steps ask for memory that follows the sample count or the input size.
- Small bug fixes and improvements.
