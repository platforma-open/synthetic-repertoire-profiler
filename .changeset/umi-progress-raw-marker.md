---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
---

Show a progress marker the tool emits in a shape the pattern cannot parse

Not every mitool marker is `stage: pct%`. `sort` ends with a bare "Sorting finished" and
`refine-tags` opens with "Initialization: progress unknown". An unparseable line was
falling back to the step's own name, so the column showed "[3/5] sort" where the tool had
said "Sorting finished". It now shows the tool's words.
