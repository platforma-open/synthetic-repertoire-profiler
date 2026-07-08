---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.vdj-region-tools': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': minor
---

Add whole-dataset "Auto-detect VDJ regions (germline)" option. When enabled, the workflow
infers every parent's FR1–FR4 boundaries from germline (repseqio, reusing the
mixcr-amplicon-alignment flow) and builds the `--parent-regions` overlay automatically,
instead of the user entering region lengths by hand. Parents must be in-frame V-domains;
detection fails per-parent with a clear message otherwise.
