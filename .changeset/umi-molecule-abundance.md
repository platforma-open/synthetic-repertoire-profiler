---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
---

Export molecule counts as the primary abundance on a UMI run

A run whose tag pattern declares a UMI now exports `uniqueMoleculeCount` and
`uniqueMoleculeFraction` per sample and per variant, at both the nucleotide and
amino-acid level, plus `uniqueMoleculeCountTotal` and `uniqueMoleculeFractionMean`
across samples and `knownVariantMoleculeCount` per known-set entry. Names and
annotations match the peptide-extraction block, so a consumer discovering abundance by
annotation sees one convention across both.

Molecules become the anchored, primary abundance on such a run and read counts become a
secondary, default-hidden one. Without a UMI nothing changes: reads stay primary and no
molecule column is emitted at all — the specs and the aggregations are gated on the same
flag, since an Xsv spec naming a column the parquet does not carry fails the import.

Summing molecule counts over an amino-acid variant's synonymous nucleotide members is
sound: a molecule yields one consensus sequence, so it lands in exactly one nucleotide
variant. The one exception is a barcode collision, which `consensus` splits into several
consensuses.
