---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.kind': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': patch
---

New Advanced Setting: **Substitutions only**

Keeps only variants whose differences from the parent are substitutions. Off by default.

A read is dropped at alignment if it carries an insertion or a deletion, so no indel-bearing variant is ever built and neither the nucleotide nor the amino-acid export can contain one. This is the control a designed library or a mutational scan needs: the existing mutation-load filters count all edit operations together, so no setting of them admits a heavy substitution load while still rejecting indels.

The rejection is visible in two places. The Alignments chart gains an **Indels present** band alongside the other alignment-failure reasons, and the QC table gains **NT Indel Reads** with its percentage.

Two effects to expect when the setting is on. A read whose indel is only a sequencing error is dropped as well, so its variant loses that read support — on noisy data this can be a large share. And the frame-shift counts fall to near zero, because those reads are now removed before variants are built and are counted among the alignment outcomes instead.

Requires mitool 2.3.1-162-main, pinned in this release.

Fix: upgrading a project from block 1.2.8 to 1.2.9 broke the block with `Service or input field not found stepLogs`

1.2.9 renamed the workflow's `logs` output to `stepLogs`. A project computed under 1.2.8 has outputs carrying `logs` and no `stepLogs`, and the model resolved the new name with the throwing form — which failed the whole model render, not just the logs view, leaving the upgraded block unusable.

The two outputs that read that field now tolerate its absence, so an upgraded project opens normally. The Logs and Progress views are empty until the run completes, which the upgrade already requires.
