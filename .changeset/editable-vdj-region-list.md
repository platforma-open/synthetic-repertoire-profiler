---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.kind': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': minor
---

Let the user edit the region list in the VDJ scheme

The VDJ scheme locked the region list to FR1, CDR1, FR2, CDR2, FR3, CDR3, FR4 and allowed
only the lengths to be edited. An engineered V-domain does not always fit that layout: a
knottin grafted into an antibody scaffold sits between two canonical regions, or in place
of one. Such a parent had to fall back to the custom scheme, which drops the VDJ modality
from the whole run.

The VDJ scheme now seeds from those seven names but lets the user add, remove and rename
regions, the same as the custom scheme. A "Reset to FR1–FR4" button reseeds the
conventional partition. Switching schemes still clears the list, unchanged.

Also fixes the amino-acid preview. A region was marked in-frame from its own length alone,
so once an earlier region shifted the frame the editor showed a translation read at the
wrong offset. It now applies the workflow's rule — both ends on a codon boundary — and
warns per parent which regions will have no amino-acid columns.

Requires a mitool release carrying the matching validator change (MILAB-6853); mitool
rejected a non-canonical VDJ region list too.
