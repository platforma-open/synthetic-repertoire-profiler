---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
---

Hold one row per variant in the variant aggregate instead of one per variant per sample. Each sample now writes its variant metadata as two small files, and the aggregate takes a variant's sequence and mutations from the first sample that keeps it. The linker tables are built in the same job instead of a second one that read every sample again. The nucleotide property table and the nucleotide linkers are skipped when neither the nucleotide export nor the nucleotide state matrix is on. The tables are no longer sorted before they are written; the import sorts by axes.
