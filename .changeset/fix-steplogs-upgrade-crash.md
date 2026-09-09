---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': patch
---

Fix: upgrading a project from block 1.2.8 to 1.2.9 broke the block with `Service or input field not found stepLogs`

1.2.9 renamed the workflow's `logs` output to `stepLogs`. A project computed under 1.2.8 has outputs carrying `logs` and no `stepLogs`, and the model resolved the new name with the throwing form — which failed the whole model render, not just the logs view, leaving the upgraded block unusable.

The two outputs that read that field now tolerate its absence, so an upgraded project opens normally. The Logs and Progress views are empty until the run completes, which the upgrade already requires.
