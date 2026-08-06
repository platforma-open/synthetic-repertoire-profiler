---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': patch
---

Declare the run's modality on the entity axes.

One pipeline produces repertoires of genuinely different kinds — a VDJ one from
antibody/TCR parents, a general amplicon one from designed libraries, phage pools
and deep mutational scans — and nothing in the output said which. Everything this
block emits sits on the modality-neutral `pl7.app/variantKey` axis, so a consumer
had no evidence of what was made.

The `variantKey` and `knownVariantKey` axes (both alphabets) and the File/Log-valued
run-scoped outputs now carry a dedicated `pl7.app/modality: vdj | amplicon` domain
key alongside the unchanged `pl7.app/repertoire/extractionRunId`. Run scoping and
modality stay separate keys: the run-scoping key is never renamed, so consumers that
read its presence as meaning `amplicon` are not regressed by a VDJ run.

Modality is derived from the region configuration — `vdj` when germline
auto-detection is on or any parent uses the `vdj` region scheme, `amplicon`
otherwise — not from a control of its own, so it cannot contradict the regions it
describes. A run has exactly one modality and both entity axes always declare the
same value.
