---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler': minor
---

Add the "Residue Composition" page — a per-position residue heat map (position × residue) built in-block from the state matrix and the cross-sample per-variant read totals. Two value columns from one aggregation: pooled read count, and per-position residue frequency (the default view). One plot per parent, chosen with a Parent selector in the chart settings, with the parent-residue and region tracks riding under the position axis. Amino-acid level always, nucleotide level when nucleotide export is on.

The composition plot's region track is its own column (carrying the alphabet domain) rather than the region column built for the downstream export, so it resolves on the plot the same way the parent-residue track does.

Use the `triadic` categorical palette on the composition plot — the only one with enough colours (27) for a residue alphabet, so the residue tracks no longer repeat a colour every 9th residue.
