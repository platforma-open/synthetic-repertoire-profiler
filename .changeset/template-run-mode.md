---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.kind": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
---

Take the run mode from a project template. A block made from a template always started on a full run, so a pipeline could not be tried out on a part of the reads without switching the block by hand. The kind now carries `runMode` and `limitInput`: a template may ask for a preview with a read limit, and a project exported as a template keeps the mode it had.
