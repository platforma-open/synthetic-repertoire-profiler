---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler": patch
---

Fix UMI runs failing on the amino-acid mutation histogram and the known aa table: both roll nt variants up to the aa key with a projection that dropped `moleculeCount`.
