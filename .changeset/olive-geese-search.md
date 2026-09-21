---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.kind": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
---

Split the state-matrix export into separate AA and NT checkboxes

"Export state matrix" is now "Export AA state matrix" and covers the amino-acid
matrix only. The nucleotide matrix has its own checkbox, off by default.

"Export nucleotide-level results" no longer drags the nt state matrix with it.
It now covers the nt tables alone: nt variants and sequences, per-sample nt
abundance, the linkers and the nt known-set overlay.

The three checkboxes are independent. Existing projects keep what they emitted
before: the nt matrix stays on where both old flags were on.
