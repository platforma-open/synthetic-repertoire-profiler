---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler": minor
---

Size the memory of each per-sample mitool step from its input files: parse and sort get a flat 8 GiB, refine-tags and consensus get max(8, 4 + 4 x input GiB), repertoire analyze gets max(8, 4 + 9 x input GiB). Every mitool step gets 8 CPUs instead of 4. The Advanced Settings overrides still replace the rule.
