---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
---

Upgrade mitool to 2.3.1-155-main

`repertoire analyze` now fills the `moleculeCount` column of `variants.tsv` when the
input `.mic` carries a Molecule (UMI) tag: the distinct barcode tuples behind each
variant, keyed on every tag at or below Molecule, since a barcode is only unique within
its sample and cell. Without a Molecule tag the column stays empty, exactly as before,
and `qc.json`'s `hasUmi` follows the same signal.

No behaviour change here yet. The block does not read the column, and `xsv.importFile`
builds p-columns only for the columns its spec names. This bump exists so the block-side
work can be built against it.
