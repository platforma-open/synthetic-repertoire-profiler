---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.vdj-region-tools": patch
---

Fix VDJ auto-detect rejecting valid light-chain parents

The J half of a parent runs from mid-CDR3 to the end, so it is only about 14
residues and scores low. The inferPoints threshold of 30 sat on top of the real
values: a kappa VL scored 29, FR4Begin was left unplaced and the parent could
not be annotated at all. The threshold is now 20.

The error also names the anchors it could not place, so a threshold problem is
no longer reported as an engineered scaffold.
