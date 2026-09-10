---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': patch
---

Add a Preview run mode, matching the one in the MiXCR clonotyping block.

A new **Run mode** control offers Preview or Full run. Preview reveals a **Reads
per sample limit** field and caps how much of each sample the pipeline reads. It
is there to check that the tag pattern, the parents and the filters are right
before paying for the whole dataset.

The cap reaches `mitool parse` as `-n`. mitool takes the FIRST reads of the input
files — it is not a random sample. So a preview on a multi-lane sample can miss
the later lanes entirely, and it carries the quality profile of the start of the
run. The tooltip says so.

Preview matters more when the tag pattern carries a UMI. Cutting reads also cuts
reads per molecule, so molecules that would clear "Min reads per UMI" in a full
run are dropped. The loss in molecules is larger than the loss in reads. The
panel defaults the limit to 1,000,000 reads with a UMI against 100,000 without,
and shows a warning explaining the effect.

A full run projects no limit at all, so switching to Preview and back reproduces
the original recipe byte for byte, and cached full-run samples still match.
Existing projects migrate to Full run. Preview is deliberately not part of the
block kind's init params: a template is a recipe for a real run, and a saved
preview would hand every block made from it a partial answer.
