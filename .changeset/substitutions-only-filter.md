---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.kind': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': minor
---

New Advanced Setting: **Substitutions only**

Keeps only variants whose differences from the parent are substitutions. Off by default.

A read is dropped at alignment if it carries an insertion or a deletion, so no indel-bearing variant is ever built and neither the nucleotide nor the amino-acid export can contain one. This is the control a designed library or a mutational scan needs: the existing mutation-load filters count all edit operations together, so no setting of them admits a heavy substitution load while still rejecting indels.

The rejection is visible in two places. The Alignments chart gains an **Indels present** band alongside the other alignment-failure reasons, and the QC table gains **NT Indel Reads** with its percentage.

Two effects to expect when the setting is on. A read whose indel is only a sequencing error is dropped as well, so its variant loses that read support — on noisy data this can be a large share. And the frame-shift counts fall to near zero, because those reads are now removed before variants are built and are counted among the alignment outcomes instead.

Requires mitool 2.3.1-162-main, pinned in this release.
