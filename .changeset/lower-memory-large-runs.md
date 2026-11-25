---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
---

Lower memory use on large runs:

- The state matrix and the variant tables are processed as streams, in fewer jobs.
- Cross-sample jobs are split into smaller jobs, so their memory stays bounded as the sample count grows.
- Memory requests follow the data more closely.
- Small bug fixes and improvements.
