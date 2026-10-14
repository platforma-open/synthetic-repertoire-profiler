---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": minor
---

Size each step from its input and keep per-sample results for reruns.

- Per-sample mitool steps: parse and sort get a flat 8 GiB, refine-tags and consensus get max(8, 4 + 4 x input GiB), repertoire analyze gets max(8, 4 + 9 x input GiB). Every mitool step gets 8 CPUs instead of 4. The Advanced Settings overrides still replace the rule.
- Cross-sample aggregation: the variant, linker and known-set aggregates, the state-matrix dedup and merge, and the composition heat map use ptabler's input-size rule (4 GiB + 10 x input, no upper limit) with a 16 GiB floor, on the heavy queue. They no longer take a fixed 64, 48, 32 or 16 GiB. "Memory for aggregation" now applies only on a backend that cannot report input sizes, where it raises the flat 16 GiB grant, as in mixcr-clonotyping.
- Per-sample results, including their imports, are kept for 48 hours instead of 30 minutes, so a rerun within that time reuses them.
- Every command the block runs has a name (for example "mitool repertoire analyze"), so job statistics and error messages show which step it was.
- Mutation Distribution: x-axis labels are tilted 45°, in new and existing projects.
- SDK: workflow-tengo 6.15.0.
