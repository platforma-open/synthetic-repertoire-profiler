---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
---

Detect frame shifts by triplet, not by amino-acid mismatch count

The `call-mutations` step now runs with `-Mcall-mutations.frameShiftMode=TRIPLET`.

mitool's default, `AA_MISMATCH`, is a proxy: it aligns the variant's amino-acid
sequence against the parent and calls a frame shift when the edit-operation count
exceeds `frameShiftAaThreshold` (default 10). That test cannot separate designed
diversity from a real indel. A combinatorial library that randomizes 13 surface
positions — a plain affibody or scFv library — diverges from its parent by 13
amino acids by construction, so every member crossed the threshold and the block
reported ~99% frame-shifted variants on data that contained no frame shifts at all.

`TRIPLET` tests the nucleotide mutations directly (`lengthDelta % 3 != 0`), which
is what a frame shift is, and is independent of how far the library was designed
to roam. The mode is pinned rather than exposed: this block only ever analyses
designed synthetic libraries, where `AA_MISMATCH` is never the right test.

One case `TRIPLET` does not cover: compensating +1/-1 indels whose net length delta
is a multiple of 3. The frame is restored by the end of the sequence, so this is
correctly not a frame shift, but the stretch between the two indels was read out of
frame and is scrambled. `AA_MISMATCH` would have flagged such a variant on its
mismatch count. Nothing flags it now unless **Max AA mut count** (`maxAaMutations`)
is set — that gate is off by default (mitool defaults it to `-1`) and rejects only
what exceeds the threshold the user configures. A default run therefore keeps these
variants. They were never distinguishable from heavily diversified library members
under the old check either, which is why the block does not try to guess a value.

Existing runs must be re-run to pick this up; frame-shift QC counts will drop.
