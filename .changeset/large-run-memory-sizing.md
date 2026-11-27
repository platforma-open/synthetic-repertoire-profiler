---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
---

Runs with thousands of samples:

- Memory requests follow the sample count and the input size.
- Tables passed between cross-sample steps are stored as Parquet.
- Small bug fixes and improvements.
