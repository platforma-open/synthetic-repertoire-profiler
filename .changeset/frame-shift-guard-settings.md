---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.kind': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': patch
---

Expose the frame-shift guard in Advanced Settings — a new "Frame Shift" group with
the guard's mode and its amino-acid threshold.

Both settings were fixed at mitool's defaults before this change: AA mismatch mode
at a threshold of 10. That is still the default, and leaving either field empty
keeps it.

**Frame shift mode** picks how a variant is judged to have lost its reading frame.
Both modes first check whether the frame is actually broken, so a variant whose
insertions and deletions cancel to a multiple of three is never flagged, however
many substitutions it carries — a randomized library is safe under either. Triplet
stops at that check. AA mismatch adds one rescue step: a frame-broken variant whose
protein still lands close to the parent is kept, which is what a small indel near
the end of the sequence produces.

**Max AA mismatches** is how far that protein may sit from the parent before the
variant is discarded. Only variants that already broke the frame are tested, so
raising it never admits more substitutions. Triplet ignores the field, and the
panel disables it in that mode. The count is absolute rather than a fraction, so it
is worth reviewing when parents are much longer or shorter than a few tens of
residues.
