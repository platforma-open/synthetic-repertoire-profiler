---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.kind": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
---

Keep the input dataset in a project template. A project made from a template came with Amplicon Profiling on "Select dataset", so it could not run until the dataset was picked by hand in every block. The kind now carries `input`, a reference to the upstream dataset, and the block made from a template points at the dataset the original project used.
