---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
---

Align column labels with other block. The variant display-id column is now "Variant Id" (was "Variant") and the known-set display id is "Known Variant Id"; shared abundance columns adopt the reference wording: "Supporting Reads", "Mean Fraction of Reads", "Number of Reads", "Number of Samples". The per-variant mutation-count column is now labeled "Nt mutations" / "AA mutations" (was "Mutation count"), matching the reference's Nt/AA alphabet-prefix convention. Alphabet markers on sequence-style columns and key axes now use the reference's " aa" / " nt" suffix (e.g. "CDR3 aa", "Variant nt") instead of the parenthesized "(aa)" / "(nt)" form.