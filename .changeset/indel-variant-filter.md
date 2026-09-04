---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.kind': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': minor
---

Drop indel-carrying variants by default, and report the indel load in QC

A designed library varies its parent by **substitution** at defined positions. A
variant carrying an insertion or deletion is therefore not a library member — it is
an artefact of oligo synthesis, PCR slippage, or sequencing. Those variants are now
excluded from the exported repertoire.

This is the default in the tools that solve the same problem: DiMSum ships
`--indels none` ("indel variants, defined as those not matching the wild-type
nucleotide sequence length, are removed"), and Enrich2 discards reads whose length
differs from wild type unless the optional Needleman-Wunsch aligner is enabled.

New **Allow indels** setting (Advanced, off by default) keeps them, for libraries
that encode indels deliberately — deletion scans and similar designs, which this
block also serves.

New QC columns, reported **whether or not the filter is on**, so the load is always
visible rather than inferred: **Indel Variants**, **Indel Reads**, **Indel Reads (%)**.

**Why this ships together with the frame-shift change.** Dropping indels is strictly
stronger than dropping frame shifts — every frame shift contains an indel, but not
every indel shifts the frame. The old `AA_MISMATCH` check was incidentally
suppressing indel variants, because an indel plus a library's designed divergence
comfortably cleared its threshold of 10. Correcting that check to `TRIPLET` removes
the accidental suppression and makes indel variants visible in the output. They were
always there; nothing about them is new. Shipping the frame-shift fix without this
filter would surface them with no way to exclude them.

Implemented block-side, on mitool's `mutations` designator: `AlignFilterParams`
exposes only `maxMutations`, `maxMutationFraction` and `minBaseQuality`, none of
which tells an indel apart from a substitution.

Existing runs must be recomputed. Variant counts will drop by the indel fraction now
reported in QC.
