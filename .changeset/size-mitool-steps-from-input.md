---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler": minor
---

Size the memory of each per-sample mitool step from its input files: parse and sort get a flat 8 GiB, refine-tags, consensus and repertoire analyze get max(8, 4 + 4 x input GiB). The Advanced Settings overrides still replace the rule.
