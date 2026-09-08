---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
---

Report the QC table in molecules on a UMI run

The per-sample QC table gains `totalMolecules`, `readsPerMolecule`, and a
molecule-weighted twin of every read-weighted bucket (frame-shift, aa mutation-limit,
assigned, unassigned, ambiguous) with its fraction over the molecule total. Read-based
totals and fractions demote to `optional` beside them, so a UMI run leads with
molecules. Without a UMI nothing changes and no molecule column is emitted.

`readsPerMolecule` is the headline number: sequencing depth per molecule, which is what
says whether the consensus had anything to work with. It is a ratio, not a fraction, so
it carries no 0-1 range and no percent format.

The barcode-loss funnel (reads to molecules to surviving molecules to consensuses) is
not included. It needs the `refine-tags` and `consensus` reports parsed, which means a
QC software package this block does not have; both reports are already readable per
sample in the report panel.
