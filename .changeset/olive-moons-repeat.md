---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
---

Remove variants that exceed the amino-acid mutation limit from the results

Setting a max aa mutation count or fraction now drops those variants instead of
leaving them in the tables as rows with no amino-acid variant. Read and UMI
fractions renormalise over what is left, the same way the alignment and assembly
gates already behave.

The QC counts for the gate now come from mitool's call-mutations report rather
than from a flag on the rows, because the rows are gone. Their percentage still
divides by the pre-gate total, so the number means what it did before.
