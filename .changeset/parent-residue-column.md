---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
---

Export the parent's residue per position, and the parent sequence, instead of guessing the residue

No column carried the parent's residue at each position, so consumers derived it by a majority vote
over the state matrix: a matrix cell defaults to the parent residue, so the state carried by the most
distinct variants was taken to be the parent's. That vote counts variants rather than reads, so it is
wrong wherever most distinct variants are mutated at a position — a small designed set or a
single-site library. Ties broke lexicographically, and a deletion is `-`, which sorts before every
letter, so a tie reported a gap as the parent residue.

A wrong residue is not a local error. The companion heat-map block locates a single mutant at the one
position where its state differs from the parent's, so a wrong residue at one position makes every
single mutant differ there too, and each one is painted an extra cell.

mitool now writes the real thing. It already held both parent sequences and already used them —
`RepertoireTsvExporter` builds them from the `--parents` FASTA and the per-parent reading frame, and
`StateMatrix.expand` seeds every default cell from that same object. So the new tables cannot
disagree with the matrix, which computing them a second time block-side could not have guaranteed.

New exported columns, per level (the `pl7.app/alphabet` domain distinguishes nt from aa):

- `pl7.app/repertoire/parentResidue`, keyed `[parentId, position]`
- `pl7.app/repertoire/parentSequence`, keyed `[parentId]` — deliberately not `pl7.app/sequence`,
  which the per-variant sequence already uses with `{feature: amplicon-sequence, alphabet}`

The nt pair rides the nt state-matrix toggle, like everything else nt. The in-block composition heat
map now takes its parent track from the same columns the export carries, so the plot and the export
cannot show a different parent. `compute-state-heatmap` no longer computes the vote, and the dead
`aggregate-state-composition` template — a second, unreferenced copy of it — is deleted.

Requires mitool 2.3.1-148-main. That release also switches the `mutations` designator in
`pl7.app/repertoire/mutations` from milib's 0-based positions to 1-based, so it agrees with the
position axis of the state matrix, the parent tables and the region annotation. The column travels as
an opaque string, so nothing in the block parses it — the change is what the user reads in the
Mutations cell.
