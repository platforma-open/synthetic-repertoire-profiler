---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
---

Run the UMI consensus chain when the tag pattern declares a UMI

A UMI pattern is no longer refused. Between `parse` and `repertoire analyze` the
workflow now runs `refine-tags` -> `sort` -> `consensus`, so `analyze` reads one record
per molecule instead of one per read. Without a UMI the path is unchanged: `analyze`
reads the parsed `.mic` directly.

Two UMI halves stay two grouping keys rather than being concatenated into one barcode.
mitool's molecule key already spans every tag at or below Molecule, so the pair is the
molecule identity without a merge, and the merge would have needed a tag transformation
that has no CLI option.

The `sort` step is deliberately separate rather than left to the sort `consensus` does
internally: the internal path budgets 2 GB against the `sort` command's 256 MB, and peak
heap runs several times the budget.

Barcode error rates are left at mitool's defaults. The reference implementation this
chain is ported from lowers `--substitution-rate` to 1e-5, which needs roughly 413 reads
on a barcode before any neighbour can be merged; at this block's depth that switches
correction off in practice.

The sample report panel gains the two new steps, ahead of Align. Both a text and a JSON
report are written per step, so QC can read fields rather than scrape prose.

The published per-sample `.mic` is now the one `analyze` read — post-consensus on a UMI
run. The pre-consensus file is an intermediate of the chain.
